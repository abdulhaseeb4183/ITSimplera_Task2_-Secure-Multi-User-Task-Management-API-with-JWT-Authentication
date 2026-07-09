/**
 * @file routes/taskRoutes.js
 * @description Express router for task management endpoints.
 *
 * ALL routes in this file are protected by the `protect` middleware, which
 * ensures only authenticated users can access them.
 *
 * The multi-tenancy guard is enforced at the CONTROLLER level by always
 * including `user: req.user.id` in every database query.
 *
 * Route Prefix: /api/tasks  (mounted in server.js)
 *
 * IMPORTANT ROUTE ORDER:
 * The `/stats` route MUST be defined BEFORE the `/:id` parameterised route.
 * If `/:id` is defined first, Express will match `/stats` as an ID parameter
 * and attempt a MongoDB ObjectId lookup with the string "stats", which will
 * fail with a CastError. Specific routes always before dynamic parameters.
 */

'use strict';

const express = require('express');
const taskController = require('../controllers/taskController');
const { protect } = require('../middlewares/authMiddleware');
const {
  validateCreateTask,
  validateUpdateTask,
  validateMongoId,
} = require('../middlewares/validationMiddleware');

const router = express.Router();

/**
 * Apply `protect` middleware to ALL task routes.
 * No unauthenticated request can reach any task endpoint.
 */
router.use(protect);

// ─── Stats Route (must be before /:id) ────────────────────────────────────────

/**
 * GET /api/tasks/stats
 * Returns aggregated dashboard statistics for the authenticated user's tasks.
 * Uses MongoDB Aggregation Pipeline with $facet for efficiency.
 */
router.get('/stats', taskController.getTaskStats);

// ─── Collection Routes ─────────────────────────────────────────────────────────

/**
 * GET  /api/tasks → Get all tasks (with search, filter, pagination, sort)
 * POST /api/tasks → Create a new task
 */
router
  .route('/')
  .get(taskController.getAllTasks)
  .post(validateCreateTask, taskController.createTask);

// ─── Document Routes (by ID) ──────────────────────────────────────────────────

/**
 * GET    /api/tasks/:id → Get a specific task by ID (ownership verified)
 * PUT    /api/tasks/:id → Update a specific task (ownership verified)
 * DELETE /api/tasks/:id → Soft-delete a specific task (ownership verified)
 */
router
  .route('/:id')
  .get(validateMongoId, taskController.getTaskById)
  .put(validateUpdateTask, taskController.updateTask)
  .delete(validateMongoId, taskController.deleteTask);

module.exports = router;
