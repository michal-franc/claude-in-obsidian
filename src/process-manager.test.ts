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

	describe('stop()', () => {
		it('should kill running process when stop() is called during command execution', async () => {
			const { mockProcess, kill } = createMockProcess();
			(spawn as jest.Mock).mockReturnValue(mockProcess);

			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			});
			await proc.start();

			// Start a command but don't await (simulates in-flight request)
			const commandPromise = proc.sendCommand('test command');

			// Verify process was spawned
			expect(spawn).toHaveBeenCalledWith('claude', ['--print', '--continue'], expect.any(Object));

			// Stop should kill the running process
			await proc.stop();

			expect(kill).toHaveBeenCalledWith('SIGKILL');

			// Clean up: simulate process exit to resolve the promise
			mockProcess._emitter.emit('exit', null);
			await commandPromise.catch(() => {}); // Ignore rejection
		});

		it('should not error if no process is running when stop() is called', async () => {
			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			});
			await proc.start();

			// Stop without starting any command - should not throw
			await expect(proc.stop()).resolves.not.toThrow();
		});

		it('should set isActive to false after stop()', async () => {
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

	describe('getPid()', () => {
		it('should return undefined when no process is running', async () => {
			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			});
			await proc.start();

			expect(proc.getPid()).toBeUndefined();
		});

		it('should return PID when process is running', async () => {
			const { mockProcess, emitter } = createMockProcess();
			(spawn as jest.Mock).mockReturnValue(mockProcess);

			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			});
			await proc.start();

			// Start a command
			const commandPromise = proc.sendCommand('test command');

			expect(proc.getPid()).toBe(12345);

			// Clean up
			await proc.stop();
			emitter.emit('exit', null);
			await commandPromise.catch(() => {});
		});
	});

	describe('process cleanup on exit', () => {
		it('should clear process reference when process exits normally', async () => {
			const { mockProcess, emitter } = createMockProcess();
			(spawn as jest.Mock).mockReturnValue(mockProcess);

			const proc = new ClaudeProcess({
				sessionId: 'test',
				workingDirectory: '/tmp',
			});
			await proc.start();

			// Start a command
			const commandPromise = proc.sendCommand('test command');

			// Verify process is tracked
			expect(proc.getPid()).toBe(12345);

			// Simulate stdout data then exit
			mockProcess._stdout.emit('data', Buffer.from('response'));
			emitter.emit('exit', 0);

			// Wait for promise to resolve
			await commandPromise;

			// Process reference should be cleared
			expect(proc.getPid()).toBeUndefined();
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
	});
});
