/**
 * Simplified session manager - single default session only
 */

import { ClaudeProcessManager } from './process-manager';
import { resolveWorkingDirectory } from './utils';
import { logger } from './logger';

const DEFAULT_SESSION_ID = 'default';
const DEFAULT_SESSION_NAME = 'Default Session';

/**
 * Manages a single default Claude session
 */
export class DefaultSessionManager {
	private processManager: ClaudeProcessManager;
	private workingDirectory: string;
	private isInitialized: boolean = false;

	constructor(processManager: ClaudeProcessManager, workingDirectory: string) {
		this.processManager = processManager;
		this.workingDirectory = resolveWorkingDirectory(workingDirectory);
		logger.info('[DefaultSessionManager] Created with working directory:', this.workingDirectory);
	}

	/**
	 * Update the working directory (from settings)
	 */
	setWorkingDirectory(workingDirectory: string): void {
		this.workingDirectory = resolveWorkingDirectory(workingDirectory);
		logger.debug('[DefaultSessionManager] Working directory updated:', this.workingDirectory);
	}

	/**
	 * Get the session ID
	 */
	getSessionId(): string {
		return DEFAULT_SESSION_ID;
	}

	/**
	 * Ensure the default session exists and is running
	 * Creates it if it doesn't exist
	 */
	async ensureSession(): Promise<void> {
		logger.debug('[DefaultSessionManager] Ensuring session exists...');

		// Check if process already exists and is running
		const existingProcess = this.processManager.getSession(DEFAULT_SESSION_ID);
		if (existingProcess && existingProcess.isRunning()) {
			logger.debug('[DefaultSessionManager] Session already running');
			this.isInitialized = true;
			return;
		}

		// Create new session
		logger.info('[DefaultSessionManager] Creating default session...');
		try {
			await this.processManager.createSession(DEFAULT_SESSION_ID, this.workingDirectory);
			this.isInitialized = true;
			logger.info('[DefaultSessionManager] Default session created successfully');
		} catch (error) {
			logger.error('[DefaultSessionManager] Failed to create session:', error);
			throw error;
		}
	}

	/**
	 * Check if session is ready
	 */
	isReady(): boolean {
		if (!this.isInitialized) return false;
		const process = this.processManager.getSession(DEFAULT_SESSION_ID);
		return process !== undefined && process.isRunning();
	}

	/**
	 * Execute a command on the default session
	 * @param command - The user's command/request
	 * @param selectedText - The text the user selected (if any)
	 * @param filePath - Path to the file being edited (Feature 007)
	 */
	async executeCommand(command: string, selectedText?: string, filePath?: string): Promise<string> {
		logger.info('[DefaultSessionManager] Executing command...');
		logger.debug('[DefaultSessionManager] File path:', filePath || 'none');

		// Ensure session exists
		await this.ensureSession();

		const process = this.processManager.getSession(DEFAULT_SESSION_ID);
		if (!process) {
			throw new Error('Failed to get session process');
		}

		return await process.sendCommand(command, selectedText, filePath);
	}

	/**
	 * Terminate the session
	 */
	async terminate(): Promise<void> {
		logger.info('[DefaultSessionManager] Terminating session...');
		if (this.processManager.hasSession(DEFAULT_SESSION_ID)) {
			await this.processManager.terminateSession(DEFAULT_SESSION_ID);
		}
		this.isInitialized = false;
		logger.info('[DefaultSessionManager] Session terminated');
	}

	/**
	 * Get session status for display
	 */
	getStatus(): { ready: boolean; workingDirectory: string } {
		return {
			ready: this.isReady(),
			workingDirectory: this.workingDirectory,
		};
	}
}
