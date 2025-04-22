/**
 * Simple logger utility for GRLKRASHai
 * Used for consistent logging across the application
 */

export const logger = {
  info: (message: string, data?: any): void => {
    console.log(`[INFO] ${message}`, data ? data : '')
  },
  
  warn: (message: string, data?: any): void => {
    console.warn(`[WARN] ${message}`, data ? data : '')
  },
  
  error: (message: string, data?: any): void => {
    console.error(`[ERROR] ${message}`, data ? data : '')
  },
  
  debug: (message: string, data?: any): void => {
    if (process.env.DEBUG === 'true') {
      console.debug(`[DEBUG] ${message}`, data ? data : '')
    }
  },
  
  // Specific logger for G.A.M.E. protocol events
  game: (message: string, data?: any): void => {
    console.log(`[GAME] ${message}`, data ? data : '')
  }
} 