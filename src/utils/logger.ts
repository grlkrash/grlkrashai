import winston from 'winston';

// Define log levels and colors (optional)
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
  game: 7  // Custom level for G.A.M.E. protocol events
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  game: 'cyan'  // Custom color for G.A.M.E. protocol events
};

winston.addColors(logColors);

// Create the logger instance
const loggerInstance = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Default level, can be set via env var
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} [${info.level}]: ${info.message}` + (info.metadata && Object.keys(info.metadata).length ? ` ${JSON.stringify(info.metadata)}` : '')
    )
  ),
  transports: [
    new winston.transports.Console(),
    // Optionally add file transport
    // new winston.transports.File({ filename: 'agent.log' }) 
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    // new winston.transports.File({ filename: 'exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    // new winston.transports.File({ filename: 'rejections.log' })
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// Modify logger methods slightly to handle optional metadata object better
// This wraps the original methods to match how we called the previous logger
const wrappedLogger = {
  log: (level: string, message: string, meta?: any) => loggerInstance.log(level, message, { metadata: meta }),
  error: (message: string, meta?: any) => loggerInstance.error(message, { metadata: meta }),
  warn: (message: string, meta?: any) => loggerInstance.warn(message, { metadata: meta }),
  info: (message: string, meta?: any) => loggerInstance.info(message, { metadata: meta }),
  http: (message: string, meta?: any) => loggerInstance.http(message, { metadata: meta }),
  verbose: (message: string, meta?: any) => loggerInstance.verbose(message, { metadata: meta }),
  debug: (message: string, meta?: any) => loggerInstance.debug(message, { metadata: meta }),
  silly: (message: string, meta?: any) => loggerInstance.silly(message, { metadata: meta }),
  // Add game method for G.A.M.E. protocol events
  game: (message: string, meta?: any) => loggerInstance.log('game', message, { metadata: meta })
};

// Export the wrapped logger instance as default
export default wrappedLogger;

// Export the type if needed elsewhere (optional)
export type Logger = typeof wrappedLogger; 