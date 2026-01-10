/**
 * Process management for Claude Shell instances
 */

import { spawn, ChildProcess } from 'child_process';
import { ClaudeProcessOptions, FileContext } from './types';
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
	 * @param fileContext - File context including path and content
	 */
	async sendCommand(command: string, selectedText?: string, fileContext?: FileContext): Promise<string> {
		logger.info(`[Session ${this.sessionId}] Executing command:`, command.substring(0, 100));

		if (!this.isActive) {
			logger.error(`[Session ${this.sessionId}] Session not active`);
			throw new Error('Session not active');
		}

		return new Promise((resolve, reject) => {
			// Build the prompt with file context (Feature 007)
			const input = this.buildPrompt(command, selectedText, fileContext);
			logger.debug(`[Session ${this.sessionId}] Built prompt, length:`, input.length);

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

	/**
	 * Build the prompt with file context (Feature 007)
	 * Format:
	 * You are helping edit a file in Obsidian.
	 *
	 * File: {{filepath}}
	 * ---
	 * {{file content}}
	 * ---
	 *
	 * Selected text: {{selection or "none"}}
	 *
	 * User request: {{command}}
	 */
	private buildPrompt(command: string, selectedText?: string, fileContext?: FileContext): string {
		const parts: string[] = [];

		// System context
		parts.push('You are helping edit a file in Obsidian.');
		parts.push('');

		// File context if available
		if (fileContext) {
			parts.push(`File: ${fileContext.filePath}`);
			if (fileContext.truncated) {
				parts.push('[File truncated - showing first 50KB]');
			}
			parts.push('---');
			parts.push(fileContext.fileContent);
			parts.push('---');
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
