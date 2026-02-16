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

		it('should inject countdown text element into callout DOM', () => {
			const mockCountdownDiv = {
				className: '',
				textContent: '',
				remove: jest.fn(),
			};
			const mockCalloutEl = {
				querySelector: jest.fn().mockReturnValue(null),
				appendChild: jest.fn(),
			};
			const mockDocument = {
				querySelector: jest.fn().mockReturnValue(mockCalloutEl),
				querySelectorAll: jest.fn().mockReturnValue([]),
				createElement: jest.fn().mockReturnValue(mockCountdownDiv),
			};
			(globalThis as any).activeDocument = mockDocument;

			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);

			expect(mockDocument.createElement).toHaveBeenCalledWith('div');
			expect(mockCountdownDiv.className).toBe('claude-countdown-text');
			expect(mockCountdownDiv.textContent).toBe('30s');

			delete (globalThis as any).activeDocument;
		});

		it('should remove countdown text on stopCountdown()', () => {
			const mockCountdownDiv = {
				className: '',
				textContent: '',
				remove: jest.fn(),
			};
			const mockCalloutEl = {
				querySelector: jest.fn().mockReturnValue(null),
				appendChild: jest.fn(),
			};
			const mockDocument = {
				querySelector: jest.fn().mockReturnValue(mockCalloutEl),
				querySelectorAll: jest.fn().mockReturnValue([]),
				createElement: jest.fn().mockReturnValue(mockCountdownDiv),
			};
			(globalThis as any).activeDocument = mockDocument;

			statusBarManager.setProcessing('Processing...');
			statusBarManager.startCountdown(30000);
			statusBarManager.stopCountdown();

			expect(mockCountdownDiv.remove).toHaveBeenCalled();

			delete (globalThis as any).activeDocument;
		});
	});

	describe('Elapsed timer', () => {
		beforeEach(() => {
			statusBarManager.initialize();
			jest.spyOn(Date, 'now').mockReturnValue(1000);
		});

		afterEach(() => {
			(Date.now as jest.Mock).mockRestore();
		});

		it('should count up from 0', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			const statusBarEl = (statusBarManager as any).statusBarEl;
			// At t=0, elapsed is 0s
			expect(statusBarEl.setText).toHaveBeenCalledWith('Claude: Processing... (0s elapsed)');

			// Advance 5 seconds
			(Date.now as jest.Mock).mockReturnValue(6000);
			jest.advanceTimersByTime(1000);
			expect(statusBarEl.setText).toHaveBeenCalledWith('Claude: Processing... (5s elapsed)');
		});

		it('should show "(Xs elapsed)" format in status bar', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			(Date.now as jest.Mock).mockReturnValue(46000);
			jest.advanceTimersByTime(1000);

			const statusBarEl = (statusBarManager as any).statusBarEl;
			expect(statusBarEl.setText).toHaveBeenCalledWith('Claude: Processing... (45s elapsed)');
		});

		it('should NOT auto-stop', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			// Advance well past any reasonable timeout
			(Date.now as jest.Mock).mockReturnValue(120001);
			jest.advanceTimersByTime(120000);

			// Interval should still be running
			expect((statusBarManager as any).countdownInterval).not.toBeNull();
		});

		it('should be cleared by stopCountdown()', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			statusBarManager.stopCountdown();

			expect((statusBarManager as any).countdownInterval).toBeNull();
		});

		it('should report elapsed seconds via getCountdownRemaining()', () => {
			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			(Date.now as jest.Mock).mockReturnValue(11000);
			expect(statusBarManager.getCountdownRemaining()).toBe(10);
		});

		it('should report elapsed timer mode', () => {
			statusBarManager.startElapsedTimer();
			expect(statusBarManager.getTimerMode()).toBe('elapsed');
		});

		it('should inject countdown text with elapsed format into callout DOM', () => {
			const createdEls: any[] = [];
			const mockCalloutEl = {
				querySelector: jest.fn().mockReturnValue(null),
				appendChild: jest.fn(),
			};
			const mockDocument = {
				querySelector: jest.fn().mockReturnValue(mockCalloutEl),
				querySelectorAll: jest.fn().mockReturnValue([]),
				createElement: jest.fn().mockImplementation(() => {
					const el = { className: '', textContent: '', addEventListener: jest.fn(), remove: jest.fn() };
					createdEls.push(el);
					return el;
				}),
			};
			(globalThis as any).activeDocument = mockDocument;

			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			// First createElement should be for the countdown div
			const countdownDiv = createdEls.find(el => el.className === 'claude-countdown-text');
			expect(countdownDiv).toBeDefined();
			expect(countdownDiv.textContent).toBe('0s elapsed');

			delete (globalThis as any).activeDocument;
		});

		it('should inject stop button into callout DOM', () => {
			const createdEls: any[] = [];
			const mockCalloutEl = {
				querySelector: jest.fn().mockReturnValue(null),
				appendChild: jest.fn(),
			};
			const mockDocument = {
				querySelector: jest.fn().mockReturnValue(mockCalloutEl),
				querySelectorAll: jest.fn().mockReturnValue([]),
				createElement: jest.fn().mockImplementation(() => {
					const el = { className: '', textContent: '', addEventListener: jest.fn(), remove: jest.fn() };
					createdEls.push(el);
					return el;
				}),
			};
			(globalThis as any).activeDocument = mockDocument;

			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			const button = createdEls.find(el => el.className === 'claude-stop-button');
			expect(button).toBeDefined();
			expect(button.textContent).toBe('Stop');
			expect(mockCalloutEl.appendChild).toHaveBeenCalledWith(button);

			delete (globalThis as any).activeDocument;
		});

		it('should fire stop callback when stop button is clicked', () => {
			const stopCallback = jest.fn();
			statusBarManager.setStopCallback(stopCallback);

			const createdEls: any[] = [];
			const mockCalloutEl = {
				querySelector: jest.fn().mockReturnValue(null),
				appendChild: jest.fn(),
			};
			const mockDocument = {
				querySelector: jest.fn().mockReturnValue(mockCalloutEl),
				querySelectorAll: jest.fn().mockReturnValue([]),
				createElement: jest.fn().mockImplementation(() => {
					const el = { className: '', textContent: '', addEventListener: jest.fn(), remove: jest.fn() };
					createdEls.push(el);
					return el;
				}),
			};
			(globalThis as any).activeDocument = mockDocument;

			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			const button = createdEls.find(el => el.className === 'claude-stop-button');
			// Get the click handler from addEventListener calls
			const clickCall = button.addEventListener.mock.calls.find((c: any[]) => c[0] === 'click');
			clickCall[1]({ stopPropagation: jest.fn() });

			expect(stopCallback).toHaveBeenCalled();

			delete (globalThis as any).activeDocument;
		});

		it('should not inject duplicate stop button', () => {
			const existingButton = {};
			const existingText = {};
			const queryResults: Record<string, any> = {
				'.claude-stop-button': existingButton,
				'.claude-countdown-text': existingText,
			};
			const mockCalloutEl = {
				querySelector: jest.fn().mockImplementation((sel: string) => queryResults[sel] || null),
				appendChild: jest.fn(),
			};
			const mockDocument = {
				querySelector: jest.fn().mockReturnValue(mockCalloutEl),
				querySelectorAll: jest.fn().mockReturnValue([]),
				createElement: jest.fn(),
			};
			(globalThis as any).activeDocument = mockDocument;

			statusBarManager.setProcessing('Processing...');
			statusBarManager.startElapsedTimer();

			// Should not create new elements since they already exist
			expect(mockDocument.createElement).not.toHaveBeenCalled();

			delete (globalThis as any).activeDocument;
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
