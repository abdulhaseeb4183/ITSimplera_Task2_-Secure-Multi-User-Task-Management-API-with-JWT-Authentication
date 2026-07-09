/**
 * @file middlewares/authMiddleware.js
 * @description JWT-based route protection middleware.
 *
 * The `protect` middleware guards any route it is applied to by:
 *  1. Extracting the Bearer token from the Authorization header.
 *  2. Cryptographically verifying the token's signature using the JWT_SECRET.
 *  3. Checking that the user referenced in the token still exists in the DB.
 *  4. Checking that the user has NOT changed their password after token issuance
 *     (which would invalidate all previously issued tokens).
 *  5. Attaching the full user document to `req.user` for downstream controllers.
 *
 * Any failure in these steps terminates the request with a 401 Unauthorized
 * response BEFORE the route controller is ever reached.
 */

'use strict';

const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Extracts the JWT from the Authorization header and validates it.
 * Attaches the authenticated user to `req.user`.
 *
 * Expected header format:
 *   Authorization: Bearer <jwt_token>
 */
const protect = catchAsync(async (req, _res, next) => {
  // ── Step 1: Extract token from Authorization header ──────────────────────
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    // Split "Bearer <token>" and grab the token part
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError(
        'You are not logged in. Please log in to access this resource.',
        401
      )
    );
  }

  // ── Step 2: Cryptographically verify the token ───────────────────────────
  // `promisify` converts the callback-based jwt.verify into a Promise so we
  // can use async/await cleanly. If the token is invalid or expired, jwt.verify
  // throws – catchAsync will forward it to the global error handler.
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // `decoded` now contains: { id: '...', iat: ..., exp: ... }

  // ── Step 3: Verify the user still exists ─────────────────────────────────
  // A valid token could belong to a user who was since deleted from the DB.
  // We must confirm the user account is still active.
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError(
        'The user associated with this token no longer exists. Please log in again.',
        401
      )
    );
  }

  // ── Step 4: Check if password was changed after token was issued ──────────
  // If a user changes their password, all previously issued JWTs should be
  // invalidated as a security measure (e.g., after a suspected compromise).
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'Your password was recently changed. Please log in again.',
        401
      )
    );
  }

  // ── Step 5: Grant access – attach user to request ────────────────────────
  // Controllers and subsequent middlewares can now access the authenticated
  // user via `req.user` without performing additional DB lookups.
  req.user = currentUser;
  next();
});

module.exports = { protect };
