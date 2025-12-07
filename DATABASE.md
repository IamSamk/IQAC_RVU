# IQAC Database Schema Documentation

> **Last Updated:** December 7, 2025  
> **Purpose:** Document current database structure, proposed changes, and migration strategy

---

## Table of Contents
1. [Current Database Schema (ER Diagram)](#current-database-schema-er-diagram)
2. [Current Schema Details](#current-schema-details)
3. [Proposed Schema Changes](#proposed-schema-changes)
4. [New ER Diagram (Proposed)](#new-er-diagram-proposed)
5. [Impact Analysis](#impact-analysis)
6. [Migration Strategy](#migration-strategy)

---

## Current Database Schema (ER Diagram)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CURRENT SYSTEM ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│       USERS          │
├──────────────────────┤
│ _id (PK)            │◄────────┐
│ username            │         │
│ email               │         │
│ password            │         │
│ role                │         │ (admin/user/viewer)
│ subrole             │         │ (initiator/reviewer/both/none) [DEPRECATED]
│ courseIds[]         │───┐     │ [NOT USED - No courses in DB]
│ school              │   │     │ (SoCSE, etc.) [was: department]
│ isActive            │   │     │
│ createdAt           │   │     │
│ lastLogin           │   │     │
└──────────────────────┘   │     │
                           │     │
                           ▼     │
┌──────────────────────┐   │     │
│      COURSES         │   │     │
├──────────────────────┤   │     │
│ _id (PK)            │   │     │
│ courseId (UNIQUE)   │◄──┘     │ [EMPTY - 0 documents]
│ courseCode          │         │
│ courseName          │         │
│ year                │         │
│ ltp {               │         │
│   lecture           │         │
│   tutorial          │         │
│   practical         │         │
│ }                   │         │
│ examPattern         │         │
│ department          │         │
│ semester            │         │
│ credits             │         │
│ courseCoordinator   │─────┐   │
│ faculty[]           │──┐  │   │
│ documents[]         │  │  │   │
│ isActive            │  │  │   │
└──────────────────────┘  │  │   │
                          │  │   │
                          │  └───┼──────────┐
                          └──────┼──────┐   │
                                 │      │   │
┌──────────────────────┐         │      │   │
│       TASKS          │         │      │   │
├──────────────────────┤         │      │   │
│ _id (PK)            │         │      │   │
│ title               │         │      │   │
│ description         │         │      │   │
│ courseCode          │ (STRING - not FK) │
│ courseName          │ (STRING - not FK) │
│ assignedToInitiators[] │──────┼──────┼───┤
│ assignedToReviewers[]  │──────┼──────┘   │
│ assignedBy (FK)     │─────────┼──────────┤
│ category            │         │          │
│ docNumber           │         │          │
│ deadline            │         │          │
│ status              │         │          │
│ fileId (FK)         │────┐    │          │
│ reviewComments[]    │    │    │          │
│ reviewerApprovals[] │    │    │          │
│ createdAt           │    │    │          │
│ updatedAt           │    │    │          │
└──────────────────────┘    │    │          │
                            │    │          │
                            ▼    ▼          │
┌──────────────────────┐         │          │
│  MASTER-FILES.FILES  │         │          │
│     (GridFS)         │         │          │
├──────────────────────┤         │          │
│ _id (PK)            │◄────────┘          │
│ filename            │                    │
│ length              │                    │
│ chunkSize           │                    │
│ uploadDate          │                    │
│ metadata {          │                    │
│   originalName      │                    │
│   uploadedBy        │                    │
│   category          │                    │
│   programme         │                    │
│   year              │                    │
│   batch             │                    │
│   semester          │                    │
│   docType           │                    │
│   courseCode        │                    │
│   courseName        │                    │
│ }                   │                    │
└──────────────────────┘                    │
                                            │
┌──────────────────────┐                    │
│   NOTIFICATIONS      │                    │
├──────────────────────┤                    │
│ _id (PK)            │                    │
│ userId (FK)         │────────────────────┘
│ type                │
│ title               │
│ message             │
│ taskId (FK)         │
│ fileId              │
│ isRead              │
│ createdAt           │
└──────────────────────┘


LEGEND:
━━━━━  Strong relationship (Foreign Key)
─ ─ ─  Weak/unused relationship
◄────  One-to-Many
```

---

## Current Schema Details

### 📊 Collection Statistics
- **Users**: 19 documents
- **Tasks**: 10 documents
- **Courses**: 0 documents ❌ (Schema exists but unused)
- **Notifications**: 41 documents
- **Files (GridFS)**: 45 documents

### 🔴 Current Problems

1. **Course System Not Implemented**
   - Course schema exists but zero courses in database
   - `courseIds` field in User schema is unused
   - Tasks link to courses via strings (`courseCode`, `courseName`) instead of foreign keys

2. **User-Centric Assignment Model**
   - Tasks assign to individual users directly
   - No concept of "course membership"
   - Cannot see all initiators/reviewers for a specific course

3. **No Course Management UI**
   - Admin cannot create/manage courses
   - Cannot assign initiators/reviewers per course
   - No way to see course-based assignments

4. **Workflow Limitations**
   - Cannot merge documents from multiple initiators of same course
   - Reviewer sees individual assignments, not course-level view
   - Admin cannot see all submissions grouped by course

---

## Proposed Schema Changes

### 🎯 Core Concept Shift

**FROM:** User-centric assignment (Tasks → Individual Users)  
**TO:** Course-centric membership (Courses → Course Members → Tasks)

### 📝 Key Changes

#### 1. **Activate Course Collection**
Make Course the central entity for all assignments:
```javascript
Course {
  courseId: "2024_CS101",          // Unique identifier
  courseCode: "CS101",             // CS101, MA202, etc.
  courseName: "Data Structures",
  year: "2024",
  semester: 3,
  department: "CSE",
  
  // NEW: Course membership with roles
  courseMembers: [
    {
      userId: ObjectId,            // Reference to User
      role: "initiator" | "reviewer" | "both",
      assignedAt: Date
    }
  ],
  
  // Course coordinator (admin for this course)
  coordinator: ObjectId,           // Reference to User
  
  // Optional: faculty teaching this course
  faculty: [ObjectId],
  
  isActive: true
}
```

#### 2. **Simplify User Schema**
Minimal user information, course membership comes from Course collection:
```javascript
User {
  _id: ObjectId,
  username: String,              // REQUIRED
  email: String,                 // REQUIRED, unique
  password: String,              // REQUIRED, hashed
  role: "admin" | "user" | "viewer",  // Global permission level
  school: String,                // "SoCSE", "School of Management", etc.
  
  // Denormalized for performance (auto-populated from Course.courseMembers)
  assignedCourses: [
    {
      courseId: String,          // "2024_CS101"
      courseName: String,        // "Data Structures"
      role: "initiator" | "reviewer" | "both"
    }
  ],
  
  isActive: Boolean,
  createdAt: Date,
  lastLogin: Date
}

// REMOVED: firstName, lastName (unnecessary)
// REMOVED: subrole (moved to Course.courseMembers)
// REMOVED: courseIds (replaced by Course.courseMembers)
// CHANGED: department → school
```

#### 4. **Update Task/Assignment Schema**
Predefined assignment types with course-based assignment:
```javascript
Task {
  _id: ObjectId,
  
  // Assignment type (predefined or custom)
  assignmentType: String,          // "Syllabus", "Grade Book", "Custom"
  isPredefined: Boolean,           // true for template types, false for custom
  
  title: String,                   // Auto-generated for predefined, manual for custom
  description: String,
  
  // Course reference
  courseRef: ObjectId,             // FK to Course._id
  
  // Multiple courses can share same assignment (e.g., all CS courses get Syllabus)
  additionalCourses: [ObjectId],   // Optional: other courses this applies to
  
  // User assignments (can be manual override or auto-populated)
  assignedToInitiators: [ObjectId],   // FK to User._id
  assignedToReviewers: [ObjectId],    // FK to User._id
  assignedBy: ObjectId,               // FK to User._id (admin who created)
  
  // Assignment metadata
  docNumber: Number,               // For multiple docs of same type
  deadline: Date,
  
  // Status tracking
  status: {
    type: String,
    enum: [
      "assigned",              // Created but not started
      "in-progress",          // Initiator working on it
      "submitted",            // Initiator uploaded file
      "under-review",         // Reviewer is checking
      "partially-approved",   // Some reviewers approved
      "approved",             // All reviewers approved
      "admin-approved",       // Admin final approval
      "completed",            // Fully done
      "rejected"              // Sent back for revision
    ]
  },
  
  // File tracking
  submissions: [
    {
      initiatorId: ObjectId,
      fileId: ObjectId,        // GridFS file reference
      submittedAt: Date,
      version: Number
    }
  ],
  
  // Review tracking
  reviewerApprovals: [
    {
      reviewerId: ObjectId,
      status: "pending" | "approved" | "rejected",
      comment: String,
      reviewedAt: Date
    }
  ],
  
  // Final merged document (if multiple initiators)
  mergedFileId: ObjectId,          // GridFS reference to merged file
  mergedBy: ObjectId,              // Reviewer who merged
  mergedAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}

// REMOVED: courseCode, courseName (use courseRef lookup)
// ADDED: assignmentType, isPredefined for template system
// ADDED: additionalCourses for multi-course assignments
// ADDED: submissions array for tracking multiple initiator uploads
// ADDED: mergedFileId for reviewer document merging
```

#### 5. **File Schema - Flexible Metadata**
Support both assignment files and general documents:
```javascript
File (GridFS) {
  _id: ObjectId,                   // GridFS file ID
  filename: String,                // Generated: "2025_CS101_Syllabus_v1.pdf"
  length: Number,                  // File size in bytes
  chunkSize: Number,
  uploadDate: Date,
  
  metadata: {
    // Core fields (always present)
    originalName: String,          // User's original filename
    contentType: String,           // "application/pdf", "image/png"
    fileType: String,              // "assignment" | "curriculum" | "general"
    
    // Assignment-related (nullable for general files)
    courseRef: ObjectId,           // FK to Course._id (if course-related)
    taskRef: ObjectId,             // FK to Task._id (if assignment)
    uploadedBy: ObjectId,          // FK to User._id (nullable for admin uploads)
    uploaderRole: String,          // "initiator" | "reviewer" | "admin"
    
    // Document categorization (curriculum files)
    category: String,              // "teaching-and-learning", "curriculum", etc.
    programme: String,             // "BTech", "BCA" (nullable)
    year: String,                  // "2024" (nullable)
    semester: String,              // "3" (nullable)
    
    // Merging support (nullable)
    isMerged: Boolean,             // true if this is a merged document
    originalFiles: [ObjectId],     // Array of file IDs that were merged
    mergedBy: ObjectId,            // User who performed merge
    
    // Version control
    version: Number,
    isLatest: Boolean,
    previousVersion: ObjectId,
    
    // General metadata
    description: String,
    tags: [String],
    isActive: Boolean
  }
}

// KEY POINT: metadata fields are flexible and nullable
// Assignment files have full metadata, curriculum files have minimal metadata
// Backend must handle null/undefined gracefully
```

---

## New ER Diagram (Proposed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PROPOSED SYSTEM ARCHITECTURE                         │
│                    (Course-Centric Workflow)                             │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│       USERS          │
├──────────────────────┤
│ _id (PK)            │◄──────────────┐
│ username (UNIQUE)   │               │
│ email (UNIQUE)      │               │
│ password (hashed)   │               │
│ role                │ (admin/user/viewer)
│ school              │ (SoCSE, etc.)  │
│ assignedCourses[] { │ (Denormalized) │
│   courseId          │               │
│   courseName        │               │
│   role              │               │
│ }                   │               │
│ isActive            │               │
│ createdAt           │               │
│ lastLogin           │               │
└──────────────────────┘               │
                                       │
                                       │
        ┌──────────────────────────────┴───────────────────────────┐
        │                                                            │
        │                                                            │
        ▼                                                            │
┌──────────────────────┐                                            │
│      COURSES         │ ◄──── CENTRAL ENTITY                       │
├──────────────────────┤                                            │
│ _id (PK)            │                                             │
│ courseCode (UNIQUE) │ "CS101", "BCA201"                           │
│ courseName          │ "Data Structures"                           │
│ year                │ "2024"                                      │
│ semester            │ 3                                           │
│ school              │ "SoCSE", "SoM"                              │
│ programme           │ "BTech", "BCA", "BSc"                       │
│ credits             │ 4                                           │
│                     │                                             │
│ ┌──────────────────┐│                                             │
│ │ courseMembers[]  ││ ◄──── NEW: Course membership               │
│ ├──────────────────┤│                                             │
│ │ userId (FK) ─────┼┼─────────────────────────────────────────────┤
│ │ role             ││ "initiator" | "reviewer" | "both"          │
│ │ assignedAt       ││                                             │
│ └──────────────────┘│                                             │
│                     │                                             │
│ isActive            │                                             │
└──────────────────────┘                                            │
                                                                    │
 NOTE: courseId like "2024_CS101" is generated dynamically:         │
       backend creates: `${year}_${courseCode}` for file naming    │
                                                                    │
        │                                                           │
        │ One-to-Many                                             │
        │                                                           │
        ▼                                                           │
┌──────────────────────┐                                            │
│  OTHERS (Templates)  │ ◄─── Centralized Assignment Templates    │
├──────────────────────┤                                            │
│ _id (PK)            │                                             │
│ templateName        │ "Syllabus", "Grade Book"                   │
│ category            │ "Academic", "Administrative"                │
│ isPredefined        │ true/false                                  │
│ createdBy (FK)      │─────────────────────────────────────────────┘
│ applicableToSchools[]│ (filter templates by school)
│ applicableToProgrammes[] (filter by programme)
│ isActive            │
└──────────────────────┘
                                                                    │
        │
        │ One-to-Many
        │
        ▼
┌──────────────────────┐
│       TASKS          │
├──────────────────────┤
│ _id (PK)            │
│ assignmentType      │ "Syllabus", "Grade Book", "Custom"
│ isPredefined        │ true/false
│ title               │
│ description         │
│                     │
│ courseRef (FK) ─────┼────► Points to COURSES._id
│ additionalCourses[] │ (Multi-course assignments)
│                     │
│ assignedToInitiators[] (FK)  ───┐  Can be manual or
│ assignedToReviewers[] (FK)  ────┤  auto-from courseMembers
│ assignedBy (FK)     │────────────┼────► Points to USERS._id
│                     │            │
│ docNumber           │            │
│ deadline            │            │
│ status              │            │
│                     │            │
│ submissions[] {     │            │
│   initiatorId       │────────────┤
│   fileId (FK) ──────┼────┐       │
│   version           │    │       │
│ }                   │    │       │
│                     │    │       │
│ mergedFileId (FK) ──┼────┤       │
│ mergedBy (FK)       │────┼───────┘
│                     │    │
│ reviewerApprovals[] │    │
└──────────────────────┘    │
                            │       │
        ┌───────────────────┘       │
        │                           │
        ▼                           │
┌──────────────────────┐
│  MASTER-FILES.FILES  │
│     (GridFS)         │
├──────────────────────┤
│ _id (PK)            │
│ filename            │ "2025_CS101_Syllabus_v1.pdf"
│ length              │ (file size)
│ uploadDate          │
│ metadata {          │
│   fileType          │ "assignment" | "curriculum" | "general"
│   originalName      │
│   contentType       │
│   courseRef (FK)    │───► NULLABLE, points to COURSES._id
│   taskRef (FK)      │───► NULLABLE, points to TASKS._id
│   uploadedBy (FK)   │───► NULLABLE, points to USERS._id
│   category          │ (for curriculum files)
│   programme         │ NULLABLE
│   year              │ NULLABLE
│   semester          │ NULLABLE
│   isMerged          │ NULLABLE (Boolean)
│   originalFiles[]   │ NULLABLE (if merged)
│   version           │
│   isActive          │
│ }                   │
└──────────────────────┘

⚠️  IMPORTANT: All metadata fields are NULLABLE
    Assignment files: full metadata populated
    Curriculum files: minimal metadata (NA/NULL for unused fields)

┌──────────────────────┐
│   NOTIFICATIONS      │
├──────────────────────┤
│ _id (PK)            │
│ userId (FK)         │───► Points to USERS._id
│ courseId (FK)       │───► NEW: Points to COURSES._id
│ taskId (FK)         │
│ type                │
│ message             │
│ isRead              │
└──────────────────────┘


WORKFLOW:
═════════
1. Admin creates Course (courseCode: "CS101", year: "2024")
   → Backend generates courseId "2024_CS101" for file naming

2. Admin assigns courseMembers (initiators + reviewers) using dropdown

3. Admin creates Assignment:
   → Selects predefined type ("Syllabus", "Grade Book") OR "Custom"
   → Selects course(s) from dropdown (can add multiple with + button)
   → Assigns initiators (dropdown with search)
   → Assigns reviewers (dropdown with search)
   → Sets deadline
   → System auto-creates task for each selected course

4. Initiators submit documents
   → File named: "2025_CS101_Syllabus_v1.pdf"
   → Stored in GridFS with full metadata

5. Reviewers can:
   → Review individual submissions from each initiator
   → Merge multiple initiator submissions into one document
   → Approve/reject merged document

6. Admin views Records tab (circle visualization):
   → Each course = one screen-sized circle
   → Assignments radiate out like clock arms
   → Each arm shows: Type → Initiator → Reviewer → Status → Deadline
   → Scroll vertically to see all courses

7. Admin approves final merged document
```

---

## Impact Analysis

### 🔧 Backend Changes Required

#### 1. **New API Endpoints**
```
POST   /api/courses                    - Create course
GET    /api/courses                    - List all courses
GET    /api/courses/:courseId          - Get course details  
PUT    /api/courses/:courseId          - Update course
DELETE /api/courses/:courseId          - Delete/archive course

POST   /api/courses/:courseId/members  - Add course member(s)
DELETE /api/courses/:courseId/members/:userId - Remove member
PUT    /api/courses/:courseId/members/:userId - Update member role

GET    /api/courses/:courseId/tasks    - Get all tasks for course
POST   /api/tasks/create-predefined    - Create task from predefined template
POST   /api/tasks/create-custom        - Create custom task
POST   /api/tasks/bulk-create          - Create task for multiple courses

POST   /api/files/merge                - Merge multiple submissions
GET    /api/files/:fileId/versions     - Get file version history

GET    /api/assignment-templates       - List all active templates
POST   /api/assignment-templates       - Create custom template (admin)
PUT    /api/assignment-templates/:id   - Update template (admin)
DELETE /api/assignment-templates/:id   - Soft delete template (admin)
GET    /api/assignment-templates/predefined - Get 13 system default templates
```

#### 2. **Modified API Endpoints**
```
GET    /api/tasks                      - Add courseId filter
POST   /api/tasks                      - Link to courseRef instead of strings
PUT    /api/tasks/:taskId              - Update course reference validation

GET    /api/users/:userId/courses      - Get user's assigned courses
```

#### 3. **Database Migrations**
```javascript
// Migration script needed:
1. Create OTHERS collection and seed 13 predefined templates:
   - Syllabus, Lesson Plan, Class Timetable, Grade Book,
   - Question Papers, Students List Format,
   - Consolidated Marks CIE1/2/3, Slow Learners List,
   - Remedial Folder, Individual Timetable, Exit Survey Analysis
   - Set isPredefined=true, isActive=true for all

2. Create Course documents from existing Task.courseCode values
   - Group tasks by courseCode
   - Extract year from createdAt or use default "2024"
   - Set school/programme based on department mapping

2. Populate Course.courseMembers from Task assignments
   - assignedToInitiators → courseMembers with role="initiator"
   - assignedToReviewers → courseMembers with role="reviewer"
   - Merge duplicates (same user as both → role="both")

3. Update Task schema:
   - Add courseRef pointing to new Course._id
   - Add isPredefined=false for all existing tasks
   - Move fileId to submissions array
   - Keep old courseCode/courseName for reference (mark deprecated)

4. Update User schema:
   - Rename department → school
   - Build assignedCourses array from Course.courseMembers (denormalized)
   - Mark subrole, courseIds as deprecated (don't delete yet)

5. Update File metadata:
   - Add fileType="assignment" to task-related files
   - Add courseRef lookup from task
   - Make uploadedBy, isMerged nullable
   - Curriculum files get fileType="curriculum"

6. Generate assignment templates:
   - Create assignmentTemplates array for each course
   - Based on your document images:
     ["Syllabus", "Lesson Plan", "Class Timetable", "Grade Book", 
      "Question Papers", "Students List", "Consolidated Marks CIE1",
      "Consolidated Marks CIE2", "Consolidated Marks CIE3", 
      "Slow Learners List", "Remedial Folder", "Individual TT", 
      "Exit Survey Analysis"]
```

---

### 🎨 Frontend Changes Required

#### 1. **New Admin Pages**

**A. Manage Courses** (`/admin/courses`)
  - List all courses (table: Code | Name | Year | Sem | School | Programme | Members)
  - Create new course (modal form)
  - Edit course details
  - Archive course (soft delete)
  
**B. Course Details** (`/admin/courses/:courseId`)
  - Course info card (editable)
  - Course members section:
    * List members with roles
    * Add member: dropdown with search → select role → assign
    * Remove member: click X icon
    * Change role: dropdown selector
  - Course assignments: table view of all tasks
  - Quick action buttons: Create Assignment, View Records

**C. Admin Control Panel** (NEW - `/admin/control-panel`)
  - **Manage Assignment Templates:**
    * View all templates (predefined + custom)
    * Create custom template (name, category, description, filters)
    * Edit custom templates (cannot edit predefined)
    * Soft delete custom templates
    * Filter by category/school/programme
  
  - **System Settings:**
    * Manage schools list (add/remove schools like SoCSE, SoM)
    * Manage programmes list (BTech, BCA, BSc, etc.)
    * Manage academic years
    * Future: File storage settings, notification settings
  
  - **Bulk Operations:**
    * Import courses from CSV
    * Export data (courses, users, assignments)
    * Bulk user creation
  
  - **Future Enhancements:**
    * Analytics dashboard
    * Audit logs
    * System health monitoring

**D. Create Assignment** (replaces old task creation)
  - **Column Layout:**
    ```
    | Assignment Type ▼ | Course ▼ [+] | Initiator ▼ | Reviewer ▼ | Deadline 📅 | [Assign] |
    ```
  - **Assignment Type dropdown:**
    * Fetch from `/api/assignment-templates` (shows predefined + custom)
    * Filtered by selected course's school/programme if applicable
    * Predefined templates (13 types from OTHERS collection)
    * Custom templates created by admins
    * Last option: **"Custom"** → opens dialog with manual entry
  
  - **Course dropdown with [+] button:**
    * Select first course from dropdown
    * Click [+] to add another course dropdown
    * Can assign same task to multiple courses (BTech CS101, BCA CS101, etc.)
    * Each selected course creates a separate task instance
  
  - **Initiator dropdown:**
    * Search bar + dropdown of users
    * Filter by course members (initiator role)
    * Multi-select if needed
  
  - **Reviewer dropdown:**
    * Search bar + dropdown of users
    * Filter by course members (reviewer role)
    * Multi-select
  
  - **Assign button:**
    * Creates task for each selected course
    * Auto-sends notifications to assigned users

**E. Records Tab** (NEW - replaces status column)
  - **Circle Visualization:**
    * Each course = one full-screen circle
    * Assignment arms radiate from center like clock
    * Each arm shows:
      ```
      Center → [Assignment Type] → [Initiator] → [Reviewer] → [Status Badge] → [Deadline]
      ```
    * Color coding:
      - 🟢 Green: Completed
      - 🟡 Yellow: In Progress
      - 🔴 Red: Overdue
      - ⚪ Gray: Assigned (not started)
    * Click on arm to view details/submissions
  
  - **Vertical Scroll:**
    * Scroll down to see next course circle
    * Course name displayed at top of each circle
    * Total courses counter: "Course 1 of 15"
  
  - **Filters:**
    * Filter by school, programme, year, semester
    * Search by course code/name
    * Status filter (show only overdue, in-progress, etc.)

#### 2. **Modified Admin Pages**
- **Roles Page** (`/admin/roles`)
  - Keep existing user management table
  - User profile now shows:
    * Assigned courses (from Course.courseMembers)
    * Role per course (initiator/reviewer/both)
  - Remove global subrole (deprecated)
  - Link to "Manage Courses" button at top

#### 3. **New User Pages**
- **User Profile** (TODO - Add to roadmap)
  - Display all assigned courses
  - Show role per course (initiator/reviewer/both)
  - Quick stats: Pending tasks, completed tasks
  - Navigate to course assignments

- **My Courses** (`/dashboard/my-courses`)
  - Card view of courses
  - Each card shows:
    * Course code, name
    * Your role (initiator/reviewer)
    * Pending tasks count
    * Recent activity
  - Click card → navigate to course assignments

- **Course Assignments** (`/courses/:courseId/assignments`)
  - **Initiator view:**
    * List of assigned tasks
    * Upload document button
    * Version history of submissions
    * Status badge (assigned/submitted/approved/rejected)
  
  - **Reviewer view:**
    * List of tasks to review
    * View all initiator submissions
    * Merge tool: Select multiple files → preview → merge → upload merged
    * Approve/reject with comments
    * Track which reviewers have approved

#### 4. **Modified Components**
- **Navbar**: Add "Courses" link
- **Dashboard**: Show course-based metrics
- **TaskList**: Group by course
- **FileUpload**: Auto-populate course metadata

---

### 📊 Data Migration Impact

#### Before Migration:
```javascript
// Task document
{
  courseCode: "CS101",              // String
  courseName: "Data Structures",    // String
  assignedToInitiators: ["user1Id"],
  assignedToReviewers: ["user2Id"]
}

// User document
{
  subrole: "initiator",
  courseIds: []                     // Empty/unused
}
```

#### After Migration:
```javascript
// New Course document
{
  _id: "courseObjectId123",
  courseId: "2024_CS101",
  courseCode: "CS101",
  courseName: "Data Structures",
  courseMembers: [
    { userId: "user1Id", role: "initiator" },
    { userId: "user2Id", role: "reviewer" }
  ]
}

// Updated Task document
{
  courseRef: "courseObjectId123",   // ObjectId reference
  // assignedTo arrays auto-populated from Course
}

// Updated User document
{
  // subrole removed
  assignedCourses: [
    { courseId: "2024_CS101", role: "initiator" }
  ]
}
```

---

### ⚠️ Breaking Changes

1. **API Changes**
   - `POST /api/tasks` now requires `courseRef` instead of `courseCode`/`courseName`
   - `GET /api/tasks` returns course object instead of strings
   - User subrole field deprecated

2. **Frontend Components**
   - Task creation form needs course selector (dropdown)
   - User profile shows courses instead of global subrole
   - Assignment list grouped by course

3. **Database Schema**
   - Cannot roll back after migration without data loss
   - Need to maintain backward compatibility during transition

---

## Migration Strategy

### Phase 1: Add Course System (Non-Breaking)
1. Implement Course model and API endpoints
2. Create admin UI for course management
3. Allow course creation but keep old task system working
4. **No database changes yet**

### Phase 2: Parallel Systems
1. Add `courseRef` field to Task schema (optional)
2. Support both old (courseCode string) and new (courseRef) formats
3. UI shows courses but still works with old tasks
4. Test thoroughly

### Phase 3: Data Migration
1. Run migration script to:
   - Create Course documents from existing tasks
   - Populate courseRef in all tasks
   - Update user documents
2. Mark old fields as deprecated but don't remove yet

### Phase 4: Cleanup (Breaking)
1. Remove deprecated fields (courseCode, courseName from Task)
2. Remove User.subrole
3. Update all API endpoints to require courseRef
4. Update frontend to use only new system

---

## Advantages of New System

✅ **Course-Centric View**
- See all assignments for a specific course
- Easy to manage course members
- Clear separation of concerns

✅ **Better Role Management**
- Roles tied to courses, not global
- User can be initiator in CS101, reviewer in MA202
- Flexible per-course permissions

✅ **Document Merging**
- Multiple initiators submit to same course
- Reviewer can merge all submissions
- Single final document per course/task

✅ **Scalability**
- Add/remove courses easily
- Bulk assign users to courses
- Course templates for recurring assignments

✅ **Clearer Workflow**
```
Admin creates Course
  → Assigns members (initiators + reviewers)
    → Creates assignments for course
      → Initiators submit
        → Reviewers merge & approve
          → Admin final approval
```

---

## Questions to Consider

1. **Can users belong to multiple courses?**
   - ✅ Yes, with different roles per course (initiator in CS101, reviewer in MA202)

2. **What happens when a course is deleted?**
   - ✅ Archive (soft delete) course and mark tasks as archived
   - Keep data for historical records

3. **Can course membership change mid-semester?**
   - ✅ Yes, but existing assignments retain original assignees
   - New assignments use updated membership

4. **Should old tasks be migrated or kept as-is?**
   - ✅ Migrate all tasks to maintain consistency
   - Keep old fields as deprecated for rollback if needed

5. **Role hierarchy:**
   - ✅ Admin > Reviewer > Initiator (no coordinator role)

6. **File naming convention:**
   - ✅ Backend generates: `${year}_${courseCode}_${assignmentType}_v${version}.pdf`
   - Example: `2025_CS101_Syllabus_v1.pdf`

7. **Predefined assignment templates:**
   - ✅ Based on your document images (13 types)
   - Stored in Course.assignmentTemplates
   - Admin can add custom types

8. **Multi-course assignments:**
   - ✅ Same assignment (e.g., Syllabus) to BTech CS101, BCA CS101, BSc CS101
   - Creates separate task instances, linked via Task.additionalCourses

9. **User profile page:**
   - ⏳ TODO: Add to development roadmap
   - Show all courses, roles, pending tasks

10. **Curriculum files vs Assignment files:**
    - ✅ Handled via File.metadata.fileType
    - Curriculum files have minimal metadata (nullable fields)
    - Assignment files have full metadata

---

## Next Steps

### Immediate Actions:
1. ✅ Review this schema proposal
2. ⬜ Approve simplified schema (User, Course, Task, File)
3. ⬜ Design predefined assignment templates list
4. ⬜ Mockup Records tab circle visualization

### Phase 1: Backend (Course System)
5. ⬜ Update Course model (remove courseId field, add assignmentTemplates)
6. ⬜ Update User model (remove firstName/lastName, rename department→school)
7. ⬜ Update Task model (add isPredefined, assignmentType, additionalCourses)
8. ⬜ Update File metadata (make fields nullable, add fileType)
9. ⬜ Create Course API endpoints
10. ⬜ Create predefined assignment templates API
11. ⬜ Create file merge endpoint

### Phase 2: Frontend (Admin UI)
12. ⬜ Implement Manage Courses page
13. ⬜ Implement Course Details page with member management
14. ⬜ Redesign Create Assignment UI (column layout with dropdowns)
15. ⬜ Implement Records tab with circle visualization
16. ⬜ Update Roles page to show courses per user

### Phase 3: Frontend (User UI)
17. ⬜ Create My Courses page (card view)
18. ⬜ Create Course Assignments page (initiator/reviewer views)
19. ⬜ Implement file merge tool for reviewers
20. ⬜ Add User Profile page (TODO item)

### Phase 4: Migration & Testing
21. ⬜ Write migration script (existing tasks → new schema)
22. ⬜ Test with sample courses and assignments
23. ⬜ Parallel system deployment (old + new)
24. ⬜ Gradual cutover to new system
25. ⬜ Remove deprecated fields after validation

### Future Enhancements:
26. ⬜ Bulk operations (assign 50 courses at once)
27. ⬜ Assignment templates per school/programme
28. ⬜ Analytics dashboard (completion rates, overdue tasks)
29. ⬜ Email notifications for deadlines
30. ⬜ Mobile-responsive circle visualization

---

**Status**: ⏳ Awaiting approval for schema changes  
**Priority**: 🔴 High - Foundational change for entire system
