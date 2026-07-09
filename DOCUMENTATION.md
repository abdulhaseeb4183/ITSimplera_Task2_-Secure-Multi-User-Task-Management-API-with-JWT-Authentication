# 📄 Technical Documentation

## Secure Multi-User Task Management API with JWT Authentication
**Internship Track:** Full Stack Web Development  
**Task Reference:** Week 2 Task — ITSimplera Solutions  
**Submitted By:** Abdul Haseeb  
**Submitted To:** ITSimplera Solutions  
**Date:** 9 July 2026  

---

## Table of Contents
1. [Executive Summary & Objective](#1-executive-summary--objective)
2. [System Architecture & Directory Structure](#2-system-architecture--directory-structure)
3. [Database Schema Design (ERD & Model Details)](#3-database-schema-design-erd--model-details)
4. [Security & Defensive Design Implementations](#4-security--defensive-design-implementations)
5. [Advanced Query Features](#5-advanced-query-features)
6. [API Endpoint Reference](#6-api-endpoint-reference)
7. [Postman Testing Guide & Verification](#7-postman-testing-guide--verification)
8. [Centralized Error Handling](#8-centralized-error-handling)

---

## 1. Executive Summary & Objective

### 1.1 Project Overview
Developed by Abdul Haseeb for the ITSimplera Institute internship, this Node.js, Express, and MongoDB REST API enables secure multi-user task management. It structurally guarantees strict data isolation, preventing any user from accessing, modifying, or deleting another account's data.

Built for security, isolation, and robustness, the system integrates authentication, validation, and error handling directly into its middleware and schemas. This ensures all requests are authorized and sanitized before execution, while automatically converting any failures into structured JSON responses.

### 1.2 Scope of the Solution
The implementation addresses four functional pillars:
* **Secure Multi-User Data Isolation:** Every task record is bound to an owning user ID at the database layer, and every controller query is scoped by the authenticated requester's identity, making cross-account data leakage structurally impossible rather than merely policy-enforced.
* **Advanced Task Operations:** Full-text search, multi-field dynamic filtering, cursor-independent pagination, flexible multi-key sorting, and aggregation-driven dashboard statistics.
* **Defensive Security Measures:** JWT-based stateless authentication, bcrypt password hashing, HTTP header hardening via Helmet, brute-force mitigation via rate limiting, and NoSQL injection prevention via input sanitization.
* **Operational Reliability:** A centralized error-handling pipeline that normalizes Mongoose, JWT, and application-level errors into consistent, client-safe HTTP responses.

### 1.3 Business & Learning Objectives
From an academic standpoint, this task was designed to evaluate the intern's proficiency in constructing a layered Express.js architecture, applying industry-standard authentication patterns, and reasoning about database performance and security at a level consistent with professional backend engineering practice.

---

## 2. System Architecture & Directory Structure

### 2.1 Architectural Pattern: Express MVC
The application adapts a layered MVC architecture for a headless REST API, replacing server-rendered templates with JSON response payloads. This separation of concerns isolates database logic from request handling, keeps routing independent, and centralizes cross-cutting behaviors—like authentication and validation—into reusable middleware to eliminate code duplication.

Request flow is strictly unidirectional: incoming HTTP requests pass through global security and parsing middleware, advance through route-specific guards, and finally invoke the designated controller to interact with Mongoose models. Any error triggered at any layer is automatically forwarded via the `next(error)` mechanism straight to the centralized error handler.

### 2.2 Directory Structure
```
ITSimplera_Task2_Secure-Multi-User-Task-Management-API/
├── config/
│   └── db.js                       # MongoDB Atlas connection bootstrap
├── models/
│   ├── User.js                     # User schema, password hashing hooks
│   └── Task.js                     # Task schema, virtuals, indexes
├── controllers/
│   ├── authController.js           # Register, login, logout logic
│   ├── userController.js           # Profile retrieval, password change
│   └── taskController.js           # CRUD, search, filter, stats
├── routes/
│   ├── authRoutes.js               # /api/auth/*
│   ├── userRoutes.js               # /api/users/*
│   └── taskRoutes.js               # /api/tasks/*
├── middlewares/
│   ├── authMiddleware.js           # JWT verification & req.user injection
│   ├── validationMiddleware.js     # express-validator rule sets & handler
│   └── errorHandler.js            # Centralized error normalization
├── utils/
│   ├── AppError.js                 # Custom operational error class
│   ├── catchAsync.js               # Async controller error-forwarding wrapper
│   └── jwtHelper.js                # Token signing / verification helpers
├── .env                            # Environment secrets (excluded from VCS)
├── server.js                       # Application entry point
├── package.json                    # Dependency manifest & scripts
└── README.md                       # Setup & usage instructions
```

### 2.3 File & Folder Responsibilities
* **`config/db.js`**: Establishes and exports the Mongoose connection to MongoDB Atlas, including connection-string handling and startup failure logging.
* **`models/User.js`**: Defines the user schema, including credential fields, a pre-save bcrypt hashing hook, and instance methods for password comparison and password-change tracking.
* **`models/Task.js`**: Defines the task schema, virtual properties, compound and text indexes, and the soft-delete flags.
* **`controllers/authController.js`**: Implements registration, login, and logout handlers, and issues signed JWTs on successful authentication.
* **`controllers/userController.js`**: Implements authenticated profile retrieval and password-change workflows.
* **`controllers/taskController.js`**: Implements task CRUD, full-text search, filtering, pagination, sorting, and the statistics aggregation endpoint.
* **`routes/*.js`**: Declaratively binds HTTP verbs and paths to controller functions, attaching authentication guards and validation chains per route.
* **`middlewares/authMiddleware.js`**: Extracts and verifies the Bearer JWT, re-hydrates the requesting user from the database, and rejects stale tokens issued before a password change.
* **`middlewares/validationMiddleware.js`**: Houses express-validator rule chains per endpoint and a shared handler that short-circuits requests with malformed input.
* **`middlewares/errorHandler.js`**: Final Express error-handling middleware; normalizes all thrown/forwarded errors into a consistent JSON error contract.
* **`utils/AppError.js`**: A custom Error subclass carrying an HTTP status code and an `isOperational` flag used to distinguish expected failures from programming defects.
* **`utils/catchAsync.js`**: A higher-order function that wraps async controller handlers so rejected promises are automatically forwarded to Express error handling, eliminating repetitive try/catch blocks.
* **`utils/jwtHelper.js`**: Centralizes JWT signing (with expiry and secret configuration) and verification logic used across the auth middleware and controllers.
* **`server.js`**: Application bootstrap: loads environment variables, initializes the Express app, mounts global middleware and routers, and starts the HTTP listener.

---

## 3. Database Schema Design (ERD & Model Details)

The data layer is modeled with Mongoose schemas that enforce structural and semantic constraints at the application boundary, complementing MongoDB's inherently flexible document model with explicit validation, typed fields, and relational references implemented via ObjectId reference fields.

### 3.1 User Schema
| Field | Type | Constraints / Notes |
|---|---|---|
| `name` | String | Required; trimmed; maximum length enforced for display integrity. |
| `email` | String | Required; unique index; lowercased and trimmed; validated against standard email pattern. |
| `password` | String | Required; minimum length 8; select: false so it is excluded from query results by default. |
| `passwordChangedAt` | Date | Set automatically whenever the password is updated; used to invalidate JWTs issued before the change. |
| `createdAt / updatedAt` | Date | Populated automatically via Mongoose's `timestamps: true` schema option. |

### 3.2 Task Schema
| Field | Type | Constraints / Notes |
|---|---|---|
| `title` | String | Required; trimmed; maximum length enforced; indexed for full-text search. |
| `description` | String | Optional; trimmed; indexed for full-text search. |
| `status` | String (enum) | One of: `pending`, `in-progress`, `completed`; defaults to `pending`. |
| `priority` | String (enum) | One of: `low`, `medium`, `high`; defaults to `medium`. |
| `dueDate` | Date | Optional; validated to ensure logical consistency with task lifecycle. |
| `user` | ObjectId (ref: User) | Required; foreign-key reference establishing task ownership; the cornerstone of data isolation. |
| `softDeleted` | Boolean | Defaults to false; flips to true on delete instead of removing the document. |
| `deletedAt` | Date | Populated at the moment of soft deletion; null otherwise. |
| `createdAt / updatedAt` | Date | Populated automatically via Mongoose's `timestamps: true` schema option. |

### 3.3 Design Decisions

#### 3.3.1 Virtual Properties — `isOverdue`
Rather than persisting an `isOverdue` boolean that would require background jobs to keep synchronized with the passage of time, the schema defines a Mongoose virtual property that computes overdue status on-the-fly by comparing `dueDate` against the current server time whenever the field is read, and only for tasks not already marked completed. This keeps the stored document minimal while still exposing a convenient, always-accurate field in the serialized API response.

#### 3.3.2 Compound and Text Indexes
* **Compound Index on `{ user: 1, status: 1, priority: 1 }`:** Accelerates the overwhelming majority of task-list queries, which always filter by the owning user and frequently add status/priority filters on top. Because MongoDB can satisfy a query using a prefix of a compound index, this single index also serves user-only queries and user+status queries without needing separate indexes.
* **Text Index on `{ title: "text", description: "text" }`:** Enables the `$text` query operator used by the full-text search feature, allowing MongoDB to perform tokenized, case-insensitive matching internally rather than requiring inefficient regex scans across the collection.

#### 3.3.3 Non-Destructive Deletion (Soft Delete)
Deleting a task sets `softDeleted: true` and stamps `deletedAt` with the current timestamp rather than issuing a MongoDB `deleteOne` call. All read queries in the controller layer therefore exclude soft-deleted tasks by default. This design preserves an audit trail for compliance, allows for future restoration capability, and avoids the risk of accidental data loss.

---

## 4. Security & Defensive Design Implementations

### 4.1 JWT Authentication & Middleware Protection
* **Stateless JWTs:** Upon login, the server issues a signed JWT containing the user's ID with a set expiration window.
* **4-Stage Verification Middleware:**
  * **Extraction:** Retrieves the Bearer token from the Authorization header (rejects missing/malformed with a 401).
  * **Signature Check:** Validates the signature and expiration against the secret key (rejects forged/expired tokens).
  * **User Existence:** Re-fetches the user from the database to ensure the account still exists.
  * **Stale Token Check:** Rejects the token if the user changed their password after the token was issued.
  * **Controller Trust:** Passing all checks attaches the authenticated user to `req.user`, allowing downstream logic to safely trust the identity.

### 4.2 Password Safety
* **Password Hashing:** Plaintext passwords are never saved; a Mongoose pre-save hook automatically hashes new or modified passwords using bcryptjs with 12 salt rounds.
* **Leak Prevention:** The password field is configured with `select: false`, omitting it from standard query results to prevent accidental serialization into API responses unless explicitly requested.

### 4.3 Request Validation
Every mutating endpoint uses an `express-validator` rule chain to assert type correctness and enforce field constraints, such as a minimum 8-character password with mixed cases and numbers. If any payload is unexpected or malformed, a shared handler immediately short-circuits the request with a `422 Unprocessable Entity` response containing specific field errors.

### 4.4 API Hardening
* **Secure HTTP Headers (`helmet`):** Applies secure headers to mitigate clickjacking, MIME-sniffing, and related browser-level attack vectors.
* **Rate Limiting (`express-rate-limit`):** Caps each client IP address to 100 requests per 15-minute window to prevent brute-force attacks and resource exhaustion.
* **NoSQL Injection Prevention (`express-mongo-sanitize`):** Strips request keys containing Mongo operator characters (`$` and `.`) from body, query, and params before they can be interpreted as query operators.

### 4.5 Data Isolation (Multi-Tenancy Guard)
Data isolation is structurally embedded into the data-access layer. Every query issued by `taskController.js` enforces `user: req.user.id` as a mandatory predicate, sourcing the identity exclusively from the verified JWT payload rather than client-supplied inputs. Malicious requests attempting to access another user's task ID in the URL fail and return zero matching documents.

---

## 5. Advanced Query Features

### 5.1 Full-Text Search
A `search` query parameter is mapped to MongoDB's `$text` operator, which performs case-insensitive, stemmed, tokenized matching against the text index defined on `title` and `description`. This is substantially more efficient than a `$regex`-based approach, since `$text` queries use the index directly rather than scanning every document.

### 5.2 Dynamic Filtering
The controller builds its Mongoose filter object incrementally: it always starts from the mandatory `{ user: req.user.id, softDeleted: false }` base, then conditionally appends `status` and `priority` predicates only when the corresponding query parameters are present in the request.

### 5.3 Pagination
List endpoints accept `page` and `limit` query parameters (with safe numeric defaults and upper bounds). These are translated into MongoDB's `skip` and `limit` cursor operations: `skip = (page - 1) * limit`. To avoid the cost of an unbounded collection scan, the total document count is computed via `countDocuments`.

### 5.4 Flexible Sorting
A `sort` query parameter accepts one or more comma-separated field names, each optionally prefixed with a colon and direction (e.g. `sort=dueDate:desc`). The controller parses this parameter into a Mongoose-compatible sort object at request time.

### 5.5 Dashboard Statistics
The `/api/tasks/stats` endpoint uses MongoDB’s `$facet` stage to compute total tasks, status breakdowns, completion rates, and overdue metrics concurrently. By running multiple independent sub-pipelines inside a single query pass, it eliminates the need for separate database round trips.

---

## 6. API Endpoint Reference

### 6.1 Authentication Endpoints
* `POST /api/auth/register` | Body: `name, email, password` | Auth: No | Success Status: `201 Created`
* `POST /api/auth/login` | Body: `email, password` | Auth: No | Success Status: `200 OK`
* `POST /api/auth/logout` | Body: None (Bearer token) | Auth: Yes | Success Status: `200 OK`

### 6.2 User Profile Endpoints
* `GET /api/users/profile` | Body: None | Auth: Yes | Success Status: `200 OK`
* `PUT /api/users/change-password` | Body: `oldPassword, newPassword, confirmPassword` | Auth: Yes | Success Status: `200 OK`

### 6.3 Task Endpoints
* `POST /api/tasks` | Body: `title, description, status, priority, dueDate` | Auth: Yes | Success Status: `201 Created`
* `GET /api/tasks` | Query: `search, status, priority, sort, page, limit` | Auth: Yes | Success Status: `200 OK`
* `GET /api/tasks/:id` | Body: None | Auth: Yes | Success Status: `200 OK`
* `PUT /api/tasks/:id` | Body: Any updatable task field | Auth: Yes | Success Status: `200 OK`
* `DELETE /api/tasks/:id` | Body: None (soft delete) | Auth: Yes | Success Status: `200 OK`
* `GET /api/tasks/stats` | Body: None | Auth: Yes | Success Status: `200 OK`

---

## 7. Postman Testing Guide & Verification

All endpoints have been thoroughly tested on Postman to ensure validation rules and security blocks are active:
* **Validation Rules:** Validated passwords require uppercase, lowercase, numbers, and minimum length. Task creation rejects past due dates.
* **Authentication Security:** Accessing `/api/tasks` without a Bearer token returns `401 Unauthorized`.

---

## 8. Centralized Error Handling

### 8.1 The `AppError` Class
`utils/AppError.js` defines a custom Error subclass carrying an HTTP `statusCode` and an `isOperational` flag.

### 8.2 The `catchAsync` Wrapper
A higher-order function that wraps async controller handlers so rejected promises are automatically forwarded to Express error handling (`next(err)`).

### 8.3 Centralized Middleware
`errorHandler.js` normalizes errors into a clean JSON error response:
* **Mongoose CastError:** 400 Bad Request
* **Mongoose Duplicate Key (11000):** 409 Conflict
* **Mongoose ValidationError:** 422 Unprocessable Entity
* **JsonWebTokenError:** 401 Unauthorized
* **TokenExpiredError:** 401 Unauthorized
