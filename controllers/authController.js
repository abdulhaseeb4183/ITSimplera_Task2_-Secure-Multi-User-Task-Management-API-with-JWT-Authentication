/**
 * @file controllers/authController.js
 * @description Handles user registration, login, and logout operations.
 *
 * Security considerations implemented here:
 *  - Timing-safe password comparison (delegated to bcrypt via User.correctPassword)
 *  - Generic "invalid credentials" message for login failures (avoids user enumeration)
 *  - JWT signed with server secret and expiration enforced
 *  - No sensitive fields returned in responses (password excluded at schema level)
 */

'use strict';

const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { createSendToken } = require('../utils/jwtHelper');

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * Creates a new user account. Password hashing happens automatically
 * in the User model's pre-save hook (not here), keeping controllers thin.
 *
 * @security Passwords are never logged or returned.
 * @returns 201 Created with JWT and user object (password excluded).
 */
exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, profilePicture } = req.body;

  // Check for an existing user with the same email before attempting to create.
  // This provides a more descriptive error than relying solely on the unique index.
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(
      new AppError('An account with this email address already exists.', 409)
    );
  }

  // Create the user – password hashing is handled by the pre-save hook in User.js
  const newUser = await User.create({
    name,
    email,
    password,
    profilePicture: profilePicture || null,
  });

  // Sign a JWT and send the response (201 Created)
  createSendToken(newUser, 201, res);
});

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 *
 * Authenticates an existing user by verifying their email and password.
 *
 * @security Uses a deliberately vague "incorrect email or password" message
 *           to prevent user enumeration attacks (an attacker cannot determine
 *           whether the email exists or the password is wrong).
 * @returns 200 OK with JWT and user object (password excluded).
 */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // ── Step 1: Find user by email, explicitly selecting the password field ──
  // The password field has `select: false` in the schema, so we must
  // explicitly request it here for comparison. It will NOT be in the response.
  const user = await User.findOne({ email }).select('+password');

  // ── Step 2: Verify user exists and password is correct ──────────────────
  // We check BOTH conditions together in a single if-statement to avoid
  // revealing to the caller whether the email or the password was wrong.
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(
      new AppError('Incorrect email or password. Please try again.', 401)
    );
  }

  // ── Step 3: Issue a new JWT and respond ─────────────────────────────────
  createSendToken(user, 200, res);
});

// ─── Logout ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 *
 * Since JWTs are stateless, "logout" is handled on the client side by
 * discarding the token. This endpoint informs the client to do so and
 * serves as a clear, documentable API contract.
 *
 * For true server-side token invalidation, a token blacklist (e.g., using
 * Redis) would be needed. That is an extension point documented here.
 *
 * @returns 200 OK with logout confirmation message.
 */
exports.logout = catchAsync(async (_req, res, _next) => {
  /*
   * Extension Point – Server-Side Token Blacklisting:
   * If you want to invalidate tokens server-side, extract the token from the
   * Authorization header, add it to a Redis SET with its remaining TTL as the
   * key's expiry, and check this blacklist in the `protect` middleware.
   *
   * Example (Redis):
   *   const token = req.headers.authorization.split(' ')[1];
   *   const decoded = jwt.decode(token);
   *   const ttl = decoded.exp - Math.floor(Date.now() / 1000);
   *   await redisClient.setEx(`blacklist:${token}`, ttl, 'true');
   */

  res.status(200).json({
    status: 'success',
    message:
      'Logout successful. Please discard your token on the client side.',
  });
});
