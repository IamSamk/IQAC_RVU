const mongoose = require('mongoose');

const assignmentTemplateSchema = new mongoose.Schema({
  templateName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  category: {
    type: String,
    required: true,
    enum: ['Documentation', 'Academic', 'Administrative', 'Evaluation', 'Feedback', 'Remedial'],
    index: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  order: {
    type: Number,
    default: 0
  },
  
  parentFolder: {
    type: String,
    enum: ['CIE/SEE Exams', 'Remedial', null],
    default: null
  },
  
  isPredefined: {
    type: Boolean,
    default: false,
    index: true
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Filtering options (empty arrays = applies to all)
  applicableToSchools: [{
    type: String,
    trim: true
  }],
  
  applicableToProgrammes: [{
    type: String,
    trim: true
  }],
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
assignmentTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual to check if template is applicable to a specific school/programme
assignmentTemplateSchema.methods.isApplicableTo = function(school, programme) {
  const schoolMatch = this.applicableToSchools.length === 0 || 
                      this.applicableToSchools.includes(school);
  const programmeMatch = this.applicableToProgrammes.length === 0 || 
                         this.applicableToProgrammes.includes(programme);
  return schoolMatch && programmeMatch;
};

// Static method to get templates for a course
assignmentTemplateSchema.statics.getForCourse = async function(school, programme) {
  const templates = await this.find({ isActive: true }).sort({ order: 1, templateName: 1 });
  return templates.filter(t => t.isApplicableTo(school, programme));
};

// Static method to get predefined templates
assignmentTemplateSchema.statics.getPredefined = async function() {
  return this.find({ isPredefined: true, isActive: true }).sort({ order: 1 });
};

// Static method to get custom templates
assignmentTemplateSchema.statics.getCustom = async function() {
  return this.find({ isPredefined: false, isActive: true })
    .populate('createdBy', 'username email')
    .sort({ createdAt: -1 });
};

// Static method to get templates by category
assignmentTemplateSchema.statics.getByCategory = async function(category) {
  return this.find({ category, isActive: true }).sort({ order: 1, templateName: 1 });
};

// Static method to get templates by folder
assignmentTemplateSchema.statics.getByFolder = async function(folderName) {
  const filter = folderName ? { parentFolder: folderName } : { parentFolder: null };
  return this.find({ ...filter, isActive: true }).sort({ order: 1 });
};

const AssignmentTemplate = mongoose.model('AssignmentTemplate', assignmentTemplateSchema, 'others');

module.exports = AssignmentTemplate;
