/**
 * Process management for Claude Shell instances
 */

import { spawn, ChildProcess } from 'child_process';
import { ClaudeProcessOptions } from './types';
import { stripAnsiCodes } from './utils';
import { logger } from './logger';

/**
 * Manages a Claude session (spawns fresh process for each command)
 */
export class ClaudeProcess {
	private sessionId: string;
	private workingDirectory: string;
	private envVars: Record<string, string>;
	private commandTimeout: number = 30000; // 30 seconds
	private isActive: boolean = true;
	private currentProcess: ChildProcess | null = null;
	private currentReject: ((err: Error) => void) | null = null;
	private spawnedPids: Set<number> = new Set();

	constructor(options: ClaudeProcessOptions, timeout?: number) {
		this.sessionId = options.sessionId;
		this.workingDirectory = options.workingDirectory;
		this.envVars = options.envVars || {};
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
	 * Send a command to Claude (spawns fresh process with --print mode)
	 * @param command - The user's command/request
	 * @param selectedText - The text the user selected (if any)
	 * @param filePath - Path to the file being edited (Feature 007)
	 */
	async sendCommand(command: string, selectedText?: string, filePath?: string, autoStopOnTimeout: boolean = true): Promise<string> {
		logger.info(`[Session ${this.sessionId}] Executing command:`, command.substring(0, 100));

		if (!this.isActive) {
			logger.error(`[Session ${this.sessionId}] Session not active`);
			throw new Error('Session not active');
		}

		return new Promise((resolve, reject) => {
			// Build the prompt with file path (Feature 007)
			const input = this.buildPrompt(command, selectedText, filePath);
			logger.debug(`[Session ${this.sessionId}] Built prompt, length:`, input.length);

			logger.debug(`[Session ${this.sessionId}] Spawning claude --print --continue...`);

			// Spawn fresh Claude process with --print and --continue flags
			const claudeProcess = spawn('claude', ['--print', '--continue'], {
				cwd: this.workingDirectory,
				stdio: ['pipe', 'pipe', 'pipe'],
				env: { ...process.env, ...this.envVars },
			});

			// Store refs for abort support
			this.currentProcess = claudeProcess;
			this.currentReject = reject;

			const pid = claudeProcess.pid;
			if (pid) {
				this.spawnedPids.add(pid);
			}
			logger.info(`[Session ${this.sessionId}] Claude process spawned with PID:`, pid);

			let stdout = '';
			let stderr = '';
			let settled = false;

			// Clean up process resources to prevent zombie accumulation.
			// Destroys stdio streams, removes listeners, and clears refs
			// so the kernel can reap the child process entry.
			const cleanup = () => {
				if (pid) this.spawnedPids.delete(pid);
				this.currentProcess = null;
				this.currentReject = null;
				claudeProcess.stdout?.destroy();
				claudeProcess.stderr?.destroy();
				claudeProcess.removeAllListeners();
			};

			// Set up timeout only when auto-stop is enabled
			let timeoutId: ReturnType<typeof setTimeout> | null = null;
			if (autoStopOnTimeout) {
				timeoutId = setTimeout(() => {
					logger.error(`[Session ${this.sessionId}] Command timeout after ${this.commandTimeout}ms`);
					claudeProcess.kill('SIGKILL');
					// cleanup happens in 'close' handler
				}, this.commandTimeout);
			} else {
				logger.info(`[Session ${this.sessionId}] Auto-stop disabled, no timeout set`);
			}

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

			// Use 'close' instead of 'exit' — 'close' fires after stdio streams
			// are fully drained AND the kernel process entry is reaped (waitpid),
			// which prevents zombie process accumulation.
			claudeProcess.on('close', (code: number | null) => {
				if (timeoutId) clearTimeout(timeoutId);
				cleanup();

				if (settled) return;
				settled = true;

				logger.info(`[Session ${this.sessionId}] Process closed with code:`, code);

				if (code === 0 && stdout.length > 0) {
					const cleaned = this.cleanResponse(stdout);
					logger.info(`[Session ${this.sessionId}] Command successful, response length:`, cleaned.length);
					logger.debug(`[Session ${this.sessionId}] Response preview:`, cleaned.substring(0, 200));
					resolve(cleaned);
				} else if (stderr.length > 0) {
					logger.error(`[Session ${this.sessionId}] Command failed:`, stderr);
					reject(new Error(`Claude error: ${stderr}`));
				} else {
					logger.warn(`[Session ${this.sessionId}] No output received`);
					reject(new Error('No response from Claude'));
				}
			});

			// Handle spawn errors
			claudeProcess.on('error', (error: Error) => {
				if (timeoutId) clearTimeout(timeoutId);
				cleanup();

				if (settled) return;
				settled = true;

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
				if (timeoutId) clearTimeout(timeoutId);
				cleanup();
				settled = true;
				logger.error(`[Session ${this.sessionId}] Error writing to stdin:`, error);
				claudeProcess.kill('SIGKILL');
				reject(error);
			}
		});
	}

	/**
	 * Abort the currently running command
	 */
	abortCommand(): void {
		if (this.currentProcess) {
			logger.info(`[Session ${this.sessionId}] Aborting current command`);
			const proc = this.currentProcess;
			const rej = this.currentReject;
			this.currentProcess = null;
			this.currentReject = null;
			proc.kill('SIGKILL');
			if (rej) {
				rej(new Error('Command stopped by user'));
			}
		} else {
			logger.debug(`[Session ${this.sessionId}] No active command to abort`);
		}
	}

	/**
	 * Stop the session and kill any lingering spawned processes
	 */
	async stop(): Promise<void> {
		logger.info(`[Session ${this.sessionId}] Stopping session...`);
		this.isActive = false;

		// Abort active command if any
		if (this.currentProcess) {
			this.abortCommand();
		}

		// Kill any spawned processes still alive
		for (const pid of this.spawnedPids) {
			try {
				process.kill(pid, 0); // Check if alive
				logger.info(`[Session ${this.sessionId}] Killing orphaned process PID:`, pid);
				process.kill(pid, 'SIGKILL');
			} catch {
				// Process already dead, ignore
			}
		}
		this.spawnedPids.clear();

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

	/**
	 * Build the prompt with file path (Feature 007)
	 * Format:
	 * You are an assistant helping a user in Obsidian.
	 * IMPORTANT: Only respond with text. Do NOT write to or modify any files.
	 * Your response will be inserted into the document by the plugin.
	 * You may read the file "{{filepath}}" for context if needed.
	 *
	 * File being edited: {{filepath}}
	 *
	 * Selected text: {{selection or "none"}}
	 *
	 * User request: {{command}}
	 */
	private buildPrompt(command: string, selectedText?: string, filePath?: string): string {
		const parts: string[] = [];

		// System context - be explicit about output expectations
		parts.push('You are an assistant helping a user in Obsidian.');
		parts.push('IMPORTANT: Only respond with text. Do NOT write to or modify any files.');
		parts.push('Your response will be inserted into the document by the plugin.');
		if (filePath) {
			parts.push(`You may read the file "${filePath}" for context if needed.`);
		}
		parts.push('');

		// File path if available (for context only)
		if (filePath) {
			parts.push(`File being edited: ${filePath}`);
			parts.push('');
		}

		// Selected text
		const selection = selectedText && selectedText.length > 0 ? selectedText : 'none';
		parts.push(`Selected text: ${selection}`);
		parts.push('');

		// User request
		parts.push(`User request: ${command}`);

		return parts.join('\n');
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
	 * Abort the current command on a session
	 */
	abortSession(sessionId: string): void {
		const process = this.processes.get(sessionId);
		if (process) {
			process.abortCommand();
		} else {
			logger.warn(`[ProcessManager] Session not found for abort:`, sessionId);
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
