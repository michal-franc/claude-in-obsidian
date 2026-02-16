/**
 * Unit tests for ClaudeProcess abort and conditional timeout
 */

import { ClaudeProcess, ClaudeProcessManager } from './process-manager';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

/**
 * Create a mock child process with controllable events
 */
function createMockChildProcess() {
	const proc = new EventEmitter() as any;
	proc.stdin = { write: jest.fn(), end: jest.fn() };
	proc.stdout = new EventEmitter();
	proc.stderr = new EventEmitter();
	proc.kill = jest.fn();
	proc.pid = 12345;
	return proc;
}

describe('ClaudeProcess', () => {
	let claudeProcess: ClaudeProcess;

	beforeEach(() => {
		jest.useFakeTimers();
		claudeProcess = new ClaudeProcess(
			{ sessionId: 'test', workingDirectory: '/tmp' },
			5000
		);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	describe('sendCommand with autoStopOnTimeout=true', () => {
		it('should set timeout and kill process on expiry', async () => {
			const mockProc = createMockChildProcess();
			mockSpawn.mockReturnValue(mockProc);

			await claudeProcess.start();
			const promise = claudeProcess.sendCommand('test', undefined, undefined, true);

			// Advance past timeout
			jest.advanceTimersByTime(6000);

			expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
			await expect(promise).rejects.toThrow('Command timeout');
		});
	});

	describe('sendCommand with autoStopOnTimeout=false', () => {
		it('should NOT set timeout', async () => {
			const mockProc = createMockChildProcess();
			mockSpawn.mockReturnValue(mockProc);

			await claudeProcess.start();
			const promise = claudeProcess.sendCommand('test', undefined, undefined, false);

			// Advance well past what would be the timeout
			jest.advanceTimersByTime(60000);

			// Process should NOT have been killed
			expect(mockProc.kill).not.toHaveBeenCalled();

			// Complete the process normally
			mockProc.stdout.emit('data', Buffer.from('response'));
			mockProc.emit('exit', 0);

			const result = await promise;
			expect(result).toBe('response');
		});
	});

	describe('abortCommand', () => {
		it('should kill the running process with SIGKILL', async () => {
			const mockProc = createMockChildProcess();
			mockSpawn.mockReturnValue(mockProc);

			await claudeProcess.start();
			const promise = claudeProcess.sendCommand('test', undefined, undefined, false);

			// Abort the command
			claudeProcess.abortCommand();

			expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
			await expect(promise).rejects.toThrow('Command stopped by user');
		});

		it('should be safe to call when no command is running', () => {
			expect(() => claudeProcess.abortCommand()).not.toThrow();
		});
	});
});

describe('ClaudeProcessManager', () => {
	describe('abortSession', () => {
		it('should call abortCommand on the session process', async () => {
			const manager = new ClaudeProcessManager(5000);
			const mockProc = createMockChildProcess();
			mockSpawn.mockReturnValue(mockProc);

			await manager.createSession('test-session', '/tmp');
			const process = manager.getSession('test-session')!;
			const abortSpy = jest.spyOn(process, 'abortCommand');

			manager.abortSession('test-session');

			expect(abortSpy).toHaveBeenCalled();
		});

		it('should not throw for non-existent session', () => {
			const manager = new ClaudeProcessManager(5000);
			expect(() => manager.abortSession('nonexistent')).not.toThrow();
		});
	});
});
