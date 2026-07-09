/**
 * @file routes/userRoutes.js
 * @description Express router for user profile management endpoints.
 *
 * All routes here require authentication – `protect` is applied globally
 * to this entire router using router.use(), which means every route
 * defined after that line automatically inherits the protection.
 *
 * Route Prefix: /api/users  (mounted in server.js)
 */

'use strict';

const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const {
  validateUpdateProfile,
  validateChangePassword,
} = require('../middlewares/validationMiddleware');

const router = express.Router();

/**
 * Apply `protect` middleware to ALL routes in this router.
 * No route in this file can be accessed without a valid JWT.
 * This is cleaner than adding `protect` to each route individually.
 */
router.use(protect);

/**
 * GET  /api/users/profile → Fetch current user's profile
 * PUT  /api/users/profile → Update current user's profile
 */
router
  .route('/profile')
  .get(userController.getProfile)
  .put(validateUpdateProfile, userController.updateProfile);

/**
 * PUT /api/users/change-password → Change current user's password
 */
router.put(
  '/change-password',
  validateChangePassword,
  userController.changePassword
);

module.exports = router;
