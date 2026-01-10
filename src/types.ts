/**
 * Type definitions for Claude from Obsidian plugin
 * Simplified for single default session (Feature 004)
 */

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
	/** Default working directory for the session */
	defaultWorkingDirectory: string;
	/** Command timeout in milliseconds */
	commandTimeout: number;
}

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: ClaudeFromObsidianSettings = {
	defaultWorkingDirectory: '~',
	commandTimeout: 30000, // 30 seconds
};

/**
 * Callback for command submission
 */
export type CommandSubmitCallback = (command: string) => void;

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
 * Position in a document
 */
export interface DocumentPosition {
	line: number;
	ch: number;
}

/**
 * Status of a Claude request
 */
export type RequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'orphaned';

/**
 * Tracks an active or queued Claude request
 */
export interface ActiveRequest {
	/** Unique ID for this request */
	requestId: string;
	/** Session ID this request belongs to */
	sessionId: string;
	/** File path where tags were injected */
	filePath: string;
	/** Start position of injected tags */
	tagStartPos: DocumentPosition;
	/** End position of injected tags */
	tagEndPos: DocumentPosition;
	/** The command sent to Claude */
	command: string;
	/** Original selected text (if any) */
	originalText: string;
	/** When the request was created */
	startTime: number;
	/** Current status */
	status: RequestStatus;
	/** Response from Claude (when completed) */
	response?: string;
	/** Error message (when failed) */
	error?: string;
}
