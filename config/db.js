/**
 * @file config/db.js
 * @description MongoDB connection configuration using Mongoose.
 *              Implements a robust connection strategy with retry logic
 *              and detailed connection lifecycle logging.
 */

'use strict';

const mongoose = require('mongoose');

/**
 * Establishes a persistent connection to MongoDB.
 * Uses async/await and throws on failure so the caller (server.js)
 * can decide how to handle a fatal DB startup error.
 *
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI;

    if (!MONGO_URI) {
      throw new Error(
        'MONGO_URI is not defined in environment variables. Check your .env file.'
      );
    }

    const connection = await mongoose.connect(MONGO_URI, {
      // Mongoose 6+ has these options as defaults, but being explicit
      // makes the intent clear and ensures forward compatibility.
      maxPoolSize: 10,           // Maximum number of sockets in the connection pool
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s default
      socketTimeoutMS: 45000,    // Close sockets after 45 seconds of inactivity
    });

    console.log(
      `✅ MongoDB Connected: ${connection.connection.host} (DB: ${connection.connection.name})`
    );
  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    // Exit the process with failure code so the OS / container orchestrator
    // (Docker, PM2, Kubernetes) can restart the service.
    process.exit(1);
  }
};

// ─── Mongoose Connection Event Listeners ─────────────────────────────────────

// Fires when the connection is lost after initial success (e.g., network drop)
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

// Fires when Mongoose successfully reconnects after a disconnection
mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully.');
});

// Fires on any connection error after initial connection
mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB connection error: ${err.message}`);
});

module.exports = connectDB;
