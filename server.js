/**
 * @file server.js
 * @description Application entry point. Connects to MongoDB, initialises Express,
 *              mounts all global middlewares, loads route definitions, and starts
 *              the HTTP server. Handles uncaught exceptions and unhandled rejections
 *              to ensure the process never silently fails.
 */

'use strict';

// ─── Load Environment Variables First ────────────────────────────────────────
// Must be the very first import so every subsequent module sees process.env.*
require('dotenv').config();

// ─── Core Imports ─────────────────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// ─── Internal Imports ─────────────────────────────────────────────────────────
const connectDB = require('./config/db');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middlewares/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');

// ─── Uncaught Exception Guard ─────────────────────────────────────────────────
// Catch synchronous exceptions that were NOT handled anywhere in the codebase.
// This must be registered BEFORE any other code executes.
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  process.exit(1); // Mandatory exit – process is now in an undefined state
});

// ─── Database Connection ──────────────────────────────────────────────────────
connectDB();

// ─── Express App Initialisation ───────────────────────────────────────────────
const app = express();

// ─── Global Security Middlewares ─────────────────────────────────────────────

/**
 * Helmet sets secure HTTP response headers to protect against
 * common web vulnerabilities (XSS, clickjacking, MIME sniffing, etc.).
 */
app.use(helmet());

/**
 * CORS configuration – restrict origins in production by replacing
 * the wildcard with your actual frontend domain(s).
 */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/**
 * Rate Limiter – prevents brute-force and DDoS attacks by capping
 * the number of requests a single IP can make within a time window.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 requests per IP per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    status: 'error',
    message:
      'Too many requests from this IP address. Please try again after 15 minutes.',
  },
});
app.use('/api', apiLimiter);

// ─── Body Parsing Middlewares ─────────────────────────────────────────────────

/**
 * Parse incoming JSON bodies. The `limit` option prevents payload flooding.
 */
app.use(express.json({ limit: '10kb' }));

/**
 * Parse URL-encoded bodies (form submissions).
 */
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/**
 * MongoDB Query Injection Sanitizer – strips out keys that start with `$`
 * or contain `.` from user-supplied data to prevent NoSQL injection attacks.
 */
app.use(mongoSanitize());

// ─── Development Logging ──────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Health-Check Route ───────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Task Management API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Route Mounting ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);

// ─── Unhandled Route Catcher ──────────────────────────────────────────────────
// Any request that reaches here was not matched by any defined route.
app.all('*', (req, _res, next) => {
  next(
    new AppError(`Cannot find ${req.method} ${req.originalUrl} on this server`, 404)
  );
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Must be the LAST middleware registered – Express identifies error handlers
// by their 4-argument signature (err, req, res, next).
app.use(globalErrorHandler);

// ─── Server Bootstrap ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(
    `🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
});

// ─── Unhandled Promise Rejection Guard ───────────────────────────────────────
// Catch any promise rejection that was not handled with a .catch() block.
// Gracefully close the HTTP server before exiting so in-flight requests finish.
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app; // Export for testing purposes
