/**
 * Logging utility for Claude from Obsidian plugin
 * Provides structured logging with different log levels
 */

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export class Logger {
	private static instance: Logger;
	private logLevel: LogLevel = LogLevel.DEBUG;
	private prefix: string = '[Claude-Obsidian]';

	private constructor() {}

	static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	debug(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.DEBUG) {
			console.log(`${this.prefix} [DEBUG]`, message, ...args);
		}
	}

	info(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`${this.prefix} [INFO]`, message, ...args);
		}
	}

	warn(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.WARN) {
			console.warn(`${this.prefix} [WARN]`, message, ...args);
		}
	}

	error(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.ERROR) {
			console.error(`${this.prefix} [ERROR]`, message, ...args);
		}
	}

	/**
	 * Log with a specific component prefix
	 */
	component(componentName: string): ComponentLogger {
		return new ComponentLogger(this, componentName);
	}
}

/**
 * Component-specific logger that adds component name to logs
 */
export class ComponentLogger {
	constructor(private logger: Logger, private componentName: string) {}

	debug(message: string, ...args: any[]): void {
		this.logger.debug(`[${this.componentName}] ${message}`, ...args);
	}

	info(message: string, ...args: any[]): void {
		this.logger.info(`[${this.componentName}] ${message}`, ...args);
	}

	warn(message: string, ...args: any[]): void {
		this.logger.warn(`[${this.componentName}] ${message}`, ...args);
	}

	error(message: string, ...args: any[]): void {
		this.logger.error(`[${this.componentName}] ${message}`, ...args);
	}
}

// Export singleton instance
export const logger = Logger.getInstance();
