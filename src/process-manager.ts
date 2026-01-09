/**
 * Process management for Claude Shell instances
 */

import { spawn, ChildProcess } from 'child_process';
import { ClaudeProcessOptions } from './types';
import { stripAnsiCodes } from './utils';
import { logger } from './logger';

/**
 * Manages a single Claude Shell process
 */
export class ClaudeProcess {
	private process: ChildProcess | null = null;
	private sessionId: string;
	private workingDirectory: string;
	private envVars: Record<string, string>;
	private outputBuffer: string = '';
	private isReady: boolean = false;
	private readyPromise: Promise<void> | null = null;
	private pendingCommand: {
		resolve: (response: string) => void;
		reject: (error: Error) => void;
		timeoutId: NodeJS.Timeout;
	} | null = null;
	private commandTimeout: number = 30000; // 30 seconds

	constructor(options: ClaudeProcessOptions, timeout?: number) {
		this.sessionId = options.sessionId;
		this.workingDirectory = options.workingDirectory;
		this.envVars = options.envVars || {};
		if (timeout) {
			this.commandTimeout = timeout;
		}
	}

	/**
	 * Start the Claude process
	 */
	async start(): Promise<void> {
		if (this.process) {
			logger.error(`[Process ${this.sessionId}] Process already started`);
			throw new Error('Process already started');
		}

		logger.info(`[Process ${this.sessionId}] Starting Claude process...`);
		logger.debug(`[Process ${this.sessionId}] Working directory:`, this.workingDirectory);
		logger.debug(`[Process ${this.sessionId}] Environment vars:`, Object.keys(this.envVars));

		this.readyPromise = new Promise((resolve, reject) => {
			try {
				// Spawn Claude process with pipes
				logger.debug(`[Process ${this.sessionId}] Spawning 'claude' command...`);
				this.process = spawn('claude', [], {
					cwd: this.workingDirectory,
					stdio: ['pipe', 'pipe', 'pipe'],
					env: { ...process.env, ...this.envVars },
				});

				const pid = this.process.pid;
				logger.info(`[Process ${this.sessionId}] Claude process spawned with PID:`, pid);

				// Set up stdout handler
				this.process.stdout?.on('data', (data: Buffer) => {
					this.handleOutput(data);
				});

				// Set up stderr handler
				this.process.stderr?.on('data', (data: Buffer) => {
					this.handleError(data);
				});

				// Set up exit handler
				this.process.on('exit', (code: number | null) => {
					this.handleExit(code);
				});

				// Set up error handler for spawn failures
				this.process.on('error', (error: Error) => {
					logger.error(`[Process ${this.sessionId}] Spawn error:`, error.message);
					reject(new Error(`Failed to spawn Claude process: ${error.message}`));
				});

				// Wait for initial output to determine ready state
				// Claude typically outputs some initial text when it starts
				logger.debug(`[Process ${this.sessionId}] Waiting for ready state...`);
				const readyTimeout = setTimeout(() => {
					if (!this.isReady) {
						logger.warn(`[Process ${this.sessionId}] Ready timeout reached, assuming ready`);
						this.isReady = true;
						resolve();
					}
				}, 2000); // 2 second timeout for ready detection

				// Look for any initial output as a sign of readiness
				const initialOutputHandler = () => {
					logger.info(`[Process ${this.sessionId}] Process is ready (received initial output)`);
					clearTimeout(readyTimeout);
					this.isReady = true;
					resolve();
					this.process?.stdout?.off('data', initialOutputHandler);
				};

				this.process.stdout?.once('data', initialOutputHandler);

			} catch (error) {
				logger.error(`[Process ${this.sessionId}] Exception during start:`, error);
				reject(error);
			}
		});

		return this.readyPromise;
	}

	/**
	 * Send a command to Claude and wait for response
	 */
	async sendCommand(command: string, context?: string): Promise<string> {
		logger.info(`[Process ${this.sessionId}] Sending command:`, command.substring(0, 100));

		if (!this.process || !this.isReady) {
			logger.error(`[Process ${this.sessionId}] Process not ready`);
			throw new Error('Process not ready');
		}

		if (this.pendingCommand) {
			logger.error(`[Process ${this.sessionId}] Another command already in progress`);
			throw new Error('Another command is already in progress');
		}

		if (context) {
			logger.debug(`[Process ${this.sessionId}] Context provided, length:`, context.length);
		}

		return new Promise((resolve, reject) => {
			// Clear output buffer
			this.outputBuffer = '';
			logger.debug(`[Process ${this.sessionId}] Output buffer cleared`);

			// Set up timeout
			const timeoutId = setTimeout(() => {
				logger.error(`[Process ${this.sessionId}] Command timeout after ${this.commandTimeout}ms`);
				this.pendingCommand = null;
				reject(new Error('Command timeout'));
			}, this.commandTimeout);

			// Store pending command info
			this.pendingCommand = { resolve, reject, timeoutId };
			logger.debug(`[Process ${this.sessionId}] Pending command registered, timeout: ${this.commandTimeout}ms`);

			try {
				// Send context if provided (using /paste command)
				if (context) {
					logger.debug(`[Process ${this.sessionId}] Sending /paste command...`);
					this.process!.stdin!.write('/paste\n');
					this.process!.stdin!.write(context + '\n');
					logger.debug(`[Process ${this.sessionId}] Context sent`);
				}

				// Send the actual command
				logger.debug(`[Process ${this.sessionId}] Sending command to stdin...`);
				this.process!.stdin!.write(command + '\n');
				logger.info(`[Process ${this.sessionId}] Command sent successfully`);
			} catch (error) {
				logger.error(`[Process ${this.sessionId}] Error writing to stdin:`, error);
				clearTimeout(timeoutId);
				this.pendingCommand = null;
				reject(error);
			}
		});
	}

	/**
	 * Stop the Claude process gracefully
	 */
	async stop(): Promise<void> {
		if (!this.process) {
			logger.debug(`[Process ${this.sessionId}] No process to stop`);
			return;
		}

		logger.info(`[Process ${this.sessionId}] Stopping Claude process...`);
		const pid = this.process.pid;

		return new Promise((resolve) => {
			const cleanup = () => {
				logger.info(`[Process ${this.sessionId}] Process stopped, PID was:`, pid);
				this.process = null;
				this.isReady = false;
				this.outputBuffer = '';
				if (this.pendingCommand) {
					clearTimeout(this.pendingCommand.timeoutId);
					this.pendingCommand.reject(new Error('Process stopped'));
					this.pendingCommand = null;
				}
				resolve();
			};

			// Try graceful shutdown first
			try {
				logger.debug(`[Process ${this.sessionId}] Attempting graceful shutdown with /exit...`);
				this.process!.stdin!.write('/exit\n');
			} catch (error) {
				logger.warn(`[Process ${this.sessionId}] Failed to send /exit:`, error);
				// Ignore errors when trying to exit gracefully
			}

			// Force kill after timeout
			const killTimeout = setTimeout(() => {
				logger.warn(`[Process ${this.sessionId}] Graceful shutdown timeout, force killing...`);
				if (this.process) {
					this.process.kill('SIGKILL');
				}
				cleanup();
			}, 5000);

			this.process!.once('exit', () => {
				logger.debug(`[Process ${this.sessionId}] Process exited gracefully`);
				clearTimeout(killTimeout);
				cleanup();
			});
		});
	}

	/**
	 * Check if process is running
	 */
	isRunning(): boolean {
		return this.process !== null && !this.process.killed;
	}

	/**
	 * Get the process ID
	 */
	getPid(): number | undefined {
		return this.process?.pid;
	}

	/**
	 * Get the session ID
	 */
	getSessionId(): string {
		return this.sessionId;
	}

	/**
	 * Handle stdout data
	 */
	private handleOutput(data: Buffer): void {
		const text = data.toString();
		logger.debug(`[Process ${this.sessionId}] stdout:`, text.substring(0, 200));
		this.outputBuffer += text;

		// If we have a pending command, check if response is complete
		if (this.pendingCommand) {
			logger.debug(`[Process ${this.sessionId}] Output received during pending command, scheduling completion check`);
			// Simple heuristic: look for a pause in output or a prompt-like pattern
			// This is a simplified version - real implementation might need more sophisticated detection
			// For now, we'll use a timer-based approach
			this.scheduleResponseCompletion();
		}
	}

	/**
	 * Schedule response completion check
	 */
	private scheduleResponseCompletion(): void {
		if (!this.pendingCommand) {
			return;
		}

		// Wait for output to stabilize (no new data for 500ms)
		// This is a simple approach - could be improved with better prompt detection
		logger.debug(`[Process ${this.sessionId}] Scheduling response completion check (500ms idle detection)`);
		const checkTimer = setTimeout(() => {
			if (this.pendingCommand && this.outputBuffer.length > 0) {
				logger.info(`[Process ${this.sessionId}] Response complete (500ms idle), buffer size:`, this.outputBuffer.length);
				const response = this.cleanResponse(this.outputBuffer);
				logger.debug(`[Process ${this.sessionId}] Cleaned response length:`, response.length);
				clearTimeout(this.pendingCommand.timeoutId);
				this.pendingCommand.resolve(response);
				this.pendingCommand = null;
				this.outputBuffer = '';
			}
		}, 500);

		// Store timer so we can cancel it if more data arrives
		if (this.pendingCommand) {
			const oldTimeout = this.pendingCommand.timeoutId;
			this.pendingCommand.timeoutId = checkTimer;
			clearTimeout(oldTimeout);
		}
	}

	/**
	 * Handle stderr data
	 */
	private handleError(data: Buffer): void {
		const text = data.toString();
		logger.warn(`[Process ${this.sessionId}] stderr:`, text);

		// If this looks like a critical error and we have a pending command, reject it
		if (this.pendingCommand && text.toLowerCase().includes('error')) {
			logger.error(`[Process ${this.sessionId}] Critical error detected in stderr, rejecting pending command`);
			clearTimeout(this.pendingCommand.timeoutId);
			this.pendingCommand.reject(new Error(`Claude error: ${text}`));
			this.pendingCommand = null;
		}
	}

	/**
	 * Handle process exit
	 */
	private handleExit(code: number | null): void {
		logger.warn(`[Process ${this.sessionId}] Process exited with code:`, code);

		// If we have a pending command, reject it
		if (this.pendingCommand) {
			logger.error(`[Process ${this.sessionId}] Process exited with pending command, rejecting`);
			clearTimeout(this.pendingCommand.timeoutId);
			this.pendingCommand.reject(new Error('Process exited unexpectedly'));
			this.pendingCommand = null;
		}

		this.process = null;
		this.isReady = false;
		logger.info(`[Process ${this.sessionId}] Process cleanup complete`);
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
	 * Create a new Claude process session
	 */
	async createSession(
		sessionId: string,
		workingDir: string,
		envVars?: Record<string, string>
	): Promise<ClaudeProcess> {
		logger.info(`[ProcessManager] Creating new session:`, sessionId);
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
			this.commandTimeout
		);

		await process.start();
		this.processes.set(sessionId, process);
		logger.info(`[ProcessManager] Session created successfully, total sessions:`, this.processes.size);

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
