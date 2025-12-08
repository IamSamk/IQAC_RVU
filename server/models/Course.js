const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'syllabus',
      'lesson_plan', 
      'course_file',
      'cie_marks',
      'see_marks',
      'question_paper',
      'answer_key',
      'course_outcome',
      'program_outcome',
      'co_po_mapping',
      'attainment_report'
    ]
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'under_review', 'approved', 'rejected'],
    default: 'draft'
  },
  version: {
    type: Number,
    default: 1
  },
  reviewDocumentId: {
    type: mongoose.Schema.Types.ObjectId, // Consolidated review comments PDF
    default: null
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  reviews: [{
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comments: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    }
  }]
});

const courseSchema = new mongoose.Schema({
  // Course details
  courseCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  
  courseName: {
    type: String,
    required: true,
    trim: true
  },
  
  year: {
    type: String,
    required: true
  },
  
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  
  // University hierarchy
  school: {
    type: String,
    required: true,
    trim: true,
    index: true
    // e.g., "SoCSE", "School of Management", "SoM"
  },
  
  programme: {
    type: String,
    required: true,
    trim: true,
    index: true
    // e.g., "BTech", "BCA", "BSc", "MTech"
  },
  
  // LTP Configuration (Lecture-Tutorial-Practical)
  ltp: {
    lecture: {
      type: Number,
      default: 0,
      min: 0
    },
    tutorial: {
      type: Number,
      default: 0,
      min: 0
    },
    practical: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  credits: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Examination pattern (e.g., "70_30" for 70% external, 30% internal)
  examPattern: {
    type: String
  },
  
  // Course membership with roles (CENTRAL TO NEW SYSTEM)
  courseMembers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['initiator', 'reviewer', 'both'],
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // All documents for this course (legacy, keep for compatibility)
  documents: [documentSchema],
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// REMOVED FIELDS (deprecated):
// - courseId: Now generated dynamically as `${year}_${courseCode}` (not stored)
// - department: Renamed to 'school'
// - courseCoordinator: Redundant with courseMembers
// - faculty: Redundant with courseMembers
// - assignmentTemplates: Moved to separate OTHERS collection

// Indexes for efficient querying
courseSchema.index({ courseCode: 1, year: 1 }, { unique: true });
courseSchema.index({ school: 1 });
courseSchema.index({ programme: 1 });
courseSchema.index({ 'courseMembers.userId': 1 });

// Virtual field: Generate courseId dynamically
courseSchema.virtual('courseId').get(function() {
  return `${this.year}_${this.courseCode}`;
});

// Static method to generate courseId
courseSchema.statics.generateCourseId = function(year, courseCode) {
  return `${year}_${courseCode}`;
};

// Static method to parse courseId
courseSchema.statics.parseCourseId = function(courseId) {
  const [year, courseCode] = courseId.split('_');
  return { year, courseCode };
};

// Static method to find course by courseId (year_courseCode)
courseSchema.statics.findByCourseId = function(courseId) {
  const { year, courseCode } = this.parseCourseId(courseId);
  return this.findOne({ year, courseCode });
};

// Method to get all initiators
courseSchema.methods.getInitiators = function() {
  return this.courseMembers
    .filter(m => m.role === 'initiator' || m.role === 'both')
    .map(m => m.userId);
};

// Method to get all reviewers
courseSchema.methods.getReviewers = function() {
  return this.courseMembers
    .filter(m => m.role === 'reviewer' || m.role === 'both')
    .map(m => m.userId);
};

// Method to add course member
courseSchema.methods.addMember = function(userId, role) {
  // Check if user already exists
  const existing = this.courseMembers.find(m => m.userId.toString() === userId.toString());
  
  if (existing) {
    existing.role = role;
    existing.assignedAt = new Date();
  } else {
    this.courseMembers.push({ userId, role });
  }
  
  return this.save();
};

// Method to remove course member
courseSchema.methods.removeMember = function(userId) {
  this.courseMembers = this.courseMembers.filter(
    m => m.userId.toString() !== userId.toString()
  );
  return this.save();
};

// Method to update member role
courseSchema.methods.updateMemberRole = function(userId, newRole) {
  const member = this.courseMembers.find(m => m.userId.toString() === userId.toString());
  
  if (!member) {
    throw new Error('User is not a member of this course');
  }
  
  member.role = newRole;
  member.assignedAt = new Date();
  
  return this.save();
};

// Method to check if user is a member
courseSchema.methods.isMember = function(userId) {
  return this.courseMembers.some(m => m.userId.toString() === userId.toString());
};

// Method to get user's role in this course
courseSchema.methods.getMemberRole = function(userId) {
  const member = this.courseMembers.find(m => m.userId.toString() === userId.toString());
  return member ? member.role : null;
};

// Method to get all documents by type (legacy)
courseSchema.methods.getDocumentsByType = function(type) {
  return this.documents.filter(doc => doc.type === type);
};

// Method to get approved documents only (legacy)
courseSchema.methods.getApprovedDocuments = function() {
  return this.documents.filter(doc => doc.status === 'approved');
};

// Include virtuals when converting to JSON
courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Course', courseSchema);
