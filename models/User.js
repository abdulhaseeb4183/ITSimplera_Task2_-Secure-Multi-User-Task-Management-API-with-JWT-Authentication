/**
 * @file models/User.js
 * @description Mongoose schema and model for the User entity.
 *
 * Security features built into this model:
 *  - Password is NEVER returned by default (select: false)
 *  - Passwords are automatically hashed with bcrypt before persistence
 *  - Instance method `correctPassword` allows safe candidate verification
 *    without ever exposing the hashed password outside this module
 */

'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

// ─── Schema Definition ────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [60, 'Name must not exceed 60 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true, // Normalize to lowercase before saving
      trim: true,
      validate: {
        // Use the battle-tested `validator` library instead of a naive regex
        validator: (value) => validator.isEmail(value),
        message: 'Please provide a valid email address',
      },
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      // CRITICAL: Never return password in any query result by default.
      // To explicitly include it, use .select('+password') in the query.
      select: false,
    },

    profilePicture: {
      type: String,
      default: null,
      // Validate that the URL is a valid URL if provided
      validate: {
        validator: function (value) {
          // Allow null or empty – field is optional
          if (!value) return true;
          return validator.isURL(value, { protocols: ['http', 'https'] });
        },
        message: 'Profile picture must be a valid HTTP/HTTPS URL',
      },
    },

    passwordChangedAt: {
      // Tracks when the password was last changed.
      // Used to invalidate tokens issued before this timestamp.
      type: Date,
      select: false,
    },
  },
  {
    // Automatically add `createdAt` and `updatedAt` fields managed by Mongoose
    timestamps: true,
    // Ensure virtual properties (e.g., computed fields) appear in JSON output
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// The `email` field already has `unique: true` which creates an index.
// An explicit compound index would be added here if needed for other queries.

// ─── Pre-Save Middleware (Password Hashing) ───────────────────────────────────

/**
 * Before saving a User document, check if the password field was modified.
 * If it was (on creation OR explicit password update), hash it with bcrypt.
 *
 * Using a pre-save hook guarantees the password is ALWAYS hashed regardless
 * of which code path creates or updates the user – controllers don't need
 * to remember to hash manually.
 */
userSchema.pre('save', async function (next) {
  // Only run this hook if the password was actually modified
  if (!this.isModified('password')) return next();

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;

  // Hash the plain-text password with the configured salt rounds.
  // bcryptjs.hash() is async so we await it to avoid blocking the event loop.
  this.password = await bcrypt.hash(this.password, saltRounds);

  next();
});

/**
 * Before saving, if the password was modified (but this is NOT a new document),
 * set `passwordChangedAt` to the current time minus 1 second.
 *
 * The 1-second buffer compensates for the slight delay between the DB write
 * and the JWT issuance, ensuring the new token is always considered valid.
 */
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  // Subtract 1 second to ensure the token is issued AFTER this timestamp
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Compares a candidate (plain-text) password against the stored hashed password.
 *
 * @param {string} candidatePassword - Raw password submitted by the user.
 * @param {string} userPassword      - Hashed password retrieved from the DB
 *                                     (must be explicitly selected in the query).
 * @returns {Promise<boolean>} True if passwords match, false otherwise.
 */
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  // bcryptjs.compare() is safe against timing attacks
  return await bcrypt.compare(candidatePassword, userPassword);
};

/**
 * Determines whether the user's password was changed after a given JWT was issued.
 * Used in the `protect` middleware to invalidate stale tokens.
 *
 * @param {number} JWTTimestamp - `iat` claim from the decoded JWT (seconds since epoch).
 * @returns {boolean} True if password was changed AFTER the token was issued.
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    // Convert the stored Date to seconds (JWT iat is in seconds)
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    // If the password change timestamp is GREATER than the token issue time,
    // the token is no longer valid for this user.
    return JWTTimestamp < changedTimestamp;
  }
  // Password has never been changed → token is still valid
  return false;
};

// ─── Model Export ─────────────────────────────────────────────────────────────

const User = mongoose.model('User', userSchema);

module.exports = User;
