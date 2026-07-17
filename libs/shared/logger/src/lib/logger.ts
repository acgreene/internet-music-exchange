/**
 * Severity levels for log output, ordered from most to least verbose.
 */
export enum LogLevel {
  /**
   * Detailed diagnostic output for development.
   */
  Debug = 'debug',

  /**
   * Routine operational messages.
   */
  Info = 'info',

  /**
   * Unexpected situations that do not interrupt operation.
   */
  Warn = 'warn',

  /**
   * Failures that need attention.
   */
  Error = 'error',
}

/**
 * Numeric severity used to filter levels below the configured minimum.
 */
const LEVEL_SEVERITY: Record<LogLevel, number> = {
  [LogLevel.Debug]: 0,
  [LogLevel.Info]: 1,
  [LogLevel.Warn]: 2,
  [LogLevel.Error]: 3,
};

/**
 * Console method used to emit each level.
 */
const LEVEL_CONSOLE: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
  [LogLevel.Debug]: 'debug',
  [LogLevel.Info]: 'info',
  [LogLevel.Warn]: 'warn',
  [LogLevel.Error]: 'error',
};

/**
 * Scoped, level-filtered logger. Runtime-agnostic: it only depends on the
 * console, so the API, web, and mobile apps can all share it.
 */
export class Logger {
  constructor(
    /**
     * Scope prefix shown on every line, e.g. 'api' or 'api:db'.
     */
    private readonly scope: string,
    /**
     * Lowest level that gets emitted; anything below is dropped.
     */
    private readonly minLevel: LogLevel = LogLevel.Debug,
  ) {}

  /**
   * Log detailed diagnostic output for development.
   */
  public debug(message: string, ...details: unknown[]): void {
    this.log(LogLevel.Debug, message, details);
  }

  /**
   * Log a routine operational message.
   */
  public info(message: string, ...details: unknown[]): void {
    this.log(LogLevel.Info, message, details);
  }

  /**
   * Log an unexpected situation that does not interrupt operation.
   */
  public warn(message: string, ...details: unknown[]): void {
    this.log(LogLevel.Warn, message, details);
  }

  /**
   * Log a failure that needs attention.
   */
  public error(message: string, ...details: unknown[]): void {
    this.log(LogLevel.Error, message, details);
  }

  /**
   * Create a logger for a nested scope, e.g. 'api' + 'db' logs as 'api:db'.
   */
  public child(scope: string): Logger {
    return new Logger(`${this.scope}:${scope}`, this.minLevel);
  }

  /**
   * Emit a line through the console method for the level, unless the level is
   * below the configured minimum.
   * @private
   */
  private log(level: LogLevel, message: string, details: unknown[]): void {
    if (LEVEL_SEVERITY[level] < LEVEL_SEVERITY[this.minLevel]) {
      return;
    }

    const line = `${new Date().toISOString()} [${level}] [${this.scope}] ${message}`;
    console[LEVEL_CONSOLE[level]](line, ...details);
  }
}
