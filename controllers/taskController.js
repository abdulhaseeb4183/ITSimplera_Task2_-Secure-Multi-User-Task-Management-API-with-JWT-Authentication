/**
 * @file controllers/taskController.js
 * @description Handles all CRUD operations and advanced query features for Tasks.
 *
 * MULTI-TENANCY ENFORCEMENT:
 * Every single database operation in this controller includes `user: req.user.id`
 * as a mandatory filter. This is the "multi-tenancy guard" – it ensures that:
 *  - Users can only SEE their own tasks (GET)
 *  - Users can only CREATE tasks assigned to themselves (POST)
 *  - Users can only UPDATE tasks they own (PUT)
 *  - Users can only DELETE tasks they own (DELETE)
 *
 * Never remove `user: req.user.id` from any query – that would be a
 * critical security vulnerability allowing cross-tenant data access.
 *
 * ADVANCED FEATURES:
 *  - Full-text search on title and description (GET /)
 *  - Dynamic filtering by status and priority (GET /)
 *  - Pagination with total counts (GET /)
 *  - Flexible sorting (GET /)
 *  - MongoDB Aggregation Pipeline dashboard stats (GET /stats)
 */

'use strict';

const Task = require('../models/Task');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// ─── Create Task ──────────────────────────────────────────────────────────────

/**
 * POST /api/tasks
 *
 * Creates a new task and automatically assigns it to the authenticated user.
 * The `user` field is set from `req.user.id` (not from req.body) to prevent
 * a user from creating a task assigned to a different user.
 *
 * @security `user` is always sourced from the verified JWT, not user input.
 * @returns 201 Created with the new task object.
 */
exports.createTask = catchAsync(async (req, res, _next) => {
  const { title, description, priority, status, dueDate } = req.body;

  const task = await Task.create({
    title,
    description,
    priority,
    status,
    dueDate,
    user: req.user.id, // ← CRITICAL: Always from the authenticated session, not req.body
  });

  res.status(201).json({
    status: 'success',
    data: {
      task,
    },
  });
});

// ─── Get All Tasks (Advanced: Search, Filter, Paginate, Sort) ─────────────────

/**
 * GET /api/tasks
 *
 * Retrieves tasks belonging ONLY to the authenticated user.
 * Supports all five advanced query features via URL parameters:
 *
 * Query Parameters:
 *   search    → Text search on title and description (e.g., ?search=project)
 *   status    → Filter by status (e.g., ?status=pending)
 *   priority  → Filter by priority (e.g., ?priority=high)
 *   page      → Page number for pagination (default: 1)
 *   limit     → Results per page (default: 10, max: 50)
 *   sort      → Field and direction (e.g., ?sort=dueDate:desc or ?sort=createdDate:asc)
 *
 * Example: GET /api/tasks?search=bug&status=in-progress&priority=high&page=2&limit=5&sort=dueDate:asc
 *
 * @returns 200 OK with tasks array, pagination metadata, and total count.
 */
exports.getAllTasks = catchAsync(async (req, res, _next) => {
  const {
    search,
    status,
    priority,
    page = 1,
    limit = 10,
    sort = 'createdDate:desc',
  } = req.query;

  // ── Base Query Filter: ALWAYS scope to the authenticated user's tasks ────
  const queryFilter = { user: req.user.id };
  // Note: softDeleted: false is automatically applied by the Task model's
  // pre-find query middleware – we don't need to add it manually here.

  // ── Feature 1: Text Search ───────────────────────────────────────────────
  // Searches across both `title` and `description` fields using a
  // case-insensitive regular expression for partial matching.
  if (search && search.trim()) {
    // Sanitize the search string to prevent ReDoS (Regex Denial of Service)
    const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(sanitizedSearch, 'i');
    queryFilter.$or = [
      { title: searchRegex },
      { description: searchRegex },
    ];
  }

  // ── Feature 2: Filtering ─────────────────────────────────────────────────
  if (status) {
    const validStatuses = ['pending', 'in-progress', 'completed'];
    if (validStatuses.includes(status)) {
      queryFilter.status = status;
    }
  }

  if (priority) {
    const validPriorities = ['low', 'medium', 'high'];
    if (validPriorities.includes(priority)) {
      queryFilter.priority = priority;
    }
  }

  // ── Feature 3: Pagination ────────────────────────────────────────────────
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // ── Feature 4: Sorting ───────────────────────────────────────────────────
  // Expected format: "fieldName:direction" (e.g., "dueDate:desc", "createdDate:asc")
  // Supports multiple sort fields separated by commas: "dueDate:asc,priority:desc"
  const ALLOWED_SORT_FIELDS = ['dueDate', 'createdDate', 'createdAt', 'updatedAt', 'priority', 'status', 'title'];
  const SORT_DIRECTION = { asc: 1, desc: -1 };

  const sortObject = {};
  const sortParts = sort.split(',');

  for (const part of sortParts) {
    const [field, direction = 'desc'] = part.trim().split(':');
    if (ALLOWED_SORT_FIELDS.includes(field) && SORT_DIRECTION[direction] !== undefined) {
      sortObject[field] = SORT_DIRECTION[direction];
    }
  }

  // Default sort: newest first
  if (Object.keys(sortObject).length === 0) {
    sortObject.createdDate = -1;
  }

  // ── Execute Queries in Parallel for Performance ──────────────────────────
  // Run the data query and the total count query simultaneously using
  // Promise.all() to avoid sequential round-trips to the database.
  const [tasks, totalTasks] = await Promise.all([
    Task.find(queryFilter)
      .sort(sortObject)
      .skip(skip)
      .limit(limitNum)
      .populate('user', 'name email'), // Join user details for display
    Task.countDocuments(queryFilter),
  ]);

  const totalPages = Math.ceil(totalTasks / limitNum);

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalTasks,
      tasksPerPage: limitNum,
      hasNextPage: pageNum < totalPages,
      hasPreviousPage: pageNum > 1,
    },
    data: {
      tasks,
    },
  });
});

// ─── Get Single Task ──────────────────────────────────────────────────────────

/**
 * GET /api/tasks/:id
 *
 * Retrieves a single task by its MongoDB ObjectId.
 *
 * @security The query includes BOTH the task ID AND the authenticated user's ID.
 *           If the task exists but belongs to another user, the query returns
 *           null and a 404 is returned – the same as if the task didn't exist.
 *           This prevents information leakage (a 403 would confirm the task exists).
 * @returns 200 OK with the task object, or 404 if not found / not owned.
 */
exports.getTaskById = catchAsync(async (req, res, next) => {
  const task = await Task.findOne({
    _id: req.params.id,
    user: req.user.id, // ← Multi-tenancy guard: task MUST belong to this user
  }).populate('user', 'name email');

  if (!task) {
    return next(
      new AppError(
        'Task not found. It may not exist or you do not have permission to view it.',
        404
      )
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      task,
    },
  });
});

// ─── Update Task ──────────────────────────────────────────────────────────────

/**
 * PUT /api/tasks/:id
 *
 * Updates a task identified by ID, subject to ownership verification.
 *
 * @security Uses findOneAndUpdate with BOTH `_id` and `user` filters.
 *           If the task belongs to another user, the update silently fails
 *           and a 404 is returned.
 * @returns 200 OK with the updated task object.
 */
exports.updateTask = catchAsync(async (req, res, next) => {
  // Whitelist the fields that are allowed to be updated
  // This prevents an attacker from changing the `user` ownership field
  const allowedUpdates = ['title', 'description', 'priority', 'status', 'dueDate'];
  const updateData = {};

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  if (Object.keys(updateData).length === 0) {
    return next(new AppError('No valid fields provided to update.', 400));
  }

  const task = await Task.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user.id, // ← Multi-tenancy guard
    },
    updateData,
    {
      new: true,           // Return the updated document
      runValidators: true, // Ensure updated values pass schema validation
    }
  );

  if (!task) {
    return next(
      new AppError(
        'Task not found. It may not exist or you do not have permission to update it.',
        404
      )
    );
  }

  res.status(200).json({
    status: 'success',
    message: 'Task updated successfully',
    data: {
      task,
    },
  });
});

// ─── Soft Delete Task ─────────────────────────────────────────────────────────

/**
 * DELETE /api/tasks/:id
 *
 * Implements soft delete: the task is NOT permanently removed from the database.
 * Instead, the `softDeleted` flag is set to `true` and a `deletedAt` timestamp
 * is recorded. The Task model's pre-find middleware automatically excludes
 * soft-deleted tasks from all subsequent read queries.
 *
 * This approach preserves data for:
 *  - Audit trails and compliance
 *  - Potential "undo" / restore functionality
 *  - Analytics on historical task completion rates
 *
 * @security Ownership is verified before the soft-delete is applied.
 * @returns 200 OK with a confirmation message (or 204 No Content – see note).
 */
exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user.id, // ← Multi-tenancy guard
    },
    {
      softDeleted: true,
      deletedAt: new Date(),
    },
    {
      new: true,
    }
  );

  if (!task) {
    return next(
      new AppError(
        'Task not found. It may not exist or you do not have permission to delete it.',
        404
      )
    );
  }

  // Using 200 with a body instead of 204 (No Content) to provide the client
  // with confirmation of which resource was deleted.
  res.status(200).json({
    status: 'success',
    message: 'Task has been successfully deleted.',
    data: {
      deletedTaskId: task._id,
    },
  });
});

// ─── Dashboard Statistics (MongoDB Aggregation Pipeline) ─────────────────────

/**
 * GET /api/tasks/stats
 *
 * Returns comprehensive dashboard statistics for the authenticated user's tasks
 * computed entirely in the database using MongoDB's Aggregation Pipeline.
 *
 * The aggregation pipeline provides:
 *  1. Total task count
 *  2. Task counts grouped by status
 *  3. Task counts grouped by priority
 *  4. Overall completion percentage
 *  5. Count of overdue tasks (past due date and not completed)
 *
 * Using the aggregation pipeline here (instead of multiple queries + JS math)
 * is significantly more efficient as it offloads computation to the DB engine.
 *
 * @returns 200 OK with aggregated statistics object.
 */
exports.getTaskStats = catchAsync(async (req, res, _next) => {
  const userId = req.user.id;

  // ── Aggregation Pipeline ─────────────────────────────────────────────────
  const stats = await Task.aggregate([
    // ── Stage 1: Match tasks belonging ONLY to the authenticated user ──────
    // CRITICAL: softDeleted filter must be explicit here because Mongoose's
    // pre-find middleware does NOT run on aggregate() calls.
    {
      $match: {
        user: userId,           // Multi-tenancy enforcement
        softDeleted: { $ne: true }, // Exclude soft-deleted tasks
      },
    },

    // ── Stage 2: Facet – run multiple aggregations in a single pass ────────
    // `$facet` runs independent sub-pipelines on the SAME set of documents.
    // This avoids multiple round-trips to the database.
    {
      $facet: {
        // Sub-pipeline A: Overall task count and completion percentage
        overview: [
          {
            $group: {
              _id: null,
              totalTasks: { $sum: 1 },
              completedTasks: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
                },
              },
              pendingTasks: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'pending'] }, 1, 0],
                },
              },
              inProgressTasks: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0],
                },
              },
              overdueTasks: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $lt: ['$dueDate', new Date()] },    // Past due date
                        { $ne: ['$status', 'completed'] },    // Not completed
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          // Add computed completion percentage
          {
            $project: {
              _id: 0,
              totalTasks: 1,
              completedTasks: 1,
              pendingTasks: 1,
              inProgressTasks: 1,
              overdueTasks: 1,
              completionPercentage: {
                $cond: [
                  { $eq: ['$totalTasks', 0] },
                  0,
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ['$completedTasks', '$totalTasks'] },
                          100,
                        ],
                      },
                      2, // Round to 2 decimal places
                    ],
                  },
                ],
              },
            },
          },
        ],

        // Sub-pipeline B: Task count grouped by status
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              status: '$_id',
              count: 1,
            },
          },
        ],

        // Sub-pipeline C: Task count grouped by priority
        byPriority: [
          {
            $group: {
              _id: '$priority',
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              priority: '$_id',
              count: 1,
            },
          },
        ],

        // Sub-pipeline D: Tasks due in the next 7 days (upcoming deadlines)
        upcomingDeadlines: [
          {
            $match: {
              dueDate: {
                $gte: new Date(),
                $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
              status: { $ne: 'completed' },
            },
          },
          { $sort: { dueDate: 1 } },
          { $limit: 5 },
          {
            $project: {
              title: 1,
              dueDate: 1,
              priority: 1,
              status: 1,
            },
          },
        ],
      },
    },
  ]);

  // ── Reshape the Aggregation Result ───────────────────────────────────────
  // The `$facet` stage returns an array of one document with sub-arrays.
  // We extract and reshape for a clean, flat API response.
  const result = stats[0];
  const overview = result.overview[0] || {
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    completionPercentage: 0,
  };

  res.status(200).json({
    status: 'success',
    data: {
      overview,
      byStatus: result.byStatus,
      byPriority: result.byPriority,
      upcomingDeadlines: result.upcomingDeadlines,
    },
  });
});
