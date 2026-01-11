/**
 * Unit tests for StatusBarManager
 */

import { StatusBarManager } from './status-bar-manager';
import { App, Plugin, createMockHTMLElement } from 'obsidian';

describe('StatusBarManager', () => {
	let app: App;
	let plugin: Plugin;
	let statusBarManager: StatusBarManager;

	beforeEach(() => {
		app = new App();
		plugin = new Plugin(app);
		statusBarManager = new StatusBarManager(plugin, app);
	});

	afterEach(() => {
		statusBarManager.destroy();
	});

	describe('Issue #12: Event leak - Status bar click listener not removed on destroy', () => {
		it('should add click event listener on initialize', () => {
			statusBarManager.initialize();

			// Get the status bar element (created by addStatusBarItem)
			const statusBarEl = (statusBarManager as any).statusBarEl;
			expect(statusBarEl).toBeTruthy();
			expect(statusBarEl.addEventListener).toHaveBeenCalledTimes(1);
			expect(statusBarEl.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
		});

		it('should remove click event listener on destroy - currently failing', () => {
			statusBarManager.initialize();

			const statusBarEl = (statusBarManager as any).statusBarEl;
			expect(statusBarEl.addEventListener).toHaveBeenCalledTimes(1);

			// Now destroy the manager
			statusBarManager.destroy();

			// The click listener should have been removed BEFORE the element was removed
			// This test will FAIL with the current implementation because removeEventListener is never called
			expect(statusBarEl.removeEventListener).toHaveBeenCalledTimes(1);
			expect(statusBarEl.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
		});

		it('should remove the same listener function that was added', () => {
			statusBarManager.initialize();

			const statusBarEl = (statusBarManager as any).statusBarEl;

			// Capture the handler that was added
			const addedHandler = statusBarEl.addEventListener.mock.calls[0][1];

			statusBarManager.destroy();

			// The same handler reference should be removed
			// This ensures proper cleanup without leaks
			if (statusBarEl.removeEventListener.mock.calls.length > 0) {
				const removedHandler = statusBarEl.removeEventListener.mock.calls[0][1];
				expect(removedHandler).toBe(addedHandler);
			} else {
				// If removeEventListener was never called, this test fails
				expect(statusBarEl.removeEventListener).toHaveBeenCalled();
			}
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
