/**
 * Process management for Claude Shell instances
 */

import { spawn, ChildProcess } from 'child_process';
import { ClaudeProcessOptions } from './types';
import { stripAnsiCodes } from './utils';

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
			throw new Error('Process already started');
		}

		this.readyPromise = new Promise((resolve, reject) => {
			try {
				// Spawn Claude process with pipes
				this.process = spawn('claude', [], {
					cwd: this.workingDirectory,
					stdio: ['pipe', 'pipe', 'pipe'],
					env: { ...process.env, ...this.envVars },
				});

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
					reject(new Error(`Failed to spawn Claude process: ${error.message}`));
				});

				// Wait for initial output to determine ready state
				// Claude typically outputs some initial text when it starts
				const readyTimeout = setTimeout(() => {
					if (!this.isReady) {
						this.isReady = true;
						resolve();
					}
				}, 2000); // 2 second timeout for ready detection

				// Look for any initial output as a sign of readiness
				const initialOutputHandler = () => {
					clearTimeout(readyTimeout);
					this.isReady = true;
					resolve();
					this.process?.stdout?.off('data', initialOutputHandler);
				};

				this.process.stdout?.once('data', initialOutputHandler);

			} catch (error) {
				reject(error);
			}
		});

		return this.readyPromise;
	}

	/**
	 * Send a command to Claude and wait for response
	 */
	async sendCommand(command: string, context?: string): Promise<string> {
		if (!this.process || !this.isReady) {
			throw new Error('Process not ready');
		}

		if (this.pendingCommand) {
			throw new Error('Another command is already in progress');
		}

		return new Promise((resolve, reject) => {
			// Clear output buffer
			this.outputBuffer = '';

			// Set up timeout
			const timeoutId = setTimeout(() => {
				this.pendingCommand = null;
				reject(new Error('Command timeout'));
			}, this.commandTimeout);

			// Store pending command info
			this.pendingCommand = { resolve, reject, timeoutId };

			try {
				// Send context if provided (using /paste command)
				if (context) {
					this.process!.stdin!.write('/paste\n');
					this.process!.stdin!.write(context + '\n');
				}

				// Send the actual command
				this.process!.stdin!.write(command + '\n');
			} catch (error) {
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
			return;
		}

		return new Promise((resolve) => {
			const cleanup = () => {
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
				this.process!.stdin!.write('/exit\n');
			} catch {
				// Ignore errors when trying to exit gracefully
			}

			// Force kill after timeout
			const killTimeout = setTimeout(() => {
				if (this.process) {
					this.process.kill('SIGKILL');
				}
				cleanup();
			}, 5000);

			this.process!.once('exit', () => {
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
		this.outputBuffer += text;

		// If we have a pending command, check if response is complete
		if (this.pendingCommand) {
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
		const checkTimer = setTimeout(() => {
			if (this.pendingCommand && this.outputBuffer.length > 0) {
				const response = this.cleanResponse(this.outputBuffer);
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
		console.error(`Claude process stderr: ${text}`);

		// If this looks like a critical error and we have a pending command, reject it
		if (this.pendingCommand && text.toLowerCase().includes('error')) {
			clearTimeout(this.pendingCommand.timeoutId);
			this.pendingCommand.reject(new Error(`Claude error: ${text}`));
			this.pendingCommand = null;
		}
	}

	/**
	 * Handle process exit
	 */
	private handleExit(code: number | null): void {
		console.log(`Claude process exited with code ${code}`);

		// If we have a pending command, reject it
		if (this.pendingCommand) {
			clearTimeout(this.pendingCommand.timeoutId);
			this.pendingCommand.reject(new Error('Process exited unexpectedly'));
			this.pendingCommand = null;
		}

		this.process = null;
		this.isReady = false;
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
		if (this.processes.has(sessionId)) {
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
		const process = this.processes.get(sessionId);
		if (process) {
			await process.stop();
			this.processes.delete(sessionId);
		}
	}

	/**
	 * Terminate all sessions
	 */
	async terminateAll(): Promise<void> {
		const promises = Array.from(this.processes.values()).map((process) =>
			process.stop()
		);
		await Promise.all(promises);
		this.processes.clear();
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
