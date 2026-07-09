/**
 * @file utils/catchAsync.js
 * @description Higher-order function (HOF) that wraps async route handler
 *              functions to automatically catch any rejected promises and
 *              forward the error to Express's next() function.
 *
 * Without this wrapper every async controller would need its own
 * try/catch block. With it, error propagation is handled centrally.
 *
 * Usage:
 *   exports.createTask = catchAsync(async (req, res, next) => {
 *     // Any thrown error or rejected promise is forwarded to globalErrorHandler
 *   });
 */

'use strict';

/**
 * Wraps an async Express route handler, forwarding any uncaught rejections
 * or exceptions to the next() function (global error handler).
 *
 * @param {Function} fn - Async Express route handler (req, res, next) => Promise
 * @returns {Function} Express-compatible middleware function
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    // Execute the async function and catch any rejection, passing it to next()
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
