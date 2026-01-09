/**
 * Request manager for tracking and queuing Claude requests
 */

import { Editor } from 'obsidian';
import { ActiveRequest, DocumentPosition, RequestStatus } from './types';
import { logger } from './logger';
import { generateSessionId } from './utils';

export type RequestCompletedCallback = (request: ActiveRequest) => void;

/**
 * Manages Claude requests with queueing (max 1 concurrent)
 */
export class RequestManager {
	private activeRequest: ActiveRequest | null = null;
	private queue: ActiveRequest[] = [];
	private onRequestCompleted?: RequestCompletedCallback;

	constructor() {
		logger.info('[RequestManager] Initialized');
	}

	/**
	 * Set callback for when a request completes
	 */
	setCompletedCallback(callback: RequestCompletedCallback): void {
		this.onRequestCompleted = callback;
	}

	/**
	 * Create and queue a new request
	 */
	createRequest(
		sessionId: string,
		filePath: string,
		command: string,
		originalText: string,
		tagStartPos: DocumentPosition,
		tagEndPos: DocumentPosition
	): ActiveRequest {
		const request: ActiveRequest = {
			requestId: generateSessionId(), // Reuse UUID generator
			sessionId,
			filePath,
			command,
			originalText,
			tagStartPos,
			tagEndPos,
			startTime: Date.now(),
			status: 'pending',
		};

		logger.info('[RequestManager] Created request:', {
			requestId: request.requestId,
			sessionId,
			filePath,
		});

		this.queue.push(request);
		logger.debug('[RequestManager] Queue size:', this.queue.length);

		return request;
	}

	/**
	 * Get the next request to process (if any and no active request)
	 */
	getNextRequest(): ActiveRequest | null {
		if (this.activeRequest) {
			logger.debug('[RequestManager] Already processing a request');
			return null;
		}

		const next = this.queue.shift();
		if (next) {
			this.activeRequest = next;
			next.status = 'processing';
			logger.info('[RequestManager] Starting request:', next.requestId);
		}

		return next || null;
	}

	/**
	 * Check if there's an active request
	 */
	hasActiveRequest(): boolean {
		return this.activeRequest !== null;
	}

	/**
	 * Get the active request
	 */
	getActiveRequest(): ActiveRequest | null {
		return this.activeRequest;
	}

	/**
	 * Get queue length
	 */
	getQueueLength(): number {
		return this.queue.length;
	}

	/**
	 * Mark current request as completed with response
	 */
	completeRequest(response: string): void {
		if (!this.activeRequest) {
			logger.warn('[RequestManager] No active request to complete');
			return;
		}

		this.activeRequest.status = 'completed';
		this.activeRequest.response = response;
		logger.info('[RequestManager] Request completed:', this.activeRequest.requestId);

		const completed = this.activeRequest;
		this.activeRequest = null;

		if (this.onRequestCompleted) {
			this.onRequestCompleted(completed);
		}
	}

	/**
	 * Mark current request as failed with error
	 */
	failRequest(error: string): void {
		if (!this.activeRequest) {
			logger.warn('[RequestManager] No active request to fail');
			return;
		}

		this.activeRequest.status = 'failed';
		this.activeRequest.error = error;
		logger.error('[RequestManager] Request failed:', {
			requestId: this.activeRequest.requestId,
			error,
		});

		const failed = this.activeRequest;
		this.activeRequest = null;

		if (this.onRequestCompleted) {
			this.onRequestCompleted(failed);
		}
	}

	/**
	 * Mark current request as orphaned (tags modified/deleted)
	 */
	orphanRequest(response?: string): void {
		if (!this.activeRequest) {
			logger.warn('[RequestManager] No active request to orphan');
			return;
		}

		this.activeRequest.status = 'orphaned';
		this.activeRequest.response = response;
		logger.warn('[RequestManager] Request orphaned:', this.activeRequest.requestId);

		const orphaned = this.activeRequest;
		this.activeRequest = null;

		if (this.onRequestCompleted) {
			this.onRequestCompleted(orphaned);
		}
	}

	/**
	 * Find a request by its ID
	 */
	findRequest(requestId: string): ActiveRequest | null {
		if (this.activeRequest?.requestId === requestId) {
			return this.activeRequest;
		}
		return this.queue.find(r => r.requestId === requestId) || null;
	}

	/**
	 * Cancel a specific request
	 */
	cancelRequest(requestId: string): boolean {
		// Can't cancel active request (it's already processing)
		if (this.activeRequest?.requestId === requestId) {
			logger.warn('[RequestManager] Cannot cancel active request');
			return false;
		}

		const index = this.queue.findIndex(r => r.requestId === requestId);
		if (index >= 0) {
			this.queue.splice(index, 1);
			logger.info('[RequestManager] Cancelled queued request:', requestId);
			return true;
		}

		return false;
	}

	/**
	 * Clear all queued requests
	 */
	clearQueue(): void {
		const count = this.queue.length;
		this.queue = [];
		logger.info('[RequestManager] Cleared queue, removed:', count);
	}

	/**
	 * Get status summary
	 */
	getStatus(): { active: boolean; queueLength: number; activeRequestId?: string } {
		return {
			active: this.activeRequest !== null,
			queueLength: this.queue.length,
			activeRequestId: this.activeRequest?.requestId,
		};
	}
}
