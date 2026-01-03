const express = require('express');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Course = require('../models/Course');
const AssignmentTemplate = require('../models/AssignmentTemplate');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Create a new task from template (Admin only) - NEW WORKFLOW
router.post('/create-from-template', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create tasks' });
    }
    
    const { 
      courseId, 
      additionalCourseIds, 
      templateId, 
      title, 
      description, 
      deadline,
      initiatorIds,
      reviewerIds
    } = req.body;
    
    // Validate required fields
    if (!courseId || !templateId || !deadline) {
      return res.status(400).json({ error: 'Missing required fields: courseId, templateId, deadline' });
    }
    
    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Verify template exists
    const template = await AssignmentTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Validate additional courses if provided
    let additionalCourses = [];
    if (additionalCourseIds && additionalCourseIds.length > 0) {
      additionalCourses = await Course.find({ _id: { $in: additionalCourseIds } });
      if (additionalCourses.length !== additionalCourseIds.length) {
        return res.status(404).json({ error: 'One or more additional courses not found' });
      }
    }
    
    // If no initiators/reviewers specified, use course members
    let assignedInitiators = initiatorIds || [];
    let assignedReviewers = reviewerIds || [];
    
    if (assignedInitiators.length === 0) {
      assignedInitiators = course.getInitiators();
    }
    if (assignedReviewers.length === 0) {
      assignedReviewers = course.getReviewers();
    }
    
    if (assignedInitiators.length === 0 || assignedReviewers.length === 0) {
      return res.status(400).json({ error: 'Course must have at least one initiator and one reviewer' });
    }
    
    // Create the task
    const task = new Task({
      title: title || template.templateName,
      description: description || template.description,
      courseRef: courseId,
      additionalCourses: additionalCourseIds || [],
      isPredefined: true,
      assignmentType: template.templateName,
      assignedToInitiators: assignedInitiators,
      assignedToReviewers: assignedReviewers,
      assignedBy: req.user._id,
      deadline: new Date(deadline),
      status: 'assigned'
    });
    
    await task.save();
    
    // Create notifications for all initiators
    for (const initiatorId of assignedInitiators) {
      const notification = new Notification({
        userId: initiatorId,
        type: 'task_assigned',
        title: 'New Assignment Created',
        message: `You have been assigned: ${task.title}`,
        taskId: task._id
      });
      await notification.save();
    }

    // Create notifications for all reviewers
    for (const reviewerId of assignedReviewers) {
      const notification = new Notification({
        userId: reviewerId,
        type: 'task_assigned',
        title: 'New Review Assignment',
        message: `You have been assigned to review: ${task.title}`,
        taskId: task._id
      });
      await notification.save();
    }
    
    // Populate for response
    await task.populate('courseRef assignedToInitiators assignedToReviewers assignedBy');
    
    res.status(201).json({ 
      message: 'Assignment created successfully',
      task
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

// Create a legacy task (backward compatibility)
router.post('/create', async (req, res) => {
  try {
    const { title, description, category, docNumber, assignedTo, deadline, assignedBy } = req.body;
    
    // Create the task
    const task = new Task({
      title,
      description,
      category,
      docNumber,
      assignedTo,
      assignedBy,
      deadline: new Date(deadline)
    });
    
    await task.save();
    
    // Create notification for the assigned user
    const notification = new Notification({
      userId: assignedTo,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `You have been assigned a new task: ${title}`,
      taskId: task._id
    });
    
    await notification.save();
    
    res.status(201).json({ 
      message: 'Task created successfully',
      task: task
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get tasks for a specific user (SIMPLIFIED!)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;
    
    // Users can only see their own tasks (unless admin)
    if (requestingUser.role !== 'admin' && requestingUser._id.toString() !== userId) {
      return res.status(403).json({ error: 'You can only view your own tasks' });
    }
    
    // Use the simple findForUser method
    const tasks = await Task.findForUser(userId, requestingUser.role);
    
    res.json(tasks);
  } catch (error) {
    console.error('Get user tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get current user's tasks (SUPER SIMPLE!)
router.get('/my-tasks', async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    // ONE LINE - Get tasks directly assigned to user
    const tasks = await Task.findForUser(userId, userRole);
    
    res.json(tasks);
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch my tasks' });
  }
});

// Get specific task with access control (Enhanced for Multiple Users)
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const task = await Task.findById(taskId)
      .populate('courseRef', 'courseCode courseName school programme year')
      .populate('additionalCourses', 'courseCode courseName')
      .populate('assignedToInitiators', 'username email school')
      .populate('assignedToReviewers', 'username email school')
      .populate('assignedToInitiator', 'username email school')
      .populate('assignedToReviewer', 'username email school')
      .populate('assignedBy', 'username email')
      .populate('submissions.initiatorId', 'username email')
      .populate('mergedBy', 'username email');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Enhanced access check supporting multiple users
    if (!task.canUserAccess(userId, userRole)) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }
    
    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Upload file for task (SIMPLE PERMISSION CHECK)
router.post('/:taskId/upload', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { fileId } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check if user can upload (only initiator or admin)
    if (!task.canUserPerformAction(userId, 'upload', userRole)) {
      return res.status(403).json({ error: 'Only assigned initiators can upload files' });
    }
    
    // Add submission using new method
    task.addSubmission(userId, fileId);
    
    // Initialize reviewer approvals if this is the first submission
    if (task.status === 'file-uploaded' && task.submissions.length === 1) {
      task.initializeReviewerApprovals();
    }
    
    await task.save();
    
    // Check if this was a re-upload
    const submission = task.getSubmission(userId);
    const isReupload = submission && submission.version > 1;
    
    // Notify reviewers
    if (isReupload) {
      // Case 1: Re-upload (Update)
      const reviewers = task.getAllReviewers();
      for (const reviewerId of reviewers) {
        const notification = new Notification({
          userId: reviewerId,
          type: 'file_updated',
          title: 'Submission Updated',
          message: `An initiator has updated their submission for: ${task.title}`,
          taskId: task._id
        });
        await notification.save();
      }
    } else if (task.allInitiatorsSubmitted()) {
      // Case 2: All initiators have submitted (First time completion)
      const reviewers = task.getAllReviewers();
      for (const reviewerId of reviewers) {
        const notification = new Notification({
          userId: reviewerId,
          type: 'file_submitted',
          title: 'All Files Submitted',
          message: `All initiators have submitted files for: ${task.title}`,
          taskId: task._id
        });
        await notification.save();
      }
    }
    
    res.json({ message: 'File uploaded successfully', task });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// NEW: Merge files endpoint (Reviewer only) - AUTO-MERGE PDFs
router.post('/:taskId/merge', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const fileMergeService = require('../services/fileMergeService');
    const File = require('../models/File');
    const Course = require('../models/Course');
    
    const task = await Task.findById(taskId).populate('courseRef');
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check if user can review (only reviewer or admin)
    if (!task.canUserPerformAction(userId, 'review', userRole) && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only assigned reviewers can merge files' });
    }
    
    // Verify all initiators have submitted
    if (!task.allInitiatorsSubmitted()) {
      return res.status(400).json({ error: 'All initiators must submit before merging' });
    }
    
    // Check if already merged
    if (task.mergedFileId) {
      return res.status(400).json({ error: 'Files already merged', mergedFileId: task.mergedFileId });
    }
    
    // Get all submitted files
    const fileIds = task.submissions.map(sub => sub.fileId).filter(id => id);
    
    if (fileIds.length === 0) {
      return res.status(400).json({ error: 'No files submitted to merge' });
    }
    
    console.log(`🔄 Merging ${fileIds.length} files for task: ${task.title}`);
    
    // Merge PDFs automatically
    const mergedFile = await fileMergeService.mergeAndSave(
      fileIds,
      {
        taskId: task._id,
        courseId: task.courseRef?.courseId || 'UNKNOWN',
        courseRef: task.courseRef?._id,
        title: task.title
      },
      userId
    );
    
    console.log(`✅ Merged file created: ${mergedFile._id}`);
    
    // Set merged file on task
    task.setMergedFile(mergedFile._id, userId);
    await task.save();
    
    // Notify initiators that merge is complete
    const initiators = task.getAllInitiators();
    for (const initiatorId of initiators) {
      const notification = new Notification({
        userId: initiatorId,
        type: 'files_merged',
        title: 'Files Merged',
        message: `Your submissions for "${task.title}" have been merged by a reviewer`,
        taskId: task._id,
        metadata: {
          mergedFileId: mergedFile._id,
          filename: mergedFile.filename
        }
      });
      await notification.save();
    }
    
    res.json({ 
      message: 'Files merged successfully', 
      task,
      mergedFile: {
        id: mergedFile._id,
        filename: mergedFile.filename,
        size: mergedFile.size,
        totalPages: mergedFile.metadata?.totalPages,
        originalFileCount: mergedFile.metadata?.originalFileCount
      }
    });
  } catch (error) {
    console.error('Merge files error:', error);
    res.status(500).json({ error: 'Failed to merge files', details: error.message });
  }
});

// GET task submission status
router.get('/:taskId/submissions', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const task = await Task.findById(taskId)
      .populate('submissions.userId', 'username email school')
      .populate('submissions.fileId', 'filename size contentType createdAt')
      .populate('mergedFileId', 'filename size contentType metadata createdAt')
      .populate('mergedBy', 'username email school');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check access (initiators, reviewers, or admin can view)
    const canView = task.canUserPerformAction(userId, 'initiate', userRole) ||
                    task.canUserPerformAction(userId, 'review', userRole) ||
                    userRole === 'admin';
    
    if (!canView) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const initiators = task.getAllInitiators();
    const submissionStatus = {
      totalInitiators: initiators.length,
      submitted: task.submissions.length,
      pending: initiators.length - task.submissions.length,
      allSubmitted: task.allInitiatorsSubmitted(),
      isMerged: !!task.mergedFileId,
      submissions: task.submissions,
      mergedFile: task.mergedFileId ? {
        id: task.mergedFileId._id,
        filename: task.mergedFileId.filename,
        size: task.mergedFileId.size,
        totalPages: task.mergedFileId.metadata?.totalPages,
        originalFileCount: task.mergedFileId.metadata?.originalFileCount,
        mergedBy: task.mergedBy,
        mergedAt: task.mergedAt
      } : null
    };
    
    res.json(submissionStatus);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Failed to get submissions' });
  }
});

// Download merged file
router.get('/:taskId/merged-file/download', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const task = await Task.findById(taskId).populate('mergedFileId');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (!task.mergedFileId) {
      return res.status(404).json({ error: 'No merged file available' });
    }
    
    // Check access
    const canDownload = task.canUserPerformAction(userId, 'initiate', userRole) ||
                        task.canUserPerformAction(userId, 'review', userRole) ||
                        userRole === 'admin';
    
    if (!canDownload) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Stream file from GridFS
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'master-files'
    });
    
    const downloadStream = bucket.openDownloadStream(task.mergedFileId.metadata.gridfsId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${task.mergedFileId.filename}"`,
      'Content-Length': task.mergedFileId.size
    });
    
    downloadStream.pipe(res);
    
    downloadStream.on('error', (error) => {
      console.error('Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
    
  } catch (error) {
    console.error('Download merged file error:', error);
    res.status(500).json({ error: 'Failed to download merged file' });
  }
});

// Legacy upload file for task (backward compatibility)
router.post('/:taskId/upload-legacy', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { fileId } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check if user can upload (only initiator or admin)
    if (!task.canUserPerformAction(userId, 'upload', userRole)) {
      return res.status(403).json({ error: 'Only the assigned initiator can upload files' });
    }
    
    // Update task
    task.fileId = fileId;
    task.status = 'file-uploaded';
    task.submittedAt = new Date();
    
    // Initialize reviewer approvals when file is uploaded
    task.initializeReviewerApprovals();
    
    await task.save();
    
    res.json({ message: 'File uploaded successfully', task });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Submit a task (User uploads file)
router.put('/:taskId/submit', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { fileId } = req.body;
    
    const task = await Task.findByIdAndUpdate(
      taskId,
      {
        status: 'file-uploaded',
        fileId: fileId,
        submittedAt: new Date()
      },
      { new: true }
    ).populate('assignedToReviewer', 'username email school');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Initialize reviewer approvals when file is uploaded
    task.initializeReviewerApprovals();
    await task.save();
    
    // Create notification for the reviewer
    const notification = new Notification({
      userId: task.assignedToReviewer._id,
      type: 'file_submitted',
      title: 'File Submitted for Review',
      message: `${task.title} has been submitted and awaits your review`,
      taskId: task._id,
      fileId: fileId
    });
    
    await notification.save();
    
    res.json({ 
      message: 'Task submitted successfully',
      task: task
    });
  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// Reviewer approve action (different from admin final approval)
router.put('/:taskId/reviewer-approve', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    const reviewerId = req.user._id;
    
    console.log('Reviewer approve:', { taskId, reviewerId, comment });
    
    const task = await Task.findById(taskId)
      .populate('courseRef', 'courseCode courseName')
      .populate('assignedToInitiators', 'username email school')
      .populate('assignedToReviewers', 'username email school')
      .populate('assignedToInitiator', 'username email school')
      .populate('assignedToReviewer', 'username email school');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Initialize reviewer approvals if needed BEFORE checking authorization
    task.initializeReviewerApprovals();
    
    // Check if user can review this task
    if (!task.canUserPerformAction(reviewerId, 'review', req.user.role)) {
      console.log('Authorization failed - user cannot review this task');
      return res.status(403).json({ error: 'You are not authorized to review this task or have already reviewed it' });
    }
    
    console.log('Authorization passed - proceeding with approval');
    
    // Record the reviewer's approval
    console.log('Before recordReviewerDecision:', {
      reviewerApprovals: task.reviewerApprovals,
      status: task.status
    });
    
    task.recordReviewerDecision(reviewerId, 'approved', comment);
    
    console.log('After recordReviewerDecision:', {
      reviewerApprovals: task.reviewerApprovals,
      status: task.status
    });
    
    // Add to review comments for backward compatibility
    task.reviewComments.push({
      comment: comment || 'Approved',
      reviewedBy: reviewerId,
      action: 'approved'
    });
    
    await task.save();
    
    console.log('After save:', {
      reviewerApprovals: task.reviewerApprovals,
      status: task.status,
      saved: true
    });
    
    // Create notifications for relevant users
    try {
      const allInitiators = task.getAllInitiators();
      
      // Notify all initiators about the approval
      for (const initiatorId of allInitiators) {
        const notification = new Notification({
          userId: initiatorId,
          type: 'reviewer_approved',
          title: 'Document Approved by Reviewer',
          message: `Your submission for "${task.title}" has been approved by a reviewer`,
          taskId: task._id
        });
        await notification.save();
      }
      
      // If all reviewers approved, notify admin
      if (task.status === 'approved-by-reviewer') {
        const adminUsers = await User.find({ role: 'admin' });
        for (const admin of adminUsers) {
          const notification = new Notification({
            userId: admin._id,
            type: 'ready_for_final_approval',
            title: 'Document Ready for Final Approval',
            message: `"${task.title}" has been approved by all reviewers and awaits your final approval`,
            taskId: task._id
          });
          await notification.save();
        }
      }
    } catch (notifError) {
      console.error('Failed to send approval notifications:', notifError);
      // Continue execution
    }
    
    const populatedTask = await Task.findById(taskId)
      .populate('assignedToInitiators', 'username email school')
      .populate('assignedToReviewers', 'username email school')
      .populate('assignedToInitiator', 'username email school')
      .populate('assignedToReviewer', 'username email school')
      .populate('reviewerApprovals.reviewerId', 'username email school');
    
    res.json({ 
      message: 'Document approved successfully',
      task: populatedTask
    });
  } catch (error) {
    console.error('Reviewer approval error:', error);
    res.status(500).json({ error: 'Failed to approve document' });
  }
});

// Reviewer reject action
router.put('/:taskId/reviewer-reject', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    const reviewerId = req.user._id;
    
    console.log('Reviewer reject:', { taskId, reviewerId, comment });
    
    const task = await Task.findById(taskId)
      .populate('courseRef', 'courseCode courseName')
      .populate('assignedToInitiators', 'username email school')
      .populate('assignedToReviewers', 'username email school')
      .populate('assignedToInitiator', 'username email school')
      .populate('assignedToReviewer', 'username email school');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Initialize reviewer approvals if needed BEFORE checking authorization
    task.initializeReviewerApprovals();
    
    // Check if user can review this task
    if (!task.canUserPerformAction(reviewerId, 'review', req.user.role)) {
      return res.status(403).json({ error: 'You are not authorized to review this task or have already reviewed it' });
    }
    
    // Record the reviewer's rejection
    task.recordReviewerDecision(reviewerId, 'rejected', comment);
    task.rejectionReason = comment;
    
    // Add to review comments for backward compatibility
    task.reviewComments.push({
      comment: comment || 'Rejected',
      reviewedBy: reviewerId,
      action: 'rejected'
    });
    
    await task.save();
    
    // Create notifications for all initiators
    try {
      const allInitiators = task.getAllInitiators();
      
      for (const initiatorId of allInitiators) {
        const notification = new Notification({
          userId: initiatorId,
          type: 'reviewer_rejected',
          title: 'Document Rejected by Reviewer',
          message: `Your submission for "${task.title}" has been rejected. Reason: ${comment}`,
          taskId: task._id
        });
        await notification.save();
      }
    } catch (notifError) {
      console.error('Failed to send rejection notifications:', notifError);
      // Continue execution - don't fail the request just because notification failed
    }
    
    const populatedTask = await Task.findById(taskId)
      .populate('assignedToInitiators', 'username email school')
      .populate('assignedToReviewers', 'username email school')
      .populate('assignedToInitiator', 'username email school')
      .populate('assignedToReviewer', 'username email school')
      .populate('reviewerApprovals.reviewerId', 'username email school');
    
    res.json({ 
      message: 'Document rejected successfully',
      task: populatedTask
    });
  } catch (error) {
    console.error('Reviewer rejection error:', error);
    res.status(500).json({ error: 'Failed to reject document' });
  }
});

// Approve a task (Admin only)
router.put('/:taskId/approve', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    const adminId = req.user._id;
    
    console.log('Admin approve request:', { taskId, adminId, comment });
    
    const task = await Task.findById(taskId)
      .populate('courseRef', 'courseCode courseName')
      .populate('assignedToInitiators', 'username email school')
      .populate('assignedToReviewers', 'username email school')
      .populate('assignedToInitiator', 'username email school')
      .populate('assignedToReviewer', 'username email school');
    
    if (!task) {
      console.log('Task not found:', taskId);
      return res.status(404).json({ error: 'Task not found' });
    }
    
    console.log('Task found, current status:', task.status);
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('Authorization failed - user is not admin:', req.user.role);
      return res.status(403).json({ error: 'Only admins can perform final approval' });
    }
    
    // Initialize reviewer approvals if needed
    task.initializeReviewerApprovals();
    
    // Check if all reviewers have approved (for multiple reviewer system)
    if (task.assignedToReviewers && task.assignedToReviewers.length > 0) {
      console.log('Task has multiple reviewers, checking approvals...');
      console.log('Assigned reviewers:', task.assignedToReviewers.map(r => r._id || r));
      console.log('Current reviewer approvals:', task.reviewerApprovals);
      
      const allApproved = task.allReviewersApproved();
      console.log('All reviewers approved check result:', allApproved);
      
      if (!allApproved) {
        console.log('Not all reviewers have approved yet - returning error');
        return res.status(400).json({ error: 'All reviewers must approve before admin can give final approval' });
      }
      console.log('All reviewers have approved - proceeding with admin approval');
    } else {
      console.log('No multiple reviewers assigned, checking legacy system...');
      if (task.assignedToReviewer) {
        console.log('Legacy single reviewer assigned:', task.assignedToReviewer);
        console.log('Task status:', task.status);
        if (task.status !== 'approved-by-reviewer') {
          console.log('Legacy reviewer has not approved yet');
          return res.status(400).json({ error: 'Reviewer must approve before admin can give final approval' });
        }
      }
    }
    
    // Update task status to final approval
    task.status = 'approved-by-admin';
    task.reviewedBy = adminId;
    task.reviewedAt = new Date();
    
    // Add admin comment if provided
    if (comment) {
      task.reviewComments.push({
        comment: comment,
        reviewedBy: adminId,
        action: 'approved'
      });
    }
    
    await task.save();
    console.log('Task approved by admin, new status:', task.status);
    
    // Create notifications for all initiators
    const allInitiators = task.getAllInitiators();
    console.log('Notifying initiators:', allInitiators.length);
    
    for (const initiatorId of allInitiators) {
      const notification = new Notification({
        userId: initiatorId,
        type: 'file_approved',
        title: 'Final Approval - File Approved',
        message: `Your submission for "${task.title}" has received final admin approval`,
        taskId: task._id
      });
      
      await notification.save();
    }
    
    res.json({ 
      message: 'Task approved by admin successfully',
      task: task
    });
  } catch (error) {
    console.error('Admin approval error:', error);
    res.status(500).json({ error: 'Failed to approve task' });
  }
});

// Reject a task (Admin only)
router.put('/:taskId/reject', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reviewedBy, rejectionReason } = req.body;
    
    const task = await Task.findByIdAndUpdate(
      taskId,
      {
        status: 'rejected',
        reviewedBy: reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason
      },
      { new: true }
    ).populate('assignedToInitiator', 'username email school');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Create notification for the initiator
    const notification = new Notification({
      userId: task.assignedToInitiator._id,
      type: 'file_rejected',
      title: 'File Rejected',
      message: `Your submission for "${task.title}" has been rejected. Reason: ${rejectionReason}`,
      taskId: task._id
    });
    
    await notification.save();
    
    res.json({ 
      message: 'Task rejected successfully',
      task: task
    });
  } catch (error) {
    console.error('Task rejection error:', error);
    res.status(500).json({ error: 'Failed to reject task' });
  }
});

// Get tasks by category and status (for admin dashboard)
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { status } = req.query;
    
    const query = { category };
    if (status) query.status = status;
    
    const tasks = await Task.find(query)
      .populate('assignedTo', 'username email school')
      .populate('assignedBy', 'username email school')
      .sort({ createdAt: -1 });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks by category error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Delete a task (Admin only)
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await Task.findByIdAndDelete(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Delete related notifications
    await Notification.deleteMany({ taskId: taskId });
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Task deletion error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get all tasks (Admin can see all, users see assigned tasks) - Enhanced for Multiple Users
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/tasks - User:', req.user);
    console.log('GET /api/tasks - Query params:', req.query);
    
    const requestingUser = req.user;
    const { status, user } = req.query; // Get query parameters
    let filter = {};
    
    // Add status filter if provided
    if (status) {
      filter.status = status;
    }
    
    // Add user filter if provided (for specific user's tasks)
    if (user) {
      filter.$or = [
        // New array-based assignments
        { assignedToInitiators: user },
        { assignedToReviewers: user },
        // Legacy single assignments
        { assignedToInitiator: user },
        { assignedToReviewer: user }
      ];
    }
    
    let tasks;
    
    if (requestingUser.role === 'admin') {
      console.log('GET /api/tasks - Admin user, filter:', filter);
      // Admin sees all tasks (with optional filters)
      tasks = await Task.find(filter)
        .populate('courseRef', 'courseCode courseName school programme year semester')
        .populate('assignedToInitiators', 'username email school firstName lastName')
        .populate('assignedToReviewers', 'username email school firstName lastName')
        .populate('assignedToInitiator', 'username email school firstName lastName')
        .populate('assignedToReviewer', 'username email school firstName lastName')
        .populate('assignedBy', 'username email school firstName lastName')
        .populate('reviewerApprovals.reviewerId', 'username email school firstName lastName')
        .sort({ createdAt: -1 });
    } else {
      // Users see only their assigned tasks (with optional filters)
      const userFilter = {
        $or: [
          // New array-based assignments
          { assignedToInitiators: requestingUser._id },
          { assignedToReviewers: requestingUser._id },
          // Legacy single assignments
          { assignedToInitiator: requestingUser._id },
          { assignedToReviewer: requestingUser._id }
        ]
      };
      
      // Combine user filter with other filters
      const combinedFilter = { ...filter, ...userFilter };
      console.log('GET /api/tasks - Regular user, filter:', combinedFilter);
      
      tasks = await Task.find(combinedFilter)
        .populate('courseRef', 'courseCode courseName school programme year semester')
        .populate('assignedToInitiators', 'username email school firstName lastName')
        .populate('assignedToReviewers', 'username email school firstName lastName')
        .populate('assignedToInitiator', 'username email school firstName lastName')
        .populate('assignedToReviewer', 'username email school firstName lastName')
        .populate('assignedBy', 'username email school firstName lastName')
        .populate('reviewerApprovals.reviewerId', 'username email school firstName lastName')
        .sort({ createdAt: -1 });
    }
    
    console.log('GET /api/tasks - Found tasks:', tasks.length);
    res.json(tasks);
  } catch (error) {
    console.error('Fetch tasks error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
  }
});

// Create a new task (enhanced for both old and new course-centric workflows)
router.post('/', async (req, res) => {
  try {
    console.log('POST /api/tasks - Request body:', req.body);
    console.log('POST /api/tasks - User:', req.user);
    
    const {
      // New course-centric format
      courseId,
      templateId,
      // Old format (backward compatibility)
      title,
      description,
      courseCode,
      courseName,
      assignedToInitiator,
      assignedToReviewer,
      assignedToInitiators,
      assignedToReviewers,
      category,
      assignmentType,
      deadline
    } = req.body;
    
    // NEW COURSE-CENTRIC WORKFLOW
    if (courseId && templateId) {
      console.log('POST /api/tasks - Using new course-centric workflow');
      
      // Verify course exists
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      // Verify template exists
      const template = await AssignmentTemplate.findById(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      // Get initiators and reviewers from course members
      const initiators = course.getInitiators();
      const reviewers = course.getReviewers();
      
      if (initiators.length === 0 || reviewers.length === 0) {
        return res.status(400).json({ error: 'Course must have at least one initiator and one reviewer' });
      }
      
      // Create the task
      const task = new Task({
        title: template.templateName,
        description: template.description,
        courseRef: courseId,
        isPredefined: true,
        assignmentType: template.templateName,
        assignedToInitiators: initiators,
        assignedToReviewers: reviewers,
        assignedBy: req.user._id,
        deadline: new Date(deadline),
        status: 'assigned'
      });
      
      await task.save();
      
      // Create notifications for all initiators
      for (const initiatorId of initiators) {
        const notification = new Notification({
          userId: initiatorId,
          type: 'task_assigned',
          title: 'New Assignment Created',
          message: `You have been assigned: ${task.title} for ${course.courseCode}`,
          taskId: task._id
        });
        await notification.save();
      }
      
      // Populate for response
      const populatedTask = await Task.findById(task._id)
        .populate('courseRef', 'courseCode courseName school programme year semester')
        .populate('assignedToInitiators', 'username email school firstName lastName')
        .populate('assignedToReviewers', 'username email school firstName lastName')
        .populate('assignedBy', 'username email school firstName lastName');
      
      return res.status(201).json({ 
        message: 'Assignment created successfully',
        task: populatedTask
      });
    }
    
    // OLD WORKFLOW (backward compatibility)
    console.log('POST /api/tasks - Using old workflow (backward compatibility)');
    
    const taskData = {
      title: title || `${courseCode} ${assignmentType || 'Assignment'}`,
      description,
      courseCode,
      courseName,
      assignedBy: req.user._id,
      category: assignmentType || category || 'course-material',
      deadline: new Date(deadline),
      status: 'assigned'
    };

    // Handle multiple initiators (new feature)
    if (assignedToInitiators && Array.isArray(assignedToInitiators) && assignedToInitiators.length > 0) {
      taskData.assignedToInitiators = assignedToInitiators;
    } else if (assignedToInitiator) {
      // Backward compatibility: single initiator
      taskData.assignedToInitiator = assignedToInitiator;
      taskData.assignedToInitiators = [assignedToInitiator];
    }

    // Handle multiple reviewers (new feature)
    if (assignedToReviewers && Array.isArray(assignedToReviewers) && assignedToReviewers.length > 0) {
      taskData.assignedToReviewers = assignedToReviewers;
    } else if (assignedToReviewer) {
      // Backward compatibility: single reviewer
      taskData.assignedToReviewer = assignedToReviewer;
      taskData.assignedToReviewers = [assignedToReviewer];
    }
    
    const task = new Task(taskData);
    
    console.log('POST /api/tasks - Task to save:', task);
    
    await task.save();
    
    console.log('POST /api/tasks - Task saved successfully');
    
    // Create notifications for all assigned users
    const allAssignedUsers = [];
    
    // Collect all initiators
    if (task.assignedToInitiators && task.assignedToInitiators.length > 0) {
      allAssignedUsers.push(...task.assignedToInitiators.map(id => ({ id, role: 'initiator' })));
    }
    
    // Collect all reviewers
    if (task.assignedToReviewers && task.assignedToReviewers.length > 0) {
      allAssignedUsers.push(...task.assignedToReviewers.map(id => ({ id, role: 'reviewer' })));
    }
    
    // Remove duplicates (in case someone is both initiator and reviewer)
    const uniqueUsers = allAssignedUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.id.toString() === user.id.toString())
    );
    
    // Create notifications for all assigned users
    for (const user of uniqueUsers) {
      const notification = new Notification({
        userId: user.id,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `You have been assigned as ${user.role} for: ${task.title}`,
        taskId: task._id
      });
      await notification.save();
    }
    
    const populatedTask = await Task.findById(task._id)
      .populate('courseRef', 'courseCode courseName school programme year semester')
      .populate('assignedToInitiators', 'username email school firstName lastName')
      .populate('assignedToReviewers', 'username email school firstName lastName')
      .populate('assignedToInitiator', 'username email school firstName lastName')
      .populate('assignedToReviewer', 'username email school firstName lastName')
      .populate('assignedBy', 'username email school firstName lastName');
    
    res.status(201).json({ 
      message: 'Task created successfully',
      task: populatedTask
    });
  } catch (error) {
    console.error('Task creation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

// Update a task (Enhanced for Multiple Users)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Handle multiple user assignments in updates
    if (updateData.assignedToInitiators && Array.isArray(updateData.assignedToInitiators)) {
      // Ensure backward compatibility
      if (updateData.assignedToInitiators.length > 0) {
        updateData.assignedToInitiator = updateData.assignedToInitiators[0];
      }
    }
    
    if (updateData.assignedToReviewers && Array.isArray(updateData.assignedToReviewers)) {
      // Ensure backward compatibility
      if (updateData.assignedToReviewers.length > 0) {
        updateData.assignedToReviewer = updateData.assignedToReviewers[0];
      }
    }
    
    const task = await Task.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('assignedToInitiators', 'username email school')
      .populate('assignedToReviewers', 'username email school')
      .populate('assignedToInitiator', 'username email school')
      .populate('assignedToReviewer', 'username email school')
      .populate('assignedBy', 'username email school');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    console.error('Task update error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Add/Remove users to/from task assignments (New Multiple User Management)
router.put('/:taskId/assignments', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, userIds, role } = req.body; // action: 'add' | 'remove', role: 'initiator' | 'reviewer'
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can modify task assignments' });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }
    
    // Perform the assignment operation
    for (const userId of userIds) {
      if (action === 'add') {
        if (role === 'initiator') {
          task.addInitiator(userId);
        } else if (role === 'reviewer') {
          task.addReviewer(userId);
        }
      } else if (action === 'remove') {
        if (role === 'initiator') {
          task.removeInitiator(userId);
        } else if (role === 'reviewer') {
          task.removeReviewer(userId);
        }
      }
    }
    
    await task.save();
    
    // Create notifications for newly assigned users
    if (action === 'add') {
      for (const userId of userIds) {
        const notification = new Notification({
          userId: userId,
          type: 'task_assigned',
          title: `Added to Task as ${role}`,
          message: `You have been added as ${role} for: ${task.title}`,
          taskId: task._id
        });
        await notification.save();
      }
    }
    
    const updatedTask = await Task.findById(taskId)
      .populate('assignedToInitiators', 'username email school')
      .populate('assignedToReviewers', 'username email school')
      .populate('assignedToInitiator', 'username email school')
      .populate('assignedToReviewer', 'username email school')
      .populate('assignedBy', 'username email school');
    
    res.json({
      message: `Users ${action}ed successfully`,
      task: updatedTask
    });
  } catch (error) {
    console.error('Assignment modification error:', error);
    res.status(500).json({ error: 'Failed to modify assignments' });
  }
});

module.exports = router;


