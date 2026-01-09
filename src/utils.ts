/**
 * Utility functions for Claude from Obsidian plugin
 */

import { randomBytes } from 'crypto';
import { homedir } from 'os';
import { resolve } from 'path';

/**
 * Generate a unique session ID using UUID v4 format
 * @returns A unique session identifier
 */
export function generateSessionId(): string {
	// Generate random bytes and format as UUID v4
	const bytes = randomBytes(16);

	// Set version (4) and variant bits
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	// Format as UUID string
	const hex = bytes.toString('hex');
	return [
		hex.substring(0, 8),
		hex.substring(8, 12),
		hex.substring(12, 16),
		hex.substring(16, 20),
		hex.substring(20, 32),
	].join('-');
}

/**
 * Check if a process with given PID exists and is running
 * @param pid Process ID to check
 * @returns True if process exists, false otherwise
 */
export function checkPidExists(pid: number): boolean {
	try {
		// Sending signal 0 checks if process exists without actually sending a signal
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// ESRCH means process doesn't exist
		// EPERM means process exists but we don't have permission (still counts as existing)
		if ((error as NodeJS.ErrnoException).code === 'EPERM') {
			return true;
		}
		return false;
	}
}

/**
 * Resolve a working directory path, expanding ~ and relative paths
 * @param path Path to resolve
 * @returns Absolute path
 */
export function resolveWorkingDirectory(path: string): string {
	// Expand ~ to home directory
	if (path.startsWith('~/') || path === '~') {
		path = path.replace(/^~/, homedir());
	}

	// Resolve to absolute path
	return resolve(path);
}

/**
 * Format a timestamp as a relative time string (e.g., "2 minutes ago")
 * @param timestamp Timestamp in milliseconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) {
		return seconds === 1 ? '1 second ago' : `${seconds} seconds ago`;
	} else if (minutes < 60) {
		return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
	} else if (hours < 24) {
		return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
	} else {
		return days === 1 ? '1 day ago' : `${days} days ago`;
	}
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.substring(0, maxLength - 3) + '...';
}

/**
 * Strip ANSI color codes from text
 * @param text Text with potential ANSI codes
 * @returns Clean text without ANSI codes
 */
export function stripAnsiCodes(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Validate that a directory path is safe and exists
 * @param path Directory path to validate
 * @returns Validation result with error message if invalid
 */
export function validateDirectory(path: string): { valid: boolean; error?: string } {
	if (!path || path.trim() === '') {
		return { valid: false, error: 'Directory path cannot be empty' };
	}

	try {
		const resolved = resolveWorkingDirectory(path);

		// Check for potentially dangerous paths
		if (resolved === '/' || resolved === 'C:\\') {
			return { valid: false, error: 'Cannot use root directory' };
		}

		return { valid: true };
	} catch (error) {
		return { valid: false, error: `Invalid path: ${(error as Error).message}` };
	}
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Find all running Claude processes on the system
 * @returns Array of process information {pid, command, cwd}
 */
export async function findRunningClaudeProcesses(): Promise<Array<{pid: number, command: string, cwd?: string}>> {
	const { exec } = require('child_process');
	const { promisify } = require('util');
	const execAsync = promisify(exec);

	try {
		// Use ps to find claude processes
		// We look for processes with 'claude' in the command
		const { stdout } = await execAsync('ps aux | grep -i "\\bclaude\\b" | grep -v grep');

		const processes: Array<{pid: number, command: string, cwd?: string}> = [];
		const lines = stdout.split('\n').filter((line: string) => line.trim().length > 0);

		for (const line of lines) {
			const parts = line.trim().split(/\s+/);
			if (parts.length >= 11) {
				const pid = parseInt(parts[1], 10);
				const command = parts.slice(10).join(' ');

				// Only include if it looks like a Claude shell process
				if (command.includes('claude') && !isNaN(pid)) {
					try {
						// Try to get working directory of the process
						const { stdout: cwdOut } = await execAsync(`lsof -a -p ${pid} -d cwd -Fn | grep '^n' | cut -c2-`);
						const cwd = cwdOut.trim();
						processes.push({ pid, command, cwd });
					} catch {
						// If we can't get cwd, just include without it
						processes.push({ pid, command });
					}
				}
			}
		}

		return processes;
	} catch (error) {
		// If no processes found or error, return empty array
		return [];
	}
}
