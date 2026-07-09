/**
 * @file routes/authRoutes.js
 * @description Express router for authentication-related endpoints.
 *
 * All routes here are PUBLIC (no `protect` middleware).
 * Validation middleware runs before each controller to ensure
 * request data is well-formed before business logic executes.
 *
 * Route Prefix: /api/auth  (mounted in server.js)
 */

'use strict';

const express = require('express');
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middlewares/validationMiddleware');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * POST /api/auth/register
 * Public – Create a new user account.
 * Validation runs first to ensure input is clean before hitting the controller.
 */
router.post('/register', validateRegister, authController.register);

/**
 * POST /api/auth/login
 * Public – Authenticate with email and password, receive a JWT.
 */
router.post('/login', validateLogin, authController.login);

/**
 * POST /api/auth/logout
 * Protected – Informs the client to discard its JWT.
 * We protect this route to ensure only authenticated users can call it,
 * and to have a log-able audit event of intentional logouts.
 */
router.post('/logout', protect, authController.logout);

module.exports = router;
