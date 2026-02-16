/**
 * Unit tests for StatusBarManager
 */

import { StatusBarManager } from './status-bar-manager';
import { App, Plugin } from 'obsidian';

describe('StatusBarManager', () => {
	let app: App;
	let plugin: Plugin;
	let statusBarManager: StatusBarManager;

	beforeEach(() => {
		jest.useFakeTimers();
		app = new App();
		plugin = new Plugin(app);
		statusBarManager = new StatusBarManager(plugin, app);
	});

	afterEach(() => {
		statusBarManager.destroy();
		jest.useRealTimers();
	});

	describe('Issue #11: Orphaned requests not cleaned up', () => {
		it('should store orphaned response when setWarning is called', () => {
			statusBarManager.initialize();

			const largeResponse = 'x'.repeat(10000); // Simulate large response
			statusBarManager.setWarning(largeResponse, 'test command');

			const state = statusBarManager.getState();
			expect(state.state).toBe('warning');
			expect(state.orphanedResponse).toBe(largeResponse);
		});

		it('should auto-cleanup orphaned response after timeout - currently failing', () => {
			statusBarManager.initialize();

			const largeResponse = 'x'.repeat(10000);
			statusBarManager.setWarning(largeResponse, 'test command');

			// Verify warning is set
			expect(statusBarManager.getState().state).toBe('warning');
			expect(statusBarManager.getState().orphanedResponse).toBe(largeResponse);

			// Advance time by the cleanup timeout (5 minutes)
			jest.advanceTimersByTime(5 * 60 * 1000);

			// After timeout, orphaned response should be cleaned up
			// This test will FAIL with current implementation because there's no auto-cleanup
			const stateAfterTimeout = statusBarManager.getState();
			expect(stateAfterTimeout.state).toBe('idle');
			expect(stateAfterTimeout.orphanedResponse).toBeUndefined();
		});

		it('should clear cleanup timer if user manually dismisses warning', () => {
			statusBarManager.initialize();

			statusBarManager.setWarning('response', 'command');
			expect(statusBarManager.getState().state).toBe('warning');

			// User manually dismisses by calling setIdle
			statusBarManager.setIdle();

			// State should be idle
			expect(statusBarManager.getState().state).toBe('idle');

			// Advancing time should not cause any issues
			jest.advanceTimersByTime(10 * 60 * 1000);
			expect(statusBarManager.getState().state).toBe('idle');
		});

		it('should reset cleanup timer if new warning is set', () => {
			statusBarManager.initialize();

			statusBarManager.setWarning('response1', 'command1');

			// Advance time by 4 minutes (before 5 minute timeout)
			jest.advanceTimersByTime(4 * 60 * 1000);
			expect(statusBarManager.getState().state).toBe('warning');
			expect(statusBarManager.getState().orphanedResponse).toBe('response1');

			// Set new warning - should reset timer
			statusBarManager.setWarning('response2', 'command2');
			expect(statusBarManager.getState().orphanedResponse).toBe('response2');

			// Advance by 4 more minutes (total 8 from start, but only 4 from last warning)
			jest.advanceTimersByTime(4 * 60 * 1000);

			// Should still be warning because timer was reset
			expect(statusBarManager.getState().state).toBe('warning');

			// Advance by 2 more minutes (now 6 minutes since last warning)
			jest.advanceTimersByTime(2 * 60 * 1000);

			// Now should be cleaned up
			expect(statusBarManager.getState().state).toBe('idle');
		});

		it('should clear cleanup timer on destroy', () => {
			statusBarManager.initialize();

			statusBarManager.setWarning('response', 'command');

			// Destroy should clear timers
			statusBarManager.destroy();

			// No errors should occur when advancing time
			jest.advanceTimersByTime(10 * 60 * 1000);
		});
	});

	describe('Countdown timer', () => {
		beforeEach(() => {
			statusBarManager.initialize();
			jest.spyOn(Date, 'now').mockReturnValue(1000);
		});

		afterEach(() => {
			(Date.now as jest.Mock).mockRestore();
		});

		it('should update status bar text with remaining seconds', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);

			// Initial tick: 30s remaining
			const statusBarEl = (statusBarManager as any).statusBarEl;
			expect(statusBarEl.setText).toHaveBeenCalledWith('Claude: Processing... (30s)');

			// Advance 5 seconds
			(Date.now as jest.Mock).mockReturnValue(6000);
			jest.advanceTimersByTime(1000);
			expect(statusBarEl.setText).toHaveBeenCalledWith('Claude: Processing... (25s)');
		});

		it('should stop countdown and clear interval', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);

			statusBarManager.stopCountdown();

			// Advance time - should not throw or update
			(Date.now as jest.Mock).mockReturnValue(10000);
			jest.advanceTimersByTime(5000);

			// The internal interval should be null
			expect((statusBarManager as any).countdownInterval).toBeNull();
		});

		it('should auto-stop at 0 seconds', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(3000);

			// Advance past the countdown duration
			(Date.now as jest.Mock).mockReturnValue(4001);
			jest.advanceTimersByTime(4000);

			// Interval should be cleared
			expect((statusBarManager as any).countdownInterval).toBeNull();
		});

		it('should be stopped by destroy()', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);

			statusBarManager.destroy();

			expect((statusBarManager as any).countdownInterval).toBeNull();
		});

		it('should survive render() calls during countdown', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);

			const statusBarEl = (statusBarManager as any).statusBarEl;
			expect(statusBarEl.setText).toHaveBeenCalledWith('Claude: Processing... (30s)');

			// Simulate a render() triggered by setProcessing (e.g., queue update)
			statusBarManager.setProcessing('Processing... (1 queued)');

			// render() should still include the countdown, not the plain message
			expect(statusBarEl.setText).toHaveBeenLastCalledWith('Claude: Processing... (30s)');
		});

		it('should clear previous countdown when starting a new one', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);

			const firstInterval = (statusBarManager as any).countdownInterval;
			expect(firstInterval).not.toBeNull();

			// Start a new countdown
			(Date.now as jest.Mock).mockReturnValue(5000);
			statusBarManager.startCountdown(20000);

			// Should have a new interval (old one cleared)
			const secondInterval = (statusBarManager as any).countdownInterval;
			expect(secondInterval).not.toBeNull();
		});

		it('should set data-countdown attribute on callout DOM element', () => {
			const mockCalloutEl = {
				setAttribute: jest.fn(),
				removeAttribute: jest.fn(),
			};
			const mockDocument = {
				querySelector: jest.fn().mockReturnValue(mockCalloutEl),
				querySelectorAll: jest.fn().mockReturnValue([]),
			};
			(globalThis as any).document = mockDocument;

			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);

			expect(mockCalloutEl.setAttribute).toHaveBeenCalledWith(
				'data-countdown',
				'Claude is processing... (30s)'
			);

			delete (globalThis as any).document;
		});

		it('should remove data-countdown attribute on stopCountdown()', () => {
			const mockCalloutEl = {
				removeAttribute: jest.fn(),
			};
			const mockDocument = {
				querySelector: jest.fn().mockReturnValue(null),
				querySelectorAll: jest.fn().mockReturnValue([mockCalloutEl]),
			};
			(globalThis as any).document = mockDocument;

			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);
			statusBarManager.stopCountdown();

			expect(mockCalloutEl.removeAttribute).toHaveBeenCalledWith('data-countdown');

			delete (globalThis as any).document;
		});
	});

	describe('State management', () => {
		beforeEach(() => {
			statusBarManager.initialize();
		});

		it('should start in idle state', () => {
			expect(statusBarManager.getState().state).toBe('idle');
		});

		it('should set processing state', () => {
			statusBarManager.setProcessing('Testing...');
			expect(statusBarManager.getState().state).toBe('processing');
			expect(statusBarManager.getState().message).toBe('Testing...');
		});

		it('should set warning state with orphaned response', () => {
			statusBarManager.setWarning('Test response', 'Test command');
			const state = statusBarManager.getState();
			expect(state.state).toBe('warning');
			expect(state.orphanedResponse).toBe('Test response');
			expect(state.originalCommand).toBe('Test command');
		});

		it('should set error state', () => {
			statusBarManager.setError('Test error');
			expect(statusBarManager.getState().state).toBe('error');
			expect(statusBarManager.getState().message).toBe('Test error');
		});

		it('should set idle state', () => {
			statusBarManager.setProcessing('Testing...');
			statusBarManager.setIdle();
			expect(statusBarManager.getState().state).toBe('idle');
		});
	});
});
