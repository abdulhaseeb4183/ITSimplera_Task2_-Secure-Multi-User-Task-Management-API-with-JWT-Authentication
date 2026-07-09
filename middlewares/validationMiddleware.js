/**
 * @file middlewares/validationMiddleware.js
 * @description Request validation rules using `express-validator`.
 *
 * Each exported function is an array of:
 *   1. One or more `check()` / `body()` validation chains defining the rules.
 *   2. A `validate` middleware that collects the results and either forwards
 *      any errors as a 422 Unprocessable Entity response, or calls next()
 *      to allow the request through to the controller.
 *
 * Usage in routes:
 *   router.post('/register', validateRegister, authController.register);
 */

'use strict';

const { body, param, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// ─── Validation Result Collector ──────────────────────────────────────────────

/**
 * Checks the result of all preceding validation chains.
 * If any rule failed, it collects all error messages and forwards a 422 error.
 * If all rules passed, it calls next() to proceed to the controller.
 *
 * @param {Object}   req  - Express request
 * @param {Object}   _res - Express response (unused here)
 * @param {Function} next - Express next function
 */
const validate = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Map validation errors to a readable format: { field, message }
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return next(
      new AppError(
        `Validation failed: ${formattedErrors.map((e) => e.message).join('. ')}`,
        422
      )
    );
  }

  next();
};

// ─── Auth Validators ──────────────────────────────────────────────────────────

/**
 * Validation rules for POST /api/auth/register
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 60 }).withMessage('Name must be between 2 and 60 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  body('profilePicture')
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Profile picture must be a valid HTTP/HTTPS URL'),

  validate,
];

/**
 * Validation rules for POST /api/auth/login
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),

  validate,
];

// ─── User Profile Validators ──────────────────────────────────────────────────

/**
 * Validation rules for PUT /api/users/profile
 */
const validateUpdateProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('Name must be between 2 and 60 characters'),

  body('profilePicture')
    .optional({ nullable: true, checkFalsy: true })
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Profile picture must be a valid HTTP/HTTPS URL'),

  // Prevent direct password/email updates through this endpoint
  body('password')
    .not().exists()
    .withMessage('Use the /change-password endpoint to update your password'),

  body('email')
    .not().exists()
    .withMessage('Email cannot be changed through this endpoint'),

  validate,
];

/**
 * Validation rules for PUT /api/users/change-password
 */
const validateChangePassword = [
  body('oldPassword')
    .notEmpty().withMessage('Current (old) password is required'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Confirm password does not match new password');
      }
      return true;
    }),

  validate,
];

// ─── Task Validators ──────────────────────────────────────────────────────────

/**
 * Validation rules for POST /api/tasks (create task)
 */
const validateCreateTask = [
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required')
    .isLength({ min: 3, max: 120 }).withMessage('Title must be between 3 and 120 characters'),

  body('description')
    .trim()
    .notEmpty().withMessage('Task description is required')
    .isLength({ min: 5, max: 2000 }).withMessage('Description must be between 5 and 2000 characters'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage("Priority must be one of: 'low', 'medium', 'high'"),

  body('status')
    .optional()
    .isIn(['pending', 'in-progress', 'completed'])
    .withMessage("Status must be one of: 'pending', 'in-progress', 'completed'"),

  body('dueDate')
    .notEmpty().withMessage('Due date is required')
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date (e.g., 2024-12-31)')
    .toDate() // Convert the string to a Date object
    .custom((value) => {
      if (value < new Date()) {
        throw new Error('Due date cannot be in the past');
      }
      return true;
    }),

  validate,
];

/**
 * Validation rules for PUT /api/tasks/:id (update task)
 */
const validateUpdateTask = [
  param('id')
    .isMongoId().withMessage('Invalid task ID format'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 120 }).withMessage('Title must be between 3 and 120 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 5, max: 2000 }).withMessage('Description must be between 5 and 2000 characters'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage("Priority must be one of: 'low', 'medium', 'high'"),

  body('status')
    .optional()
    .isIn(['pending', 'in-progress', 'completed'])
    .withMessage("Status must be one of: 'pending', 'in-progress', 'completed'"),

  body('dueDate')
    .optional()
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date')
    .toDate(),

  // Prevent direct ownership field manipulation (security guard)
  body('user')
    .not().exists()
    .withMessage('Task ownership cannot be changed'),

  body('softDeleted')
    .not().exists()
    .withMessage('Use the DELETE endpoint to remove a task'),

  validate,
];

/**
 * Validation rules for route params containing MongoDB ObjectId
 */
const validateMongoId = [
  param('id')
    .isMongoId().withMessage('Invalid ID format. Must be a valid MongoDB ObjectId'),

  validate,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateCreateTask,
  validateUpdateTask,
  validateMongoId,
};
