/**
 * @file models/Task.js
 * @description Mongoose schema and model for the Task entity.
 *
 * Multi-tenancy is enforced at the schema level by requiring a `user`
 * reference field on every task. All controllers MUST filter queries
 * with `{ user: req.user.id }` – the multi-tenancy middleware ensures this.
 *
 * Soft delete strategy: tasks are NEVER permanently removed from the DB.
 * Instead, the `softDeleted` flag is set to `true`, and all read queries
 * exclude soft-deleted records by default via a query helper or middleware.
 */

'use strict';

const mongoose = require('mongoose');

// ─── Schema Definition ────────────────────────────────────────────────────────

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [120, 'Title must not exceed 120 characters'],
    },

    description: {
      type: String,
      required: [true, 'Task description is required'],
      trim: true,
      minlength: [5, 'Description must be at least 5 characters long'],
      maxlength: [2000, 'Description must not exceed 2000 characters'],
    },

    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: "Priority must be one of: 'low', 'medium', 'high'",
      },
      default: 'medium',
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'in-progress', 'completed'],
        message: "Status must be one of: 'pending', 'in-progress', 'completed'",
      },
      default: 'pending',
    },

    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      validate: {
        // Ensure the due date is not in the past when the task is first created.
        // We only run this validator on new documents (not on updates).
        validator: function (value) {
          if (this.isNew) {
            return value >= new Date();
          }
          return true;
        },
        message: 'Due date cannot be in the past',
      },
    },

    createdDate: {
      type: Date,
      default: Date.now,
      immutable: true, // Once set, Mongoose will not allow this to be changed
    },

    /**
     * CRITICAL MULTI-TENANCY FIELD:
     * Every task MUST belong to exactly one user.
     * All queries MUST include `{ user: req.user.id }` as a filter
     * to ensure users cannot access each other's tasks.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task must belong to a user'],
    },

    /**
     * Soft Delete Flag:
     * When `true`, the task is considered deleted and is excluded from
     * all standard read queries. Data is preserved for audit purposes.
     */
    softDeleted: {
      type: Boolean,
      default: false,
      select: false, // Hidden from API responses by default
    },

    /**
     * Tracks when the task was soft-deleted, useful for archival/compliance.
     */
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true, // Adds `createdAt` and `updatedAt` managed fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

/**
 * Compound index on `user` + `status` + `priority`:
 * Optimises the most common query pattern – "fetch all tasks for a user,
 * filtered by status or priority" – dramatically reducing scan time.
 */
taskSchema.index({ user: 1, status: 1, priority: 1 });

/**
 * Index on `dueDate` for efficient date-range queries and sorting.
 */
taskSchema.index({ dueDate: 1 });

/**
 * Text index on `title` and `description` for full-text search capability.
 * MongoDB's $text operator uses this index for efficient keyword searches.
 */
taskSchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 10, description: 5 } } // Title matches are ranked higher
);

// ─── Query Middleware (Soft Delete Filter) ────────────────────────────────────

/**
 * Automatically exclude soft-deleted tasks from ALL `find*` queries.
 * This acts as a transparent global filter so controllers never have to
 * remember to add `{ softDeleted: false }` manually.
 *
 * This middleware runs before: find, findOne, findOneAndUpdate, etc.
 */
taskSchema.pre(/^find/, function (next) {
  // `this` refers to the current query object
  // Append the soft-delete filter to whatever filter is already applied
  this.where({ softDeleted: { $ne: true } });
  next();
});

// ─── Virtual Properties ───────────────────────────────────────────────────────

/**
 * `isOverdue` virtual: computes whether the task has passed its due date.
 * Computed on-the-fly; not stored in the DB.
 */
taskSchema.virtual('isOverdue').get(function () {
  if (this.status === 'completed') return false;
  return this.dueDate < new Date();
});

// ─── Model Export ─────────────────────────────────────────────────────────────

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
