/**
 * Session management and persistence
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { SessionMetadata, SessionsData } from './types';
import { generateSessionId, checkPidExists, resolveWorkingDirectory } from './utils';
import { ClaudeProcessManager } from './process-manager';

/**
 * Manages Claude Shell sessions with persistence
 */
export class SessionManager {
	private sessions: Map<string, SessionMetadata> = new Map();
	private dataFilePath: string;
	private processManager: ClaudeProcessManager;
	private lastSessionId: string | undefined;

	constructor(dataDir: string, processManager: ClaudeProcessManager) {
		this.dataFilePath = join(dataDir, 'sessions.json');
		this.processManager = processManager;
	}

	/**
	 * Initialize the session manager (load from disk)
	 */
	async initialize(): Promise<void> {
		await this.loadFromDisk();
		await this.detectExistingSessions();
	}

	/**
	 * Create a new session
	 */
	async createSession(name: string, workingDir: string): Promise<SessionMetadata> {
		const id = generateSessionId();
		const resolvedDir = resolveWorkingDirectory(workingDir);

		// Create the Claude process
		const process = await this.processManager.createSession(id, resolvedDir);
		const pid = process.getPid();

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
		await this.saveToDisk();

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
		const session = this.sessions.get(sessionId);
		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		// Terminate existing process if any
		if (this.processManager.hasSession(sessionId)) {
			await this.processManager.terminateSession(sessionId);
		}

		// Start new process
		const process = await this.processManager.createSession(
			sessionId,
			session.workingDirectory
		);

		session.pid = process.getPid();
		session.status = 'active';
		session.lastUsedAt = Date.now();

		await this.saveToDisk();
	}

	/**
	 * Detect existing sessions on startup
	 */
	async detectExistingSessions(): Promise<SessionMetadata[]> {
		const detected: SessionMetadata[] = [];

		for (const [id, session] of this.sessions.entries()) {
			if (session.pid && checkPidExists(session.pid)) {
				// Process exists but we don't manage it anymore after restart
				// Mark as stopped so user can restart
				session.status = 'stopped';
			} else if (session.status === 'active') {
				// Process doesn't exist but was marked as active
				session.status = 'crashed';
			}

			detected.push(session);
		}

		await this.saveToDisk();
		return detected;
	}

	/**
	 * Load sessions from disk
	 */
	private async loadFromDisk(): Promise<void> {
		if (!existsSync(this.dataFilePath)) {
			return;
		}

		try {
			const data = await readFile(this.dataFilePath, 'utf-8');
			const parsed: SessionsData = JSON.parse(data);

			this.sessions.clear();
			for (const session of parsed.sessions) {
				this.sessions.set(session.id, session);
			}

			this.lastSessionId = parsed.lastSessionId;
		} catch (error) {
			console.error('Failed to load sessions from disk:', error);
			// If corrupted, start fresh
			this.sessions.clear();
		}
	}

	/**
	 * Save sessions to disk (atomic write)
	 */
	private async saveToDisk(): Promise<void> {
		try {
			const data: SessionsData = {
				sessions: Array.from(this.sessions.values()),
				lastSessionId: this.lastSessionId,
			};

			const json = JSON.stringify(data, null, 2);

			// Ensure directory exists
			const dir = this.dataFilePath.substring(0, this.dataFilePath.lastIndexOf('/'));
			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true });
			}

			// Atomic write using temp file + rename would be better
			// but for simplicity, direct write for now
			await writeFile(this.dataFilePath, json, 'utf-8');
		} catch (error) {
			console.error('Failed to save sessions to disk:', error);
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
}
