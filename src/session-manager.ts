/**
 * Session management and persistence
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { SessionMetadata, SessionsData } from './types';
import { generateSessionId, checkPidExists, resolveWorkingDirectory, findRunningClaudeProcesses } from './utils';
import { ClaudeProcessManager } from './process-manager';
import { logger } from './logger';

/**
 * Manages Claude Shell sessions with persistence
 */
export class SessionManager {
	private sessions: Map<string, SessionMetadata> = new Map();
	private dataFilePath: string;
	private processManager: ClaudeProcessManager;
	private lastSessionId: string | undefined;
	private retentionDays: number = 0; // 0 = keep forever

	constructor(dataDir: string, processManager: ClaudeProcessManager) {
		this.dataFilePath = join(dataDir, 'sessions.json');
		this.processManager = processManager;
	}

	/**
	 * Set the session retention period in days (0 = keep forever)
	 */
	setRetentionDays(days: number): void {
		this.retentionDays = days;
		logger.debug('[SessionManager] Retention days set to:', days);
	}

	/**
	 * Initialize the session manager (load from disk)
	 */
	async initialize(): Promise<void> {
		logger.info('[SessionManager] Initializing session manager...');
		await this.loadFromDisk();
		logger.info('[SessionManager] Loaded sessions from disk, count:', this.sessions.size);
		await this.detectExistingSessions();
		logger.info('[SessionManager] Session manager initialized');
	}

	/**
	 * Create a new session
	 */
	async createSession(name: string, workingDir: string): Promise<SessionMetadata> {
		const id = generateSessionId();
		logger.info('[SessionManager] Creating new session:', { id, name, workingDir });
		const resolvedDir = resolveWorkingDirectory(workingDir);
		logger.debug('[SessionManager] Resolved working directory:', resolvedDir);

		// Create the Claude process
		logger.debug('[SessionManager] Creating Claude process...');
		const process = await this.processManager.createSession(id, resolvedDir);
		const pid = process.getPid();
		logger.info('[SessionManager] Claude process created, PID:', pid);

		const session: SessionMetadata = {
			id,
			name,
			workingDirectory: resolvedDir,
			createdAt: Date.now(),
			lastUsedAt: Date.now(),
			status: 'active',
			pid,
			commandHistory: [],
		};

		this.sessions.set(id, session);
		this.lastSessionId = id;
		logger.debug('[SessionManager] Saving session to disk...');
		await this.saveToDisk();
		logger.info('[SessionManager] Session created successfully, total sessions:', this.sessions.size);

		return session;
	}

	/**
	 * Get a session by ID
	 */
	async getSession(id: string): Promise<SessionMetadata | undefined> {
		return this.sessions.get(id);
	}

	/**
	 * Get all sessions
	 */
	async getAllSessions(): Promise<SessionMetadata[]> {
		return Array.from(this.sessions.values());
	}

	/**
	 * Update a session
	 */
	async updateSession(id: string, updates: Partial<SessionMetadata>): Promise<void> {
		const session = this.sessions.get(id);
		if (!session) {
			throw new Error(`Session ${id} not found`);
		}

		Object.assign(session, updates);
		await this.saveToDisk();
	}

	/**
	 * Delete a session
	 */
	async deleteSession(id: string): Promise<void> {
		// Terminate the process if running
		if (this.processManager.hasSession(id)) {
			await this.processManager.terminateSession(id);
		}

		this.sessions.delete(id);

		if (this.lastSessionId === id) {
			this.lastSessionId = undefined;
		}

		await this.saveToDisk();
	}

	/**
	 * Get the last active session ID
	 */
	getLastSessionId(): string | undefined {
		return this.lastSessionId;
	}

	/**
	 * Add a command to session history
	 */
	async addCommandToHistory(sessionId: string, command: string, maxHistory: number = 10): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return;
		}

		session.commandHistory.push(command);

		// Trim history to maxHistory
		if (session.commandHistory.length > maxHistory) {
			session.commandHistory = session.commandHistory.slice(-maxHistory);
		}

		session.lastUsedAt = Date.now();
		await this.saveToDisk();
	}

	/**
	 * Restart a stopped or crashed session
	 */
	async restartSession(sessionId: string): Promise<void> {
		logger.info('[SessionManager] Restarting session:', sessionId);
		const session = this.sessions.get(sessionId);
		if (!session) {
			logger.error('[SessionManager] Session not found:', sessionId);
			throw new Error(`Session ${sessionId} not found`);
		}
		logger.debug('[SessionManager] Session found:', { name: session.name, status: session.status });

		// Terminate existing process if any
		if (this.processManager.hasSession(sessionId)) {
			logger.debug('[SessionManager] Terminating existing process...');
			await this.processManager.terminateSession(sessionId);
		}

		// Start new process
		logger.debug('[SessionManager] Starting new process...');
		const process = await this.processManager.createSession(
			sessionId,
			session.workingDirectory
		);

		session.pid = process.getPid();
		session.status = 'active';
		session.lastUsedAt = Date.now();
		logger.info('[SessionManager] Session restarted successfully, PID:', session.pid);

		await this.saveToDisk();
	}

	/**
	 * Clean up stale sessions based on:
	 * 1. External sessions that are stopped and process no longer running
	 * 2. Any stopped sessions older than retention period (if set)
	 * Called automatically on startup to prevent session accumulation
	 */
	private async cleanupStaleExternalSessions(): Promise<number> {
		logger.info('[SessionManager] Cleaning up stale sessions...');
		const sessionsToRemove: string[] = [];
		const now = Date.now();
		const retentionMs = this.retentionDays > 0 ? this.retentionDays * 24 * 60 * 60 * 1000 : 0;

		for (const [id, session] of this.sessions.entries()) {
			let shouldRemove = false;
			let reason = '';

			// Check 1: External sessions that are stopped and process no longer running
			if (session.name.startsWith('External Claude') && session.status === 'stopped') {
				if (!session.pid || !checkPidExists(session.pid)) {
					shouldRemove = true;
					reason = 'external session with stopped/missing process';
				}
			}

			// Check 2: Any stopped session older than retention period
			if (!shouldRemove && retentionMs > 0 && session.status === 'stopped') {
				const sessionAge = now - session.lastUsedAt;
				if (sessionAge > retentionMs) {
					shouldRemove = true;
					reason = `session older than ${this.retentionDays} days`;
				}
			}

			if (shouldRemove) {
				logger.debug('[SessionManager] Marking session for removal:', { id, name: session.name, reason });
				sessionsToRemove.push(id);
			}
		}

		// Remove the stale sessions
		for (const id of sessionsToRemove) {
			this.sessions.delete(id);
			logger.info('[SessionManager] Removed stale session:', id);
		}

		if (sessionsToRemove.length > 0) {
			logger.info('[SessionManager] Cleaned up stale sessions, count:', sessionsToRemove.length);
		}

		return sessionsToRemove.length;
	}

	/**
	 * Detect existing sessions on startup
	 */
	async detectExistingSessions(): Promise<SessionMetadata[]> {
		logger.info('[SessionManager] Detecting existing sessions...');

		// First, clean up stale external sessions to prevent accumulation
		await this.cleanupStaleExternalSessions();

		const detected: SessionMetadata[] = [];

		// Check our managed sessions
		for (const [id, session] of this.sessions.entries()) {
			logger.debug('[SessionManager] Checking session:', { id, name: session.name, pid: session.pid, status: session.status });
			if (session.pid && checkPidExists(session.pid)) {
				// Process exists but we don't manage it anymore after restart
				// Mark as stopped so user can restart
				logger.info('[SessionManager] Process still exists but not managed, marking as stopped:', { id, pid: session.pid });
				session.status = 'stopped';
			} else if (session.status === 'active') {
				// Process doesn't exist but was marked as active
				logger.warn('[SessionManager] Process marked active but not running, marking as crashed:', { id, pid: session.pid });
				session.status = 'crashed';
			}

			detected.push(session);
		}

		// Now scan for unmanaged Claude processes on the system
		logger.info('[SessionManager] Scanning for external Claude processes...');
		try {
			const runningProcesses = await findRunningClaudeProcesses();
			logger.info('[SessionManager] Found running Claude processes:', runningProcesses.length);

			// Get all PIDs we already know about
			const managedPids = new Set<number>();
			for (const session of this.sessions.values()) {
				if (session.pid) {
					managedPids.add(session.pid);
				}
			}

			// Find unmanaged processes
			for (const proc of runningProcesses) {
				if (!managedPids.has(proc.pid)) {
					logger.info('[SessionManager] Found unmanaged Claude process:', { pid: proc.pid, command: proc.command, cwd: proc.cwd });

					// Create a session entry for this external process
					const id = generateSessionId();
					const session: SessionMetadata = {
						id,
						name: `External Claude (PID: ${proc.pid})`,
						workingDirectory: proc.cwd || '~',
						createdAt: Date.now(),
						lastUsedAt: Date.now(),
						status: 'stopped', // Mark as stopped since we can't control it
						pid: proc.pid,
						commandHistory: [],
					};

					this.sessions.set(id, session);
					detected.push(session);
					logger.info('[SessionManager] Added external process as session:', id);
				}
			}
		} catch (error) {
			logger.error('[SessionManager] Error scanning for external processes:', error);
		}

		logger.info('[SessionManager] Detection complete, total sessions:', detected.length);
		await this.saveToDisk();
		return detected;
	}

	/**
	 * Load sessions from disk
	 */
	private async loadFromDisk(): Promise<void> {
		logger.debug('[SessionManager] Loading sessions from:', this.dataFilePath);
		if (!existsSync(this.dataFilePath)) {
			logger.info('[SessionManager] No sessions file found, starting fresh');
			return;
		}

		try {
			const data = await readFile(this.dataFilePath, 'utf-8');
			logger.debug('[SessionManager] Read session data, length:', data.length);
			const parsed: SessionsData = JSON.parse(data);

			this.sessions.clear();
			for (const session of parsed.sessions) {
				this.sessions.set(session.id, session);
				logger.debug('[SessionManager] Loaded session:', { id: session.id, name: session.name, status: session.status });
			}

			this.lastSessionId = parsed.lastSessionId;
			logger.info('[SessionManager] Loaded sessions from disk, count:', this.sessions.size);
		} catch (error) {
			logger.error('[SessionManager] Failed to load sessions from disk:', error);
			// If corrupted, start fresh
			this.sessions.clear();
		}
	}

	/**
	 * Save sessions to disk (atomic write)
	 */
	private async saveToDisk(): Promise<void> {
		try {
			logger.debug('[SessionManager] Saving sessions to disk, count:', this.sessions.size);
			const data: SessionsData = {
				sessions: Array.from(this.sessions.values()),
				lastSessionId: this.lastSessionId,
			};

			const json = JSON.stringify(data, null, 2);
			logger.debug('[SessionManager] Serialized JSON length:', json.length);

			// Ensure directory exists
			const dir = this.dataFilePath.substring(0, this.dataFilePath.lastIndexOf('/'));
			if (!existsSync(dir)) {
				logger.debug('[SessionManager] Creating directory:', dir);
				await mkdir(dir, { recursive: true });
			}

			// Atomic write using temp file + rename would be better
			// but for simplicity, direct write for now
			await writeFile(this.dataFilePath, json, 'utf-8');
			logger.debug('[SessionManager] Sessions saved to disk successfully');
		} catch (error) {
			logger.error('[SessionManager] Failed to save sessions to disk:', error);
			throw error;
		}
	}

	/**
	 * Clear all session history
	 */
	async clearAllHistory(): Promise<void> {
		for (const session of this.sessions.values()) {
			session.commandHistory = [];
		}
		await this.saveToDisk();
	}

	/**
	 * Get sessions by status
	 */
	async getSessionsByStatus(status: SessionMetadata['status']): Promise<SessionMetadata[]> {
		return Array.from(this.sessions.values()).filter(s => s.status === status);
	}

	/**
	 * Clear all stopped sessions (both external and user-created)
	 * Returns the number of sessions removed
	 */
	async clearStoppedSessions(): Promise<number> {
		logger.info('[SessionManager] Clearing all stopped sessions...');
		const sessionsToRemove: string[] = [];

		for (const [id, session] of this.sessions.entries()) {
			if (session.status === 'stopped') {
				logger.debug('[SessionManager] Marking stopped session for removal:', { id, name: session.name });
				sessionsToRemove.push(id);
			}
		}

		// Remove the stopped sessions
		for (const id of sessionsToRemove) {
			this.sessions.delete(id);
			if (this.lastSessionId === id) {
				this.lastSessionId = undefined;
			}
		}

		if (sessionsToRemove.length > 0) {
			await this.saveToDisk();
			logger.info('[SessionManager] Cleared stopped sessions, count:', sessionsToRemove.length);
		} else {
			logger.info('[SessionManager] No stopped sessions to clear');
		}

		return sessionsToRemove.length;
	}
}
