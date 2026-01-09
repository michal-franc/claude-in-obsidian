/**
 * Process management for Claude Shell instances
 */

import { spawn, ChildProcess } from 'child_process';
import { readFile, open } from 'fs/promises';
import { existsSync } from 'fs';
import { ClaudeProcessOptions, BridgeSessionMetadata } from './types';
import { stripAnsiCodes } from './utils';
import { logger } from './logger';

/**
 * Manages a Claude session (spawns fresh process for each command OR communicates via pipes)
 */
export class ClaudeProcess {
	private sessionId: string;
	private workingDirectory: string;
	private envVars: Record<string, string>;
	private commandTimeout: number = 30000; // 30 seconds
	private isActive: boolean = true;
	private sessionType: 'managed' | 'bridge';
	private bridgeMetadata?: BridgeSessionMetadata;

	constructor(
		options: ClaudeProcessOptions,
		timeout?: number,
		sessionType: 'managed' | 'bridge' = 'managed',
		bridgeMetadata?: BridgeSessionMetadata
	) {
		this.sessionId = options.sessionId;
		this.workingDirectory = options.workingDirectory;
		this.envVars = options.envVars || {};
		this.sessionType = sessionType;
		this.bridgeMetadata = bridgeMetadata;
		if (timeout) {
			this.commandTimeout = timeout;
		}
	}

	/**
	 * Initialize the session (no-op, kept for compatibility)
	 */
	async start(): Promise<void> {
		logger.info(`[Session ${this.sessionId}] Session initialized`);
		logger.debug(`[Session ${this.sessionId}] Working directory:`, this.workingDirectory);
		// No actual process to start - we spawn fresh for each command
		this.isActive = true;
	}

	/**
	 * Send a command to Claude (spawns fresh process OR uses bridge pipes)
	 */
	async sendCommand(command: string, context?: string): Promise<string> {
		logger.info(`[Session ${this.sessionId}] Executing command (type: ${this.sessionType}):`, command.substring(0, 100));

		if (!this.isActive) {
			logger.error(`[Session ${this.sessionId}] Session not active`);
			throw new Error('Session not active');
		}

		// Route to appropriate method based on session type
		if (this.sessionType === 'bridge') {
			return this.sendCommandViaBridge(command, context);
		} else {
			return this.sendCommandViaSpawn(command, context);
		}
	}

	/**
	 * Send command via named pipes to bridge session
	 */
	private async sendCommandViaBridge(command: string, context?: string): Promise<string> {
		if (!this.bridgeMetadata) {
			throw new Error('Bridge metadata not available');
		}

		logger.info(`[Session ${this.sessionId}] Sending command via bridge pipes`);

		// Check if pipes exist
		if (!existsSync(this.bridgeMetadata.inputPipe)) {
			logger.error(`[Session ${this.sessionId}] Input pipe does not exist:`, this.bridgeMetadata.inputPipe);
			throw new Error('Bridge session not running (input pipe missing)');
		}

		if (!existsSync(this.bridgeMetadata.outputPipe)) {
			logger.error(`[Session ${this.sessionId}] Output pipe does not exist:`, this.bridgeMetadata.outputPipe);
			throw new Error('Bridge session not running (output pipe missing)');
		}

		return new Promise(async (resolve, reject) => {
			const timeoutId = setTimeout(() => {
				logger.error(`[Session ${this.sessionId}] Bridge command timeout after ${this.commandTimeout}ms`);
				reject(new Error('Command timeout'));
			}, this.commandTimeout);

			try {
				// Prepare command with context if provided
				let fullCommand = command;
				if (context) {
					logger.debug(`[Session ${this.sessionId}] Including context in command`);
					fullCommand = `Here is some context:\n\n${context}\n\n${command}`;
				}

				// Write command to input pipe
				const inputPipe = this.bridgeMetadata!.inputPipe;
				const outputPipe = this.bridgeMetadata!.outputPipe;

				logger.debug(`[Session ${this.sessionId}] Writing to input pipe:`, inputPipe);
				const inputFile = await open(inputPipe, 'w');
				await inputFile.write(fullCommand + '\n');
				await inputFile.close();
				logger.info(`[Session ${this.sessionId}] Command written to bridge`);

				// Read response from output pipe
				logger.debug(`[Session ${this.sessionId}] Reading from output pipe:`, outputPipe);
				const response = await this.readResponseFromPipe(outputPipe);

				clearTimeout(timeoutId);
				logger.info(`[Session ${this.sessionId}] Received response from bridge, length:`, response.length);
				resolve(response);
			} catch (error) {
				clearTimeout(timeoutId);
				logger.error(`[Session ${this.sessionId}] Bridge communication error:`, error);
				reject(error);
			}
		});
	}

	/**
	 * Read response from output pipe until completion marker
	 */
	private async readResponseFromPipe(pipePath: string): Promise<string> {
		return new Promise(async (resolve, reject) => {
			try {
				let response = '';
				const outputFile = await open(pipePath, 'r');
				const stream = outputFile.createReadStream({ encoding: 'utf-8' });

				stream.on('data', (chunk: string | Buffer) => {
					const text = typeof chunk === 'string' ? chunk : chunk.toString();
					response += text;
					// Check for completion marker
					if (response.includes('___COMMAND_COMPLETE___')) {
						stream.destroy();
						outputFile.close();
						// Remove the marker
						const cleaned = response.replace(/___COMMAND_COMPLETE___/g, '').trim();
						resolve(this.cleanResponse(cleaned));
					}
				});

				stream.on('error', (error) => {
					outputFile.close();
					reject(error);
				});

				// Timeout fallback (in case marker never arrives)
				setTimeout(() => {
					if (!stream.destroyed) {
						stream.destroy();
						outputFile.close();
						if (response.length > 0) {
							resolve(this.cleanResponse(response));
						} else {
							reject(new Error('No response received from bridge'));
						}
					}
				}, this.commandTimeout);
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Send command by spawning fresh Claude process (managed session)
	 */
	private async sendCommandViaSpawn(command: string, context?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			// Prepare input: context (if provided) + command
			let input = '';
			if (context) {
				logger.debug(`[Session ${this.sessionId}] Including context, length:`, context.length);
				input += `Here is some context:\n\n${context}\n\n`;
			}
			input += command;

			logger.debug(`[Session ${this.sessionId}] Spawning claude --print --continue...`);

			// Spawn fresh Claude process with --print and --continue flags
			const claudeProcess = spawn('claude', ['--print', '--continue'], {
				cwd: this.workingDirectory,
				stdio: ['pipe', 'pipe', 'pipe'],
				env: { ...process.env, ...this.envVars },
			});

			const pid = claudeProcess.pid;
			logger.info(`[Session ${this.sessionId}] Claude process spawned with PID:`, pid);

			let stdout = '';
			let stderr = '';

			// Set up timeout
			const timeoutId = setTimeout(() => {
				logger.error(`[Session ${this.sessionId}] Command timeout after ${this.commandTimeout}ms`);
				claudeProcess.kill('SIGKILL');
				reject(new Error('Command timeout'));
			}, this.commandTimeout);

			// Collect stdout
			claudeProcess.stdout!.on('data', (data: Buffer) => {
				const text = data.toString();
				logger.debug(`[Session ${this.sessionId}] stdout:`, text.substring(0, 200));
				stdout += text;
			});

			// Collect stderr
			claudeProcess.stderr!.on('data', (data: Buffer) => {
				const text = data.toString();
				logger.debug(`[Session ${this.sessionId}] stderr:`, text.substring(0, 200));
				stderr += text;
			});

			// Handle process exit
			claudeProcess.on('exit', (code: number | null) => {
				clearTimeout(timeoutId);
				logger.info(`[Session ${this.sessionId}] Process exited with code:`, code);

				if (code === 0 && stdout.length > 0) {
					// Success
					const cleaned = this.cleanResponse(stdout);
					logger.info(`[Session ${this.sessionId}] Command successful, response length:`, cleaned.length);
					logger.debug(`[Session ${this.sessionId}] Response preview:`, cleaned.substring(0, 200));
					resolve(cleaned);
				} else if (stderr.length > 0) {
					// Error
					logger.error(`[Session ${this.sessionId}] Command failed:`, stderr);
					reject(new Error(`Claude error: ${stderr}`));
				} else {
					// No output
					logger.warn(`[Session ${this.sessionId}] No output received`);
					reject(new Error('No response from Claude'));
				}
			});

			// Handle spawn errors
			claudeProcess.on('error', (error: Error) => {
				clearTimeout(timeoutId);
				logger.error(`[Session ${this.sessionId}] Spawn error:`, error.message);
				reject(new Error(`Failed to spawn Claude: ${error.message}`));
			});

			// Write input and close stdin
			try {
				logger.debug(`[Session ${this.sessionId}] Writing to stdin...`);
				claudeProcess.stdin!.write(input);
				claudeProcess.stdin!.end();
				logger.debug(`[Session ${this.sessionId}] Input sent, stdin closed`);
			} catch (error) {
				clearTimeout(timeoutId);
				logger.error(`[Session ${this.sessionId}] Error writing to stdin:`, error);
				claudeProcess.kill('SIGKILL');
				reject(error);
			}
		});
	}

	/**
	 * Stop the session (mark as inactive)
	 */
	async stop(): Promise<void> {
		logger.info(`[Session ${this.sessionId}] Stopping session...`);
		this.isActive = false;
		// No long-running process to kill
		logger.info(`[Session ${this.sessionId}] Session stopped`);
	}

	/**
	 * Check if session is active
	 */
	isRunning(): boolean {
		return this.isActive;
	}

	/**
	 * Get the session ID
	 */
	getSessionId(): string {
		return this.sessionId;
	}

	/**
	 * Get PID (always undefined as we don't maintain long-running process)
	 */
	getPid(): number | undefined {
		return undefined;
	}

	/**
	 * Clean response text
	 */
	private cleanResponse(text: string): string {
		// Strip ANSI codes
		let cleaned = stripAnsiCodes(text);

		// Remove common prompt patterns
		cleaned = cleaned.replace(/^[\s\n]*>[\s]*/g, '');
		cleaned = cleaned.replace(/\$[\s]*$/g, '');

		// Trim whitespace
		cleaned = cleaned.trim();

		return cleaned;
	}
}

/**
 * Manages multiple Claude Shell processes
 */
export class ClaudeProcessManager {
	private processes: Map<string, ClaudeProcess> = new Map();
	private commandTimeout: number;

	constructor(commandTimeout: number = 30000) {
		this.commandTimeout = commandTimeout;
	}

	/**
	 * Create a new managed Claude process session (spawns new process)
	 */
	async createSession(
		sessionId: string,
		workingDir: string,
		envVars?: Record<string, string>
	): Promise<ClaudeProcess> {
		logger.info(`[ProcessManager] Creating new managed session:`, sessionId);
		logger.debug(`[ProcessManager] Working directory:`, workingDir);

		if (this.processes.has(sessionId)) {
			logger.error(`[ProcessManager] Session already exists:`, sessionId);
			throw new Error(`Session ${sessionId} already exists`);
		}

		const process = new ClaudeProcess(
			{
				sessionId,
				workingDirectory: workingDir,
				envVars,
			},
			this.commandTimeout,
			'managed'
		);

		await process.start();
		this.processes.set(sessionId, process);
		logger.info(`[ProcessManager] Managed session created successfully, total sessions:`, this.processes.size);

		return process;
	}

	/**
	 * Create a bridge session (connects to existing user-started Claude shell)
	 */
	async createBridgeSession(
		sessionId: string,
		workingDir: string,
		bridgeMetadata: BridgeSessionMetadata
	): Promise<ClaudeProcess> {
		logger.info(`[ProcessManager] Creating bridge session:`, sessionId);
		logger.debug(`[ProcessManager] Bridge pipes:`, {
			input: bridgeMetadata.inputPipe,
			output: bridgeMetadata.outputPipe,
		});

		if (this.processes.has(sessionId)) {
			logger.error(`[ProcessManager] Session already exists:`, sessionId);
			throw new Error(`Session ${sessionId} already exists`);
		}

		const process = new ClaudeProcess(
			{
				sessionId,
				workingDirectory: workingDir,
			},
			this.commandTimeout,
			'bridge',
			bridgeMetadata
		);

		await process.start();
		this.processes.set(sessionId, process);
		logger.info(`[ProcessManager] Bridge session created successfully, total sessions:`, this.processes.size);

		return process;
	}

	/**
	 * Get an existing session
	 */
	getSession(sessionId: string): ClaudeProcess | undefined {
		return this.processes.get(sessionId);
	}

	/**
	 * Get all active sessions
	 */
	getAllSessions(): ClaudeProcess[] {
		return Array.from(this.processes.values());
	}

	/**
	 * Terminate a specific session
	 */
	async terminateSession(sessionId: string): Promise<void> {
		logger.info(`[ProcessManager] Terminating session:`, sessionId);
		const process = this.processes.get(sessionId);
		if (process) {
			await process.stop();
			this.processes.delete(sessionId);
			logger.info(`[ProcessManager] Session terminated, remaining sessions:`, this.processes.size);
		} else {
			logger.warn(`[ProcessManager] Session not found:`, sessionId);
		}
	}

	/**
	 * Terminate all sessions
	 */
	async terminateAll(): Promise<void> {
		logger.info(`[ProcessManager] Terminating all sessions, count:`, this.processes.size);
		const promises = Array.from(this.processes.values()).map((process) =>
			process.stop()
		);
		await Promise.all(promises);
		this.processes.clear();
		logger.info(`[ProcessManager] All sessions terminated`);
	}

	/**
	 * Check if a session exists and is running
	 */
	hasSession(sessionId: string): boolean {
		const process = this.processes.get(sessionId);
		return process !== undefined && process.isRunning();
	}

	/**
	 * Get the number of active sessions
	 */
	getSessionCount(): number {
		return this.processes.size;
	}
}
