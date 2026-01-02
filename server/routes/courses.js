const express = require('express');
const Course = require('../models/Course');
const User = require('../models/User');
const Task = require('../models/Task');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all courses (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { school, programme, year } = req.query;
    const query = {};
    
    if (school) query.school = school;
    if (programme) query.programme = programme;
    if (year) query.year = year;
    
    const courses = await Course.find(query)
      .populate('courseMembers.userId', 'firstName lastName username email')
      .sort({ year: -1, courseCode: 1 });
    
    // Return in format expected by frontend
    res.json({ courses });
  } catch (error) {
    console.error('❌ Get courses error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch courses', details: error.message });
  }
});

// Get courses for current user (based on their membership)
router.get('/my-courses', async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find courses where user is a member
    const courses = await Course.find({
      'courseMembers.userId': userId
    })
      .populate('courseMembers.userId', 'username email school')
      .sort({ year: -1, courseCode: 1 });
    
    // Add user's role in each course to the response
    const coursesWithRole = courses.map(course => {
      const courseObj = course.toObject({ virtuals: true });
      const memberRole = course.getMemberRole(userId);
      return {
        ...courseObj,
        myRole: memberRole
      };
    });
    
    res.json(coursesWithRole);
  } catch (error) {
    console.error('Get my courses error:', error);
    res.status(500).json({ error: 'Failed to fetch your courses' });
  }
});

// Get single course by ID
router.get('/:courseId', async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
      .populate('courseMembers.userId', 'username email school')
      .populate('createdBy', 'username email');
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check if user has access (admin or course member)
    const userId = req.user._id;
    const userRole = req.user.role;
    
    if (userRole !== 'admin' && !course.isMember(userId)) {
      return res.status(403).json({ error: 'You do not have access to this course' });
    }
    
    res.json(course);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// Create new course (Admin only)
router.post('/', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create courses' });
    }
    
    let { courseCode, courseName, school, programme, year, semester, credits, courseMembers } = req.body;
    
    // Normalize inputs
    if (courseCode) courseCode = courseCode.trim().toUpperCase();
    if (courseName) courseName = courseName.trim();
    if (school) school = school.trim();
    if (programme) programme = programme.trim();
    
    // Validate required fields
    if (!courseCode || !courseName || !school || !programme || !year) {
      return res.status(400).json({ error: 'Missing required fields: courseCode, courseName, school, programme, year' });
    }
    
    // Check for duplicate course (same courseCode and year)
    const existingCourse = await Course.findOne({ courseCode, year });
    if (existingCourse) {
      return res.status(400).json({ error: 'Course with this code already exists for this year' });
    }
    
    // Create course
    const course = new Course({
      courseCode,
      courseName,
      school,
      programme,
      year,
      semester,
      credits,
      courseMembers: courseMembers || [],
      createdBy: req.user._id
    });
    
    await course.save();
    
    // Update User.assignedCourses for all members
    if (courseMembers && courseMembers.length > 0) {
      for (const member of courseMembers) {
        const user = await User.findById(member.userId);
        if (user) {
          await user.syncAssignedCourses();
        }
      }
    }
    
    // Populate for response
    await course.populate('courseMembers.userId', 'username email school');
    await course.populate('createdBy', 'username email');
    
    res.status(201).json({
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course', details: error.message });
  }
});

// Update course (Admin only)
router.put('/:courseId', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update courses' });
    }
    
    const { courseCode, courseName, school, programme, year, semester, credits } = req.body;
    
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Update fields
    if (courseCode) course.courseCode = courseCode;
    if (courseName) course.courseName = courseName;
    if (school) course.school = school;
    if (programme) course.programme = programme;
    if (year) course.year = year;
    if (semester) course.semester = semester;
    if (credits !== undefined) course.credits = credits;
    
    await course.save();
    
    // Populate for response
    await course.populate('courseMembers.userId', 'username email school');
    await course.populate('createdBy', 'username email');
    
    res.json({
      message: 'Course updated successfully',
      course
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Delete course (Admin only)
router.delete('/:courseId', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete courses' });
    }
    
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check if course has any tasks
    const taskCount = await Task.countDocuments({ courseRef: course._id });
    if (taskCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete course with existing assignments',
        taskCount 
      });
    }
    
    // Get all members before deletion
    const memberIds = course.courseMembers.map(m => m.userId);
    
    // Delete the course
    await Course.findByIdAndDelete(req.params.courseId);
    
    // Update all users' assignedCourses
    for (const userId of memberIds) {
      const user = await User.findById(userId);
      if (user) {
        await user.syncAssignedCourses();
      }
    }
    
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// Add member to course (Admin only)
router.post('/:courseId/members', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add course members' });
    }
    
    const { userId, role } = req.body;
    
    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role' });
    }
    
    if (!['initiator', 'reviewer', 'both'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be: initiator, reviewer, or both' });
    }
    
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add member
    course.addMember(userId, role);
    await course.save();
    
    // Update user's assignedCourses
    await user.syncAssignedCourses();
    
    // Populate for response
    await course.populate('courseMembers.userId', 'username email school');
    
    res.json({
      message: 'Member added successfully',
      course
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member from course (Admin only)
router.delete('/:courseId/members/:userId', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove course members' });
    }
    
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const userId = req.params.userId;
    
    // Check if user is a member
    if (!course.isMember(userId)) {
      return res.status(400).json({ error: 'User is not a member of this course' });
    }
    
    // Remove member
    course.removeMember(userId);
    await course.save();
    
    // Update user's assignedCourses
    const user = await User.findById(userId);
    if (user) {
      await user.syncAssignedCourses();
    }
    
    // Populate for response
    await course.populate('courseMembers.userId', 'username email school');
    
    res.json({
      message: 'Member removed successfully',
      course
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update member role (Admin only)
router.put('/:courseId/members/:userId', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update member roles' });
    }
    
    const { role } = req.body;
    
    if (!role || !['initiator', 'reviewer', 'both'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be: initiator, reviewer, or both' });
    }
    
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const userId = req.params.userId;
    
    // Check if user is a member
    if (!course.isMember(userId)) {
      return res.status(400).json({ error: 'User is not a member of this course' });
    }
    
    // Update role
    course.updateMemberRole(userId, role);
    await course.save();
    
    // Update user's assignedCourses
    const user = await User.findById(userId);
    if (user) {
      await user.syncAssignedCourses();
    }
    
    // Populate for response
    await course.populate('courseMembers.userId', 'username email school');
    
    res.json({
      message: 'Member role updated successfully',
      course
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Get course statistics (Admin or course member)
router.get('/:courseId/stats', async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check access
    const userId = req.user._id;
    const userRole = req.user.role;
    
    if (userRole !== 'admin' && !course.isMember(userId)) {
      return res.status(403).json({ error: 'You do not have access to this course' });
    }
    
    // Get task statistics
    const tasks = await Task.find({ 
      $or: [
        { courseRef: course._id },
        { additionalCourses: course._id }
      ]
    });
    
    const stats = {
      totalTasks: tasks.length,
      tasksByStatus: {
        assigned: tasks.filter(t => t.status === 'assigned').length,
        fileUploaded: tasks.filter(t => t.status === 'file-uploaded').length,
        inReview: tasks.filter(t => t.status === 'in-review').length,
        partiallyApproved: tasks.filter(t => t.status === 'partially-approved').length,
        approvedByReviewer: tasks.filter(t => t.status === 'approved-by-reviewer').length,
        approvedByAdmin: tasks.filter(t => t.status === 'approved-by-admin').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        rejected: tasks.filter(t => t.status === 'rejected').length
      },
      initiatorCount: course.getInitiators().length,
      reviewerCount: course.getReviewers().length,
      totalMembers: course.courseMembers.length
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get course stats error:', error);
    res.status(500).json({ error: 'Failed to fetch course statistics' });
  }
});

module.exports = router;
