const express = require('express');
const AssignmentTemplate = require('../models/AssignmentTemplate');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Apply authentication to all routes
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
    
    res.json(templates);
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
