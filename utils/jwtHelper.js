/**
 * @file utils/jwtHelper.js
 * @description Centralised JWT utilities: token signing and sending
 *              the authentication response to the client.
 *
 * Keeping JWT logic here – not in controllers – ensures the signing
 * algorithm and payload structure are consistent across auth endpoints.
 */

'use strict';

const jwt = require('jsonwebtoken');

/**
 * Signs a JWT for a given user ID.
 *
 * @param {string|ObjectId} userId - The MongoDB _id of the authenticated user.
 * @returns {string} Signed JWT string.
 */
const signToken = (userId) => {
  return jwt.sign(
    { id: userId }, // Payload: only store the user ID – nothing sensitive
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Creates a JWT, attaches it to the response, and sends the user object.
 * Centralising this prevents duplicate code across login/register endpoints.
 *
 * @param {Object} user     - Mongoose User document (password field excluded).
 * @param {number} statusCode - HTTP status code for the response.
 * @param {Object} res      - Express response object.
 */
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remove the password from the output – even if it was selected somewhere
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

module.exports = { signToken, createSendToken };
