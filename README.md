# 🔐 Secure Multi-User Task Management API

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-≥18.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Authentication-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**A production-ready, secure REST API for multi-user task management built with Node.js, Express, and MongoDB Atlas. Features JWT-based authentication, role-based data isolation, advanced querying, and enterprise-grade security middleware.**

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Architecture & Design](#-architecture--design)
- [Security Implementation](#-security-implementation)
- [API Reference](#-api-reference)
  - [Auth Endpoints](#auth-endpoints)
  - [User Endpoints](#user-endpoints)
  - [Task Endpoints](#task-endpoints)
- [Request & Response Examples](#-request--response-examples)
- [Advanced Query Features](#-advanced-query-features)
- [Data Models](#-data-models)
- [Environment Variables](#-environment-variables)
- [Getting Started](#-getting-started)
- [Testing with Postman](#-testing-with-postman)
- [Error Handling](#-error-handling)
- [Validation Rules](#-validation-rules)

---

## 🌟 Overview

This project is a **Task 2** submission for the **ITSimplera Internship Program**. It implements a fully-featured, secure RESTful API that allows multiple users to independently manage their tasks with complete data isolation between accounts.

Each user can only see, create, update, and delete **their own tasks** — enforced at every database query level via a strict **multi-tenancy guard pattern**. The API is built following production best practices including security hardening, input validation, structured error handling, and performance optimization.

---

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** — Stateless token-based auth with 7-day token expiry
- **Password Hashing** — bcrypt with configurable salt rounds (default: 12)
- **Password Change Invalidation** — Old tokens are automatically invalidated after a password change
- **Multi-Tenancy Enforcement** — Every DB query is scoped to `req.user.id`; users can never access other users' data
- **NoSQL Injection Prevention** — `express-mongo-sanitize` strips `$` operators from input
- **Rate Limiting** — 100 requests per IP per 15-minute window
- **Secure HTTP Headers** — `helmet` sets CSP, XSS, MIME-sniffing, and clickjacking protections
- **CORS** — Configurable allowed origins

### 📝 Task Management
- **Full CRUD** — Create, Read, Update, Soft-Delete tasks
- **Soft Delete** — Tasks are flagged `softDeleted: true` instead of being permanently removed (preserves audit trails)
- **Status Tracking** — `pending` → `in-progress` → `completed`
- **Priority Levels** — `low`, `medium`, `high`
- **Due Date Validation** — Due dates cannot be set in the past
- **Overdue Detection** — Virtual `isOverdue` field computed on every task

### 🔍 Advanced Querying
- **Full-Text Search** — Case-insensitive regex search across `title` and `description`
- **Dynamic Filtering** — Filter by `status` and/or `priority`
- **Pagination** — Configurable page size (max 50), with metadata (`totalPages`, `hasNextPage`, etc.)
- **Flexible Sorting** — Sort by any allowed field in `asc` or `desc` order; multi-field sort supported
- **Dashboard Stats** — MongoDB Aggregation Pipeline with `$facet` for single-query multi-stat computation

### 👤 User Profile Management
- **View Profile** — Get the authenticated user's profile
- **Update Profile** — Update `name` and `profilePicture` (whitelist approach prevents mass-assignment)
- **Change Password** — Requires old password verification; issues a fresh JWT automatically

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js ≥ 18 | JavaScript server runtime |
| **Framework** | Express 4.x | HTTP server & routing |
| **Database** | MongoDB Atlas + Mongoose 8.x | Document DB & ODM |
| **Auth** | JSON Web Tokens (jsonwebtoken) | Stateless authentication |
| **Password** | bcryptjs | Secure password hashing |
| **Validation** | express-validator | Input sanitization & validation |
| **Security** | helmet, express-mongo-sanitize | HTTP header & NoSQL injection protection |
| **Rate Limiting** | express-rate-limit | Brute-force & DDoS mitigation |
| **CORS** | cors | Cross-origin resource sharing |
| **Logging** | morgan | HTTP request logging (dev mode) |
| **Config** | dotenv | Environment variable management |
| **Dev Tools** | nodemon | Auto-restart on file changes |

---

## 📁 Project Structure

```
ITSimplera Internship Task2/
│
├── 📄 server.js                    # App entry point — Express init, middleware, routes, DB
│
├── 📁 config/
│   └── db.js                       # MongoDB connection with Mongoose
│
├── 📁 models/
│   ├── User.js                     # User schema: name, email, password (bcrypt), profilePicture
│   └── Task.js                     # Task schema: title, description, status, priority, dueDate
│
├── 📁 controllers/
│   ├── authController.js           # register, login, logout
│   ├── userController.js           # getProfile, updateProfile, changePassword
│   └── taskController.js           # CRUD + getAllTasks (search/filter/page/sort) + getTaskStats
│
├── 📁 routes/
│   ├── authRoutes.js               # POST /api/auth/register|login|logout
│   ├── userRoutes.js               # GET|PUT /api/users/profile, PUT /api/users/change-password
│   └── taskRoutes.js               # GET|POST /api/tasks, GET /api/tasks/stats, GET|PUT|DELETE /api/tasks/:id
│
├── 📁 middlewares/
│   ├── authMiddleware.js           # protect — JWT verification, user lookup, password-change check
│   ├── validationMiddleware.js     # express-validator rule sets for all endpoints
│   └── errorHandler.js            # Global error handler (Mongoose, JWT, operational errors)
│
├── 📁 utils/
│   ├── AppError.js                 # Custom operational error class with statusCode
│   ├── catchAsync.js               # Async error wrapper — eliminates try/catch boilerplate
│   └── jwtHelper.js                # signToken(), createSendToken() — centralized JWT logic
│
├── 📄 .env                         # Environment variables (NOT committed to git)
├── 📄 .gitignore                   # Excludes node_modules, .env, etc.
└── 📄 package.json                 # Dependencies, scripts, engines
```

---

## 🏗 Architecture & Design

### Request Lifecycle

```
Client Request
     │
     ▼
[Global Middlewares]
  helmet (security headers)
  cors (origin control)
  rate limiter (100 req/15min)
  express.json (body parsing)
  mongoSanitize (NoSQL injection)
  morgan (logging – dev only)
     │
     ▼
[Route Matching]
  /api/auth/*   → authRoutes
  /api/users/*  → userRoutes
  /api/tasks/*  → taskRoutes
     │
     ▼
[Validation Middleware]
  express-validator rules
  → 422 on failure
     │
     ▼
[protect Middleware]      ← Only for /api/users & /api/tasks
  Extract Bearer token
  Verify JWT signature
  Check user still exists
  Check password not changed
  Attach req.user
     │
     ▼
[Controller]
  Business logic
  DB query (always scoped to req.user.id)
  JSON response
     │
     ▼
[Global Error Handler]
  Formats Mongoose/JWT/operational errors
  Returns structured JSON error response
```

### Multi-Tenancy Pattern

Every single database operation in the task controller enforces ownership:

```js
// ✅ ALWAYS — user field scopes every query to the authenticated user
Task.find({ user: req.user.id })
Task.findOne({ _id: req.params.id, user: req.user.id })
Task.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, ...)
Task.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { softDeleted: true })
```

If a task exists but belongs to another user, the response is `404 Not Found` — not `403 Forbidden` — to **prevent information leakage** (a 403 would confirm the resource exists).

---

## 🔒 Security Implementation

| Threat | Mitigation |
|---|---|
| **Brute Force / DDoS** | Rate limiter: 100 req / 15 min per IP |
| **Password Theft** | bcrypt hashing with 12 salt rounds; `select: false` schema option |
| **JWT Tampering** | HMAC-SHA256 signature with `JWT_SECRET`; verified on every protected request |
| **Stale Tokens** | `changedPasswordAfter()` check invalidates pre-change tokens |
| **NoSQL Injection** | `express-mongo-sanitize` strips `$` and `.` from all input |
| **XSS / Clickjacking** | `helmet` sets `Content-Security-Policy`, `X-Frame-Options`, etc. |
| **Mass Assignment** | `filterObject()` whitelists only `name` and `profilePicture` for profile updates |
| **Cross-Tenant Access** | All queries include `user: req.user.id` |
| **Payload Flooding** | `express.json({ limit: '10kb' })` |
| **ReDoS** | Search strings are sanitized with regex escape before use |

---

## 📡 API Reference

### Base URL
```
http://localhost:5000/api
```

### Health Check
```
GET /api/health
```

---

### Auth Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Create a new user account |
| `POST` | `/api/auth/login` | ❌ | Login and receive a JWT |
| `POST` | `/api/auth/logout` | ✅ Bearer Token | Logout (client-side token disposal) |

---

### User Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/users/profile` | ✅ Bearer Token | Get authenticated user's profile |
| `PUT` | `/api/users/profile` | ✅ Bearer Token | Update `name` or `profilePicture` |
| `PUT` | `/api/users/change-password` | ✅ Bearer Token | Change password (old password required) |

---

### Task Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/tasks` | ✅ Bearer Token | Get all tasks (supports search, filter, pagination, sort) |
| `POST` | `/api/tasks` | ✅ Bearer Token | Create a new task |
| `GET` | `/api/tasks/stats` | ✅ Bearer Token | Get aggregated dashboard statistics |
| `GET` | `/api/tasks/:id` | ✅ Bearer Token | Get a single task by ID |
| `PUT` | `/api/tasks/:id` | ✅ Bearer Token | Update a task by ID |
| `DELETE` | `/api/tasks/:id` | ✅ Bearer Token | Soft-delete a task by ID |

---

## 📨 Request & Response Examples

### Register a User

**Request:**
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Abdul Haseeb",
  "email": "haseeb@example.com",
  "password": "Haseeb1234",
  "profilePicture": "https://example.com/avatar.jpg"
}
```

**Response `201 Created`:**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "user": {
      "_id": "6a4f523944a525bab5cc8122",
      "name": "Abdul Haseeb",
      "email": "haseeb@example.com",
      "profilePicture": "https://example.com/avatar.jpg",
      "createdAt": "2026-07-09T09:00:00.000Z",
      "updatedAt": "2026-07-09T09:00:00.000Z"
    }
  }
}
```

---

### Create a Task

**Request:**
```http
POST /api/tasks
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "title": "Complete Internship Task 2",
  "description": "Build a secure REST API with Node.js, Express, and MongoDB",
  "priority": "high",
  "status": "in-progress",
  "dueDate": "2026-12-31"
}
```

**Response `201 Created`:**
```json
{
  "status": "success",
  "data": {
    "task": {
      "_id": "6a4f523944a525bab5cc9999",
      "title": "Complete Internship Task 2",
      "description": "Build a secure REST API with Node.js, Express, and MongoDB",
      "priority": "high",
      "status": "in-progress",
      "dueDate": "2026-12-31T00:00:00.000Z",
      "user": "6a4f523944a525bab5cc8122",
      "isOverdue": false,
      "createdAt": "2026-07-09T09:10:00.000Z"
    }
  }
}
```

---

### Get Dashboard Stats

**Request:**
```http
GET /api/tasks/stats
Authorization: Bearer <your_jwt_token>
```

**Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "overview": {
      "totalTasks": 10,
      "completedTasks": 4,
      "pendingTasks": 3,
      "inProgressTasks": 3,
      "overdueTasks": 1,
      "completionPercentage": 40.00
    },
    "byStatus": [
      { "status": "completed", "count": 4 },
      { "status": "in-progress", "count": 3 },
      { "status": "pending", "count": 3 }
    ],
    "byPriority": [
      { "priority": "high", "count": 5 },
      { "priority": "low", "count": 2 },
      { "priority": "medium", "count": 3 }
    ],
    "upcomingDeadlines": [
      {
        "_id": "...",
        "title": "Complete Internship Task 2",
        "dueDate": "2026-07-15T00:00:00.000Z",
        "priority": "high",
        "status": "in-progress"
      }
    ]
  }
}
```

---

## 🔍 Advanced Query Features

The `GET /api/tasks` endpoint supports five query parameters that can be combined freely:

### 1. Full-Text Search
```
GET /api/tasks?search=internship
```
Searches across `title` and `description` using case-insensitive regex (ReDoS-safe).

### 2. Filtering
```
GET /api/tasks?status=in-progress&priority=high
```
- `status`: `pending` | `in-progress` | `completed`
- `priority`: `low` | `medium` | `high`

### 3. Pagination
```
GET /api/tasks?page=2&limit=5
```
- `page`: default `1`
- `limit`: default `10`, max `50`

Response includes full pagination metadata:
```json
"pagination": {
  "currentPage": 2,
  "totalPages": 4,
  "totalTasks": 20,
  "tasksPerPage": 5,
  "hasNextPage": true,
  "hasPreviousPage": true
}
```

### 4. Sorting
```
GET /api/tasks?sort=dueDate:asc
GET /api/tasks?sort=dueDate:asc,priority:desc
```
Allowed sort fields: `dueDate`, `createdDate`, `createdAt`, `updatedAt`, `priority`, `status`, `title`

### 5. Combined Example
```
GET /api/tasks?search=api&status=in-progress&priority=high&page=1&limit=5&sort=dueDate:asc
```

---

## 🗃 Data Models

### User Model

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | String | ✅ | 2–60 characters |
| `email` | String | ✅ | Unique, lowercase, validated via `validator` library |
| `password` | String | ✅ | Min 8 chars; bcrypt hashed; `select: false` |
| `profilePicture` | String | ❌ | Must be valid HTTP/HTTPS URL |
| `passwordChangedAt` | Date | ❌ | Auto-set on password change; `select: false` |
| `createdAt` | Date | Auto | Mongoose timestamps |
| `updatedAt` | Date | Auto | Mongoose timestamps |

### Task Model

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | String | ✅ | 3–120 characters |
| `description` | String | ✅ | 5–2000 characters |
| `priority` | String | ❌ | `low` \| `medium` \| `high`; default: `medium` |
| `status` | String | ❌ | `pending` \| `in-progress` \| `completed`; default: `pending` |
| `dueDate` | Date | ✅ | Cannot be in the past on creation |
| `user` | ObjectId | ✅ | Reference to `User`; set from JWT (not request body) |
| `softDeleted` | Boolean | Auto | `false` by default; `select: false` |
| `deletedAt` | Date | Auto | Set on soft-delete; `select: false` |
| `createdDate` | Date | Auto | Immutable creation timestamp |
| `isOverdue` | Virtual | — | `true` if `dueDate < now` and status ≠ `completed` |

### MongoDB Indexes (Task)

| Index | Purpose |
|---|---|
| `{ user, status, priority }` | Optimizes the most common filtered list query |
| `{ dueDate }` | Optimizes date-range queries and sorting |
| `{ title: 'text', description: 'text' }` | Enables full-text search (title weighted 2x) |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# MongoDB Connection String (MongoDB Atlas)
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your_super_secret_key_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# bcrypt Salt Rounds (10-12 recommended for production)
BCRYPT_SALT_ROUNDS=12
```

> ⚠️ **Never commit `.env` to version control.** It is listed in `.gitignore`.

**Generate a strong JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v8+
- A **MongoDB Atlas** account (free tier works)

### Installation

**1. Clone the repository:**
```bash
git clone https://github.com/abdulhaseeb4183/ITSimplera_Task2_-Secure-Multi-User-Task-Management-API-with-JWT-Authentication.git
cd "ITSimplera_Task2_-Secure-Multi-User-Task-Management-API-with-JWT-Authentication"
```

**2. Install dependencies:**
```bash
npm install
```

**3. Configure environment variables:**
```bash
# Create .env file and add your configuration
# See "Environment Variables" section above
```

**4. Start the server:**
```bash
# Development (with auto-restart via nodemon)
npm run dev

# Production
npm start
```

**5. Verify the server is running:**
```
GET http://localhost:5000/api/health
```
Expected response:
```json
{
  "status": "success",
  "message": "Task Management API is running",
  "timestamp": "2026-07-09T09:00:00.000Z",
  "environment": "development"
}
```

---

## 🧪 Testing with Postman

### Step 1 — Register
- Method: `POST`
- URL: `http://localhost:5000/api/auth/register`
- Body → raw → JSON:
```json
{
  "name": "Your Name",
  "email": "you@example.com",
  "password": "YourPass123"
}
```
📋 Copy the `token` from the response.

### Step 2 — Use Token for Protected Routes
- Go to **Authorization** tab
- Select type: **Bearer Token**
- Paste your token in the **Token** field (without the word "Bearer")

### Step 3 — Create a Task
- Method: `POST`
- URL: `http://localhost:5000/api/tasks`
- Authorization: Bearer Token (from Step 2)
- Body → raw → JSON:
```json
{
  "title": "My First Task",
  "description": "Testing the task management API",
  "priority": "high",
  "status": "in-progress",
  "dueDate": "2027-01-01"
}
```

### Step 4 — Get All Tasks
- Method: `GET`
- URL: `http://localhost:5000/api/tasks`
- Authorization: Bearer Token

---

## ⚠️ Error Handling

All errors follow a consistent JSON structure:

```json
{
  "status": "fail",
  "message": "Human-readable error description"
}
```

| HTTP Code | Status | Cause |
|---|---|---|
| `400` | `fail` | Bad request (e.g., no fields to update) |
| `401` | `fail` | Not authenticated / invalid token |
| `404` | `fail` | Resource not found or not owned |
| `409` | `fail` | Conflict (e.g., email already registered) |
| `422` | `fail` | Validation failed (input rules not met) |
| `429` | `fail` | Too many requests (rate limit exceeded) |
| `500` | `error` | Unexpected server error |

The global error handler (`middlewares/errorHandler.js`) provides specific handling for:
- `CastError` (invalid MongoDB ObjectId)
- `11000 Duplicate Key` (MongoDB unique constraint violation)
- `ValidationError` (Mongoose schema validation)
- `JsonWebTokenError` (invalid token)
- `TokenExpiredError` (expired token)

---

## ✅ Validation Rules

### Register / Auth
| Field | Rules |
|---|---|
| `name` | Required, 2–60 characters |
| `email` | Required, valid email format |
| `password` | Required, min 8 chars, must have uppercase + lowercase + number |
| `profilePicture` | Optional, must be valid HTTP/HTTPS URL |

### Task Create
| Field | Rules |
|---|---|
| `title` | Required, 3–120 characters |
| `description` | Required, 5–2000 characters |
| `priority` | Optional: `low`, `medium`, or `high` |
| `status` | Optional: `pending`, `in-progress`, or `completed` |
| `dueDate` | Required, ISO 8601 format, cannot be in the past |

### Change Password
| Field | Rules |
|---|---|
| `oldPassword` | Required |
| `newPassword` | Required, min 8 chars, uppercase + lowercase + number |
| `confirmPassword` | Required, must match `newPassword` |

---

## 👨‍💻 Author

**Abdul Haseeb**
- GitHub: [@abdulhaseeb4183](https://github.com/abdulhaseeb4183)
- Internship: ITSimplera — Task 2

---


<div align="center">
  <strong>Built with ❤️ for ITSimplera Internship Program</strong>
</div>
