/**
 * Type definitions for Claude from Obsidian plugin
 */

/**
 * Session metadata stored in sessions.json
 */
export interface SessionMetadata {
	/** Unique session identifier (UUID) */
	id: string;
	/** User-provided session name */
	name: string;
	/** Working directory for Claude process */
	workingDirectory: string;
	/** Creation timestamp (ms since epoch) */
	createdAt: number;
	/** Last used timestamp (ms since epoch) */
	lastUsedAt: number;
	/** Current session status */
	status: 'active' | 'stopped' | 'crashed';
	/** Process ID (for detection and reconnection) */
	pid?: number;
	/** Last N commands executed in this session */
	commandHistory: string[];
}

/**
 * Options for creating a Claude process
 */
export interface ClaudeProcessOptions {
	/** Session ID this process belongs to */
	sessionId: string;
	/** Working directory for the process */
	workingDirectory: string;
	/** Optional environment variables */
	envVars?: Record<string, string>;
}

/**
 * Plugin settings stored in Obsidian data
 */
export interface ClaudeFromObsidianSettings {
	/** Default working directory for new sessions */
	defaultWorkingDirectory: string;
	/** Auto-reconnect to sessions on plugin load */
	autoReconnectSessions: boolean;
	/** Command timeout in milliseconds */
	commandTimeout: number;
	/** Maximum number of commands to store in history */
	commandHistoryLimit: number;
}

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: ClaudeFromObsidianSettings = {
	defaultWorkingDirectory: '~',
	autoReconnectSessions: true,
	commandTimeout: 30000, // 30 seconds
	commandHistoryLimit: 10,
};

/**
 * Callback for session selection
 */
export type SessionSelectCallback = (sessionId: string | null) => void;

/**
 * Callback for new session creation
 */
export type NewSessionCallback = (name: string, workingDir: string) => void;

/**
 * Callback for command submission
 */
export type CommandSubmitCallback = (command: string) => void;

/**
 * Callback for response actions
 */
export type ResponseActionCallback = (action: 'copy' | 'insert' | 'replace', text: string) => void;

/**
 * Result of a command execution
 */
export interface CommandResult {
	/** Whether the command succeeded */
	success: boolean;
	/** Response text from Claude */
	response?: string;
	/** Error message if failed */
	error?: string;
}

/**
 * Data structure for sessions.json file
 */
export interface SessionsData {
	/** Map of session ID to metadata */
	sessions: SessionMetadata[];
	/** Last active session ID */
	lastSessionId?: string;
}
