/**
 * @file utils/AppError.js
 * @description Custom operational error class that extends the native JavaScript
 *              Error object. Distinguishes between "operational" errors (expected,
 *              safe to expose to clients) and "programming" errors (bugs, should
 *              never reach the client in production).
 *
 * Usage:
 *   throw new AppError('Resource not found', 404);
 *   next(new AppError('Unauthorized access', 401));
 */

'use strict';

class AppError extends Error {
  /**
   * Creates an AppError instance.
   *
   * @param {string} message - Human-readable error message sent to the client.
   * @param {number} statusCode - HTTP status code (e.g., 400, 401, 404, 500).
   */
  constructor(message, statusCode) {
    // Call the parent Error constructor with the message so that
    // err.message and err.stack are correctly populated.
    super(message);

    this.statusCode = statusCode;

    // Derive a status string from the status code:
    //   4xx  →  'fail'   (client errors – invalid input, auth failures, not found)
    //   5xx  →  'error'  (server errors – unexpected failures)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    // Mark this error as "operational" so the global error handler can
    // safely send its details to the client. Non-operational errors (bugs)
    // are caught separately and a generic message is returned instead.
    this.isOperational = true;

    // Capture the stack trace, excluding the constructor call frame itself,
    // so the stack points to the actual location where the error was created.
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
