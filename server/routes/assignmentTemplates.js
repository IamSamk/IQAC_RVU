const express = require('express');
const AssignmentTemplate = require('../models/AssignmentTemplate');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Download route BEFORE authentication middleware (handles auth itself via query param)
router.get('/:templateId/download', async (req, res) => {
  try {
    // Allow token from query param for window.open() requests OR from Authorization header
    let token = req.headers.authorization?.split(' ')[1];
    if (!token && req.query.token) {
      token = req.query.token;
    }
    
    console.log('🔑 Download request - Token present:', !!token);
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    // Verify token manually since we're bypassing middleware
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      req.user = user;
      console.log('✅ User authenticated:', user.email);
    } catch (err) {
      console.error('❌ Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    const path = require('path');
    const fs = require('fs');
    
    const template = await AssignmentTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Map template names to actual file paths
    const templateFilesDir = path.join(__dirname, '../..', 'SoCSE Course File Templates-20251108T075249Z-1-001', 'SoCSE Course File Templates');
    
    // Template name to file mapping (based on ACTUAL database template names)
    const fileMapping = {
      // Root Level
      '00_Front Sheet': '000_Front Sheet.docx',
      '01_Index Sheet': '00_New  Index Sheet.docx',
      '02_Syllabus & Lesson Plan': '02_03_2025-26 New  Template for Syllabus_Lesson Plan.docx',
      '03_Class Timetable': '04_Sample Class TT.docx',
      '04_Students List': '05_Students List Format.docx',
      '05_Grade Book': '06_Sample Grade Book .xlsx',
      '06_Course Exit Survey Analysis': '091_Course Exit Survey Analysis.docx',
      '07_Minutes of Meeting': '10_MIN 6 MOM_About Course Design_CIE1_CIE2_CIE3_RETEST_NE LIST_SEE QP.docx',
      '08_Individual Faculty Timetable': 'Individual  TT.docx',
      
      // CIE/SEE Exams folder
      '09_CIE-1 Question Paper': '6a_8_CIE_CIE2_SEE exam and Marks/CIE_QP_Format.pdf',
      '10_CIE-1 Answer Scheme': '6a_8_CIE_CIE2_SEE exam and Marks/CIE_Answer Scheme.pdf',
      '11_CIE-1 Consolidated Marks': '6a_8_CIE_CIE2_SEE exam and Marks/Consolidated Marks of CIE1.docx',
      '12_CIE-2 Question Paper': '6a_8_CIE_CIE2_SEE exam and Marks/CIE 2_QP_Format.pdf',
      '13_CIE-2 Consolidated Marks': '6a_8_CIE_CIE2_SEE exam and Marks/Consolidated Marks of CIE2.docx',
      '14_CIE-3 Consolidated Marks': '6a_8_CIE_CIE2_SEE exam and Marks/Consolidated Marks of CIE3.docx',
      '15_CIE Consolidated Marks (All)': '6a_8_CIE_CIE2_SEE exam and Marks/CIE Consolidated Marks.docx',
      '16_List of Slow Learners': '6a_8_CIE_CIE2_SEE exam and Marks/List of Slow Learners .docx',
      '17_SEE Question Paper': '6a_8_CIE_CIE2_SEE exam and Marks/SEE_QP_Format.pdf',
      
      // Remedial folder
      '18_Remedial Timetable': '6b_Remedial Folder/BTech_ Remedial Time Table.xlsx',
      '19_Remedial Student List': '6b_Remedial Folder/Student List Remedial Class.xlsx',
      '20_Remedial Attendance': '6b_Remedial Folder/Attendance  Student List Remedial Class.xlsx',
      '21_Remedial Topics Taught': '6b_Remedial Folder/Topics Taught.docx',
      '22_Improvement Marks Analysis': '6b_Remedial Folder/Improvement Marks Analysis.xlsx'
    };
    
    const fileName = fileMapping[template.templateName];
    if (!fileName) {
      return res.status(404).json({ error: 'Template file not found', templateName: template.templateName });
    }
    
    const filePath = path.join(templateFilesDir, fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return res.status(404).json({ error: 'Template file does not exist on server' });
    }
    
    // Get file extension
    const ext = path.extname(fileName).toLowerCase();
    let contentType;
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (ext === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      contentType = 'application/octet-stream';
    }
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    
    // PDFs can be viewed inline; other types download
    if (req.query.inline === 'true' && ext === '.pdf') {
      res.setHeader('Content-Disposition', `inline; filename="${template.templateName}${ext}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${template.templateName}${ext}"`);
    }
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    console.log('📥 Serving template file:', template.templateName, '→', fileName);
  } catch (error) {
    console.error('❌ Download template error:', error);
    res.status(500).json({ error: 'Failed to download template' });
  }
});

// Apply authentication to all OTHER routes
router.use(authenticateToken);

// Get all templates (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { category, school, programme, parentFolder, predefinedOnly } = req.query;
    
    let query = { isActive: true };
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by parent folder
    if (parentFolder) {
      query.parentFolder = parentFolder;
    }
    
    // Filter by predefined only
    if (predefinedOnly === 'true') {
      query.isPredefined = true;
    }
    
    let templates = await AssignmentTemplate.find(query)
      .sort({ order: 1, templateName: 1 });
    
    // Filter by school/programme applicability
    if (school || programme) {
      templates = templates.filter(template => 
        template.isApplicableTo(school, programme)
      );
    }
    
    // Return in format expected by frontend
    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get predefined templates only
router.get('/predefined', async (req, res) => {
  try {
    const templates = await AssignmentTemplate.getPredefined();
    res.json(templates);
  } catch (error) {
    console.error('Get predefined templates error:', error);
    res.status(500).json({ error: 'Failed to fetch predefined templates' });
  }
});

// Get custom templates only
router.get('/custom', async (req, res) => {
  try {
    const templates = await AssignmentTemplate.getCustom();
    res.json(templates);
  } catch (error) {
    console.error('Get custom templates error:', error);
    res.status(500).json({ error: 'Failed to fetch custom templates' });
  }
});

// Get templates by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const templates = await AssignmentTemplate.getByCategory(category);
    res.json(templates);
  } catch (error) {
    console.error('Get templates by category error:', error);
    res.status(500).json({ error: 'Failed to fetch templates by category' });
  }
});

// Get templates by parent folder
router.get('/folder/:folder', async (req, res) => {
  try {
    const { folder } = req.params;
    const templates = await AssignmentTemplate.getByFolder(folder);
    res.json(templates);
  } catch (error) {
    console.error('Get templates by folder error:', error);
    res.status(500).json({ error: 'Failed to fetch templates by folder' });
  }
});

// Get templates for a specific course
router.get('/for-course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Get the course to determine school and programme
    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const templates = await AssignmentTemplate.getForCourse(course.school, course.programme);
    res.json(templates);
  } catch (error) {
    console.error('Get templates for course error:', error);
    res.status(500).json({ error: 'Failed to fetch templates for course' });
  }
});

// Get single template by ID
router.get('/:templateId', async (req, res) => {
  try {
    const template = await AssignmentTemplate.findById(req.params.templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create custom template (Admin only)
router.post('/', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create templates' });
    }
    
    const { 
      templateName, 
      category, 
      description, 
      order, 
      parentFolder,
      applicableToSchools,
      applicableToProgrammes
    } = req.body;
    
    // Validate required fields
    if (!templateName || !category) {
      return res.status(400).json({ error: 'Missing required fields: templateName, category' });
    }
    
    // Check for duplicate template name
    const existingTemplate = await AssignmentTemplate.findOne({ templateName });
    if (existingTemplate) {
      return res.status(400).json({ error: 'Template with this name already exists' });
    }
    
    // Create custom template
    const template = new AssignmentTemplate({
      templateName,
      category,
      description,
      order,
      parentFolder,
      isPredefined: false, // Custom template
      createdBy: req.user._id,
      applicableToSchools: applicableToSchools || [],
      applicableToProgrammes: applicableToProgrammes || [],
      isActive: true
    });
    
    await template.save();
    
    res.status(201).json({
      message: 'Custom template created successfully',
      template
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template', details: error.message });
  }
});

// Update template (Admin only)
router.put('/:templateId', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update templates' });
    }
    
    const template = await AssignmentTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Prevent updating predefined templates' core fields
    if (template.isPredefined) {
      return res.status(400).json({ 
        error: 'Cannot modify predefined templates. Create a custom template instead.' 
      });
    }
    
    const { 
      templateName, 
      category, 
      description, 
      order,
      parentFolder,
      applicableToSchools,
      applicableToProgrammes,
      isActive
    } = req.body;
    
    // Update fields
    if (templateName) template.templateName = templateName;
    if (category) template.category = category;
    if (description !== undefined) template.description = description;
    if (order !== undefined) template.order = order;
    if (parentFolder !== undefined) template.parentFolder = parentFolder;
    if (applicableToSchools) template.applicableToSchools = applicableToSchools;
    if (applicableToProgrammes) template.applicableToProgrammes = applicableToProgrammes;
    if (isActive !== undefined) template.isActive = isActive;
    
    await template.save();
    
    res.json({
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete custom template (Admin only)
router.delete('/:templateId', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete templates' });
    }
    
    const template = await AssignmentTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Prevent deleting predefined templates
    if (template.isPredefined) {
      return res.status(400).json({ 
        error: 'Cannot delete predefined templates. You can deactivate them instead.' 
      });
    }
    
    // Check if template is being used in any tasks
    const Task = require('../models/Task');
    const taskCount = await Task.countDocuments({ 
      assignmentType: template.templateName,
      isPredefined: false
    });
    
    if (taskCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete template that is used in existing assignments',
        taskCount 
      });
    }
    
    await AssignmentTemplate.findByIdAndDelete(req.params.templateId);
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Deactivate template (Admin only) - Soft delete for predefined templates
router.put('/:templateId/deactivate', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can deactivate templates' });
    }
    
    const template = await AssignmentTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    template.isActive = false;
    await template.save();
    
    res.json({
      message: 'Template deactivated successfully',
      template
    });
  } catch (error) {
    console.error('Deactivate template error:', error);
    res.status(500).json({ error: 'Failed to deactivate template' });
  }
});

// Reactivate template (Admin only)
router.put('/:templateId/activate', async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can activate templates' });
    }
    
    const template = await AssignmentTemplate.findById(req.params.templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    template.isActive = true;
    await template.save();
    
    res.json({
      message: 'Template activated successfully',
      template
    });
  } catch (error) {
    console.error('Activate template error:', error);
    res.status(500).json({ error: 'Failed to activate template' });
  }
});

module.exports = router;
