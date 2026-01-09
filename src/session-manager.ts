/**
 * Session management and persistence
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SessionMetadata, SessionsData, BridgeSessionMetadata } from './types';
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

	constructor(dataDir: string, processManager: ClaudeProcessManager) {
		this.dataFilePath = join(dataDir, 'sessions.json');
		this.processManager = processManager;
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
		logger.debug('[SessionManager] Session found:', { name: session.name, status: session.status, type: session.type });

		// Bridge sessions can't be restarted (user must restart them)
		if (session.type === 'bridge') {
			logger.warn('[SessionManager] Cannot restart bridge session - user must restart it manually');
			throw new Error('Bridge sessions must be restarted manually by the user');
		}

		// Terminate existing process if any
		if (this.processManager.hasSession(sessionId)) {
			logger.debug('[SessionManager] Terminating existing process...');
			await this.processManager.terminateSession(sessionId);
		}

		// Start new process (managed session)
		logger.debug('[SessionManager] Starting new managed process...');
		const process = await this.processManager.createSession(
			sessionId,
			session.workingDirectory
		);

		session.pid = process.getPid();
		session.status = 'active';
		session.type = 'managed';
		session.lastUsedAt = Date.now();
		logger.info('[SessionManager] Session restarted successfully, PID:', session.pid);

		await this.saveToDisk();
	}

	/**
	 * Detect existing sessions on startup
	 */
	async detectExistingSessions(): Promise<SessionMetadata[]> {
		logger.info('[SessionManager] Detecting existing sessions...');
		const detected: SessionMetadata[] = [];

		// First, check our managed sessions
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

		// Scan for bridge sessions (user-started via claude-bridge.sh)
		logger.info('[SessionManager] Scanning for bridge sessions...');
		try {
			const bridgeSessions = await this.scanBridgeSessions();
			logger.info('[SessionManager] Found bridge sessions:', bridgeSessions.length);

			for (const bridgeSession of bridgeSessions) {
				// Check if we already have this session
				if (!this.sessions.has(bridgeSession.id)) {
					logger.info('[SessionManager] Adding new bridge session:', bridgeSession.id);
					this.sessions.set(bridgeSession.id, bridgeSession);
					detected.push(bridgeSession);
				}
			}
		} catch (error) {
			logger.error('[SessionManager] Error scanning for bridge sessions:', error);
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
	 * Scan for bridge sessions from ~/.claude-sessions/
	 */
	private async scanBridgeSessions(): Promise<SessionMetadata[]> {
		const bridgeSessionsDir = join(homedir(), '.claude-sessions');
		logger.debug('[SessionManager] Bridge sessions directory:', bridgeSessionsDir);

		if (!existsSync(bridgeSessionsDir)) {
			logger.debug('[SessionManager] Bridge sessions directory does not exist');
			return [];
		}

		const bridgeSessions: SessionMetadata[] = [];

		try {
			const files = await readdir(bridgeSessionsDir);
			logger.debug('[SessionManager] Found files in bridge sessions dir:', files.length);

			for (const file of files) {
				if (!file.endsWith('.json')) {
					continue;
				}

				const filePath = join(bridgeSessionsDir, file);
				try {
					const content = await readFile(filePath, 'utf-8');
					const metadata = JSON.parse(content);

					// Validate metadata structure
					if (!metadata.sessionId || !metadata.inputPipe || !metadata.outputPipe) {
						logger.warn('[SessionManager] Invalid bridge metadata:', filePath);
						continue;
					}

					// Check if bridge is still running (PID exists and pipes exist)
					const isRunning =
						metadata.pid &&
						checkPidExists(metadata.pid) &&
						existsSync(metadata.inputPipe) &&
						existsSync(metadata.outputPipe);

					if (!isRunning) {
						logger.debug('[SessionManager] Bridge session not running:', metadata.sessionId);
						continue;
					}

					// Create session metadata
					const bridgeMetadata: BridgeSessionMetadata = {
						inputPipe: metadata.inputPipe,
						outputPipe: metadata.outputPipe,
						statusPipe: metadata.statusPipe,
						version: metadata.version || '1.0.0',
					};

					const session: SessionMetadata = {
						id: metadata.sessionId,
						name: `Bridge: ${metadata.workingDir || 'Unknown'}`,
						workingDirectory: metadata.workingDir || '~',
						createdAt: metadata.startedAt ? metadata.startedAt * 1000 : Date.now(),
						lastUsedAt: Date.now(),
						status: 'active',
						type: 'bridge',
						pid: metadata.pid,
						commandHistory: [],
						bridgeMetadata,
					};

					bridgeSessions.push(session);
					logger.info('[SessionManager] Found active bridge session:', {
						id: session.id,
						workingDir: session.workingDirectory,
						pid: metadata.pid,
					});
				} catch (error) {
					logger.warn('[SessionManager] Error reading bridge metadata file:', filePath, error);
				}
			}
		} catch (error) {
			logger.error('[SessionManager] Error scanning bridge sessions directory:', error);
		}

		return bridgeSessions;
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
}
