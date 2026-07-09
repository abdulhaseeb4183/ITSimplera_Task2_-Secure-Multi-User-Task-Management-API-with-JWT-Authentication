/**
 * @file middlewares/errorHandler.js
 * @description Centralised global error handling middleware for Express.
 *
 * This is the SINGLE place in the application where errors are formatted
 * and returned to the client. By centralising error handling here we ensure:
 *  - Consistent error response shape across the entire API
 *  - Stack traces and internal details are NEVER leaked in production
 *  - Known Mongoose/JWT/MongoDB driver errors are mapped to friendly messages
 *  - Unknown (programming) errors return a generic 500 response
 *
 * IMPORTANT: Express identifies error-handling middleware by its 4-argument
 * signature (err, req, res, next). Do NOT rename or remove any parameter.
 */

'use strict';

const AppError = require('../utils/AppError');

// ─── Error Type Handlers ──────────────────────────────────────────────────────

/**
 * Handles Mongoose CastError – occurs when an invalid ObjectId format is
 * used in a query (e.g., /api/tasks/not-a-valid-id).
 *
 * @param {Object} err - Original Mongoose CastError
 * @returns {AppError}
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: '${err.value}'. Please provide a valid ID.`;
  return new AppError(message, 400);
};

/**
 * Handles MongoDB duplicate key error (code 11000) – occurs when a unique
 * index constraint is violated (e.g., registering with an existing email).
 *
 * @param {Object} err - Original MongoDB duplicate key error
 * @returns {AppError}
 */
const handleDuplicateFieldsDB = (err) => {
  // Extract the duplicated value from the error's keyValue object
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate value for field '${field}': '${value}'. Please use a different value.`;
  return new AppError(message, 409); // 409 Conflict is semantically correct here
};

/**
 * Handles Mongoose ValidationError – occurs when a document fails schema
 * validation rules (e.g., required fields missing, enum values wrong).
 *
 * @param {Object} err - Original Mongoose ValidationError
 * @returns {AppError}
 */
const handleValidationErrorDB = (err) => {
  // Collect all individual validation error messages into a single string
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Validation failed: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handles JsonWebTokenError – occurs when the token signature is invalid
 * or the token has been tampered with.
 *
 * @returns {AppError}
 */
const handleJWTError = () =>
  new AppError('Invalid authentication token. Please log in again.', 401);

/**
 * Handles TokenExpiredError – occurs when a valid JWT has passed its
 * expiration time.
 *
 * @returns {AppError}
 */
const handleJWTExpiredError = () =>
  new AppError(
    'Your authentication token has expired. Please log in again.',
    401
  );

// ─── Environment-Specific Response Senders ────────────────────────────────────

/**
 * Development error response: sends full error details including the stack trace.
 * This makes debugging much easier without exposing anything to end users.
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

/**
 * Production error response: sends minimal, sanitised information.
 *
 * - Operational errors (AppError instances): safe to send the message to the client.
 * - Programming / unknown errors: log the full error and send a generic message.
 */
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    // Trusted, operational error – safe to expose message details
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or unknown error – DO NOT leak error details
    console.error('💥 UNHANDLED ERROR (Non-operational):', err);

    res.status(500).json({
      status: 'error',
      message: 'Something went wrong on the server. Please try again later.',
    });
  }
};

// ─── Global Error Handler Middleware ─────────────────────────────────────────

/**
 * Express global error handling middleware.
 * Must be registered LAST in the middleware chain in server.js.
 *
 * @param {Error}    err  - Error object passed via next(err) or thrown
 * @param {Object}   req  - Express request object
 * @param {Object}   res  - Express response object
 * @param {Function} next - Express next function (required even if unused)
 */
const globalErrorHandler = (err, req, res, next) => {
  // Default to 500 Internal Server Error if not set
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    // In production, transform known library errors into AppError instances
    // before sending, so they have user-friendly messages and correct status codes.

    let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
    error.message = err.message; // Preserve message (not copied by Object.assign)

    // Mongoose: invalid ObjectId in route parameter
    if (error.name === 'CastError') error = handleCastErrorDB(error);

    // MongoDB Driver: unique index constraint violation
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);

    // Mongoose: schema validation failure
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);

    // JWT: invalid signature / malformed token
    if (error.name === 'JsonWebTokenError') error = handleJWTError();

    // JWT: token expired
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = globalErrorHandler;
