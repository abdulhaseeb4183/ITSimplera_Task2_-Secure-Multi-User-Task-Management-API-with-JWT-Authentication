/**
 * @file controllers/userController.js
 * @description Handles user profile management operations for the authenticated user.
 *
 * All endpoints in this controller are protected by the `protect` middleware,
 * which means `req.user` is always populated with the current user's document.
 *
 * Key security principles:
 *  - Users can only view/modify their OWN profile (no admin-level access here)
 *  - Password is NEVER returned or accepted through the profile update endpoint
 *  - Password changes go through a dedicated endpoint with old-password verification
 *  - Sensitive fields are explicitly excluded from responses using field filtering
 */

'use strict';

const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { createSendToken } = require('../utils/jwtHelper');

// ─── Helper: Filter Allowed Fields ───────────────────────────────────────────

/**
 * Filters an object to only include whitelisted field names.
 * Prevents mass-assignment attacks where a user might try to update
 * sensitive fields (e.g., password, role) through a profile update request.
 *
 * @param {Object}    obj       - Source object (usually req.body)
 * @param {...string} allowedFields - Field names that are allowed to be updated
 * @returns {Object} New object containing only the allowed fields
 */
const filterObject = (obj, ...allowedFields) => {
  const filtered = {};
  Object.keys(obj).forEach((key) => {
    if (allowedFields.includes(key)) {
      filtered[key] = obj[key];
    }
  });
  return filtered;
};

// ─── Get My Profile ───────────────────────────────────────────────────────────

/**
 * GET /api/users/profile
 *
 * Returns the currently authenticated user's profile.
 * Password is excluded because of the `select: false` option in the User schema.
 *
 * @returns 200 OK with the user profile object.
 */
exports.getProfile = catchAsync(async (req, res, _next) => {
  // `req.user` is already populated by the `protect` middleware.
  // We re-query the DB to ensure we have the freshest data and to
  // demonstrate the correct pattern (protect only verifies the token).
  const user = await User.findById(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

// ─── Update Profile ───────────────────────────────────────────────────────────

/**
 * PUT /api/users/profile
 *
 * Updates the currently authenticated user's non-sensitive profile fields.
 * Explicitly blocks password and email updates through this endpoint.
 *
 * @returns 200 OK with the updated user profile.
 */
exports.updateProfile = catchAsync(async (req, res, next) => {
  // Guard against password updates through this endpoint
  if (req.body.password || req.body.confirmPassword) {
    return next(
      new AppError(
        'This endpoint is not for password updates. Use /api/users/change-password instead.',
        400
      )
    );
  }

  // Only allow specific safe fields to be updated (whitelist approach)
  const filteredBody = filterObject(req.body, 'name', 'profilePicture');

  if (Object.keys(filteredBody).length === 0) {
    return next(new AppError('No valid fields provided for update.', 400));
  }

  // Use findByIdAndUpdate instead of user.save() to avoid triggering the
  // password hashing pre-save hook (which only applies on password changes,
  // but being explicit here is safer).
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    filteredBody,
    {
      new: true,         // Return the UPDATED document, not the old one
      runValidators: true, // Run schema validators on the updated fields
    }
  );

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: updatedUser,
    },
  });
});

// ─── Change Password ──────────────────────────────────────────────────────────

/**
 * PUT /api/users/change-password
 *
 * Allows the authenticated user to change their password after verifying
 * their current (old) password. Issues a fresh JWT after the change so
 * the user remains logged in without needing to re-authenticate.
 *
 * @security Old password must be verified before the new one is saved.
 *           A new JWT is issued so the old token (pre-password-change) is
 *           implicitly invalidated by the `changedPasswordAfter` check in protect.
 * @returns 200 OK with a new JWT and updated user object.
 */
exports.changePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  // ── Step 1: Fetch the user with password (normally excluded by select:false) ─
  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return next(new AppError('User not found. Please log in again.', 404));
  }

  // ── Step 2: Verify the old password is correct ───────────────────────────
  const isPasswordCorrect = await user.correctPassword(oldPassword, user.password);

  if (!isPasswordCorrect) {
    return next(
      new AppError(
        'Your current password is incorrect. Please try again.',
        401
      )
    );
  }

  // ── Step 3: Ensure the new password is different from the old one ────────
  const isSamePassword = await user.correctPassword(newPassword, user.password);
  if (isSamePassword) {
    return next(
      new AppError(
        'New password must be different from your current password.',
        400
      )
    );
  }

  // ── Step 4: Update the password (pre-save hook handles hashing) ──────────
  user.password = newPassword;
  await user.save(); // Use save() (not findByIdAndUpdate) to trigger the pre-save hook

  // ── Step 5: Issue a new JWT – the old one is now effectively invalidated ─
  // because `changedPasswordAfter` will return true for any token issued
  // before this moment.
  createSendToken(user, 200, res);
});
