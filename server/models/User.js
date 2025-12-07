const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: { 
    type: String, 
    required: true 
  },
  
  role: { 
    type: String, 
    enum: ['admin', 'user', 'viewer'], 
    default: 'viewer',
    index: true
  },
  
  // School/Department (SoCSE, School of Management, etc.)
  school: { 
    type: String,
    trim: true,
    index: true
  },
  
  // Denormalized course assignments for quick lookup
  // Auto-populated from Course.courseMembers
  assignedCourses: [{
    courseId: { type: String },      // "2024_CS101"
    courseName: { type: String },    // "Data Structures"
    courseRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    role: { 
      type: String, 
      enum: ['initiator', 'reviewer', 'both']
    },
    assignedAt: { type: Date, default: Date.now }
  }],
  
  isActive: { type: Boolean, default: true },
  isPasswordSet: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

// REMOVED FIELDS (deprecated):
// - firstName, lastName: Unnecessary, use username or email
// - subrole: Moved to Course.courseMembers (per-course roles)
// - courseIds: Replaced by assignedCourses (denormalized)
// - department: Renamed to 'school'

// Virtual for display name
userSchema.virtual('displayName').get(function() {
  return this.username || this.email.split('@')[0];
});

// Method to update assigned courses (called when Course.courseMembers changes)
userSchema.methods.syncAssignedCourses = async function() {
  const Course = require('./Course');
  
  // Find all courses where this user is a member
  const courses = await Course.find({ 'courseMembers.userId': this._id });
  
  this.assignedCourses = courses.map(course => {
    // Find this user's role in the course
    const member = course.courseMembers.find(m => 
      m.userId.toString() === this._id.toString()
    );
    
    return {
      courseId: `${course.year}_${course.courseCode}`,
      courseName: course.courseName,
      courseRef: course._id,
      role: member ? member.role : 'unknown',
      assignedAt: member ? member.assignedAt : new Date()
    };
  });
  
  return this.save();
};

// Static method to find users by school
userSchema.statics.findBySchool = function(school) {
  return this.find({ school, isActive: true });
};

// Static method to find users by role
userSchema.statics.findByRole = function(role) {
  return this.find({ role, isActive: true });
};

// Static method to find users assigned to a course
userSchema.statics.findByCourse = function(courseRef) {
  return this.find({ 
    'assignedCourses.courseRef': courseRef,
    isActive: true 
  });
};

// Include virtuals when converting to JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema); 