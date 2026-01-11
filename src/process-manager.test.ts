/**
 * Unit tests for ClaudeProcess - process lifecycle management
 */

import { ClaudeProcess } from './process-manager';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');

// Mock logger to avoid console noise in tests
jest.mock('./logger', () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

/**
 * Create a mock ChildProcess with controllable behavior
 */
function createMockProcess(): {
	emitter: EventEmitter;
	kill: jest.Mock;
	stdin: { write: jest.Mock; end: jest.Mock };
	mockProcess: any;
} {
	const emitter = new EventEmitter();
	const kill = jest.fn();
	const stdin = {
		write: jest.fn(),
		end: jest.fn(),
	};

	// Create separate emitters for stdout/stderr to avoid event conflicts
	const stdoutEmitter = new EventEmitter();
	const stderrEmitter = new EventEmitter();

	const mockProcess = {
		pid: 12345,
		kill,
		stdin,
		stdout: stdoutEmitter,
		stderr: stderrEmitter,
		on: emitter.on.bind(emitter),
		// Store emitter reference for triggering events in tests
		_emitter: emitter,
		_stdout: stdoutEmitter,
	};

	return { emitter, kill, stdin, mockProcess };
}

describe('ClaudeProcess', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('Issue #10: Timer leak - timeout not cleared when process is killed', () => {
		it('should clear command timeout when stop() is called', async () => {
			// This test verifies that the timeout set in sendCommand() is cleared when stop() is called

			const { mockProcess } = createMockProcess();
			(spawn as jest.Mock).mockReturnValue(mockProcess);

			const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			}, 5000); // 5 second timeout
			await proc.start();

			// Start a command (this sets up a timeout)
			const commandPromise = proc.sendCommand('test command');

			// Verify timeout was set
			expect(jest.getTimerCount()).toBe(1);

			// Stop the session - this SHOULD clear the timeout
			await proc.stop();

			// Timeout should be cleared by stop()
			expect(clearTimeoutSpy).toHaveBeenCalled();

			// Cleanup: simulate process exit to resolve promise
			mockProcess._emitter.emit('exit', null);
			await commandPromise.catch(() => {});
		});

		it('should not have lingering timeouts after stop()', async () => {
			// Verify no timers remain after stop() is called

			const { mockProcess } = createMockProcess();
			(spawn as jest.Mock).mockReturnValue(mockProcess);

			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			}, 5000);
			await proc.start();

			// Start a command
			const commandPromise = proc.sendCommand('test command');

			// Verify timeout was set
			expect(jest.getTimerCount()).toBe(1);

			// Stop the session
			await proc.stop();

			// Timer should be cleared
			expect(jest.getTimerCount()).toBe(0);

			// Cleanup
			mockProcess._emitter.emit('exit', null);
			await commandPromise.catch(() => {});
		});
	});

	describe('sendCommand()', () => {
		it('should reject if session is not active', async () => {
			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			});
			await proc.start();
			await proc.stop();

			await expect(proc.sendCommand('test')).rejects.toThrow('Session not active');
		});

		it('should set up timeout for command execution', async () => {
			const { mockProcess, emitter } = createMockProcess();
			(spawn as jest.Mock).mockReturnValue(mockProcess);

			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			}, 5000);
			await proc.start();

			const commandPromise = proc.sendCommand('test command');

			// Verify timeout is active
			expect(jest.getTimerCount()).toBe(1);

			// Cleanup
			mockProcess._stdout.emit('data', Buffer.from('response'));
			emitter.emit('exit', 0);
			await commandPromise;
		});

		it('should clear timeout when process exits normally', async () => {
			const { mockProcess, emitter } = createMockProcess();
			(spawn as jest.Mock).mockReturnValue(mockProcess);

			const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			}, 5000);
			await proc.start();

			const commandPromise = proc.sendCommand('test command');

			// Simulate successful process exit
			mockProcess._stdout.emit('data', Buffer.from('response'));
			emitter.emit('exit', 0);

			await commandPromise;

			// Timeout should be cleared by the exit handler
			expect(clearTimeoutSpy).toHaveBeenCalled();
		});
	});

	describe('stop()', () => {
		it('should set isActive to false', async () => {
			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			});
			await proc.start();

			expect(proc.isRunning()).toBe(true);

			await proc.stop();

			expect(proc.isRunning()).toBe(false);
		});
	});
});
