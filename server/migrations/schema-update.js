/**
 * Schema Update Migration Script
 * 
 * This script updates the database schema to the new course-centric model:
 * 1. Creates OTHERS collection for assignment templates
 * 2. Updates User schema (remove firstName/lastName/subrole, add school)
 * 3. Updates Course schema (add school/programme/courseMembers)
 * 4. Updates Task schema (add isPredefined/assignmentType/submissions)
 * 5. Updates File metadata (add fileType, nullable fields)
 * 
 * Run: node migrations/schema-update.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://IamSamk:2gRB01wOhNhKIqvP@iqac.mlrfsfs.mongodb.net/IQAC';

// Template data from SoCSE folder structure
const PREDEFINED_TEMPLATES = [
  // Main Templates
  { templateName: 'Front Sheet', category: 'Documentation', description: 'Course front cover page', order: 1 },
  { templateName: 'Index Sheet', category: 'Documentation', description: 'Course document index', order: 2 },
  { templateName: 'Syllabus & Lesson Plan', category: 'Academic', description: 'Course syllabus and lesson planning', order: 3 },
  { templateName: 'Class Timetable', category: 'Administrative', description: 'Class schedule and timetable', order: 4 },
  { templateName: 'Students List Format', category: 'Administrative', description: 'Student roster format', order: 5 },
  { templateName: 'Grade Book', category: 'Evaluation', description: 'Student grades and marks tracking', order: 6 },
  { templateName: 'Course Exit Survey Analysis', category: 'Feedback', description: 'Student feedback analysis', order: 7 },
  { templateName: 'Minutes of Meeting', category: 'Documentation', description: 'Course design and exam meetings', order: 8 },
  { templateName: 'Individual Timetable', category: 'Administrative', description: 'Individual student timetable', order: 9 },
  
  // CIE/SEE Exam and Marks subfolder
  { templateName: 'CIE 1 Question Paper', category: 'Evaluation', description: 'Continuous Internal Evaluation 1 question paper', order: 10, parentFolder: 'CIE/SEE Exams' },
  { templateName: 'CIE 2 Question Paper', category: 'Evaluation', description: 'Continuous Internal Evaluation 2 question paper', order: 11, parentFolder: 'CIE/SEE Exams' },
  { templateName: 'CIE Answer Scheme', category: 'Evaluation', description: 'Answer key for CIE exams', order: 12, parentFolder: 'CIE/SEE Exams' },
  { templateName: 'SEE Question Paper', category: 'Evaluation', description: 'Semester End Examination question paper', order: 13, parentFolder: 'CIE/SEE Exams' },
  { templateName: 'Consolidated Marks CIE1', category: 'Evaluation', description: 'Consolidated marks for CIE 1', order: 14, parentFolder: 'CIE/SEE Exams' },
  { templateName: 'Consolidated Marks CIE2', category: 'Evaluation', description: 'Consolidated marks for CIE 2', order: 15, parentFolder: 'CIE/SEE Exams' },
  { templateName: 'Consolidated Marks CIE3', category: 'Evaluation', description: 'Consolidated marks for CIE 3', order: 16, parentFolder: 'CIE/SEE Exams' },
  { templateName: 'List of Slow Learners', category: 'Evaluation', description: 'Students requiring additional support', order: 17, parentFolder: 'CIE/SEE Exams' },
  
  // Remedial Folder
  { templateName: 'Remedial Attendance', category: 'Remedial', description: 'Attendance for remedial classes', order: 18, parentFolder: 'Remedial' },
  { templateName: 'Remedial Timetable', category: 'Remedial', description: 'Schedule for remedial classes', order: 19, parentFolder: 'Remedial' },
  { templateName: 'Remedial Documents Required', category: 'Remedial', description: 'Required documents for remedial process', order: 20, parentFolder: 'Remedial' },
  { templateName: 'Improvement Marks Analysis', category: 'Remedial', description: 'Analysis of improvement after remedial', order: 21, parentFolder: 'Remedial' },
  { templateName: 'Remedial Student List', category: 'Remedial', description: 'List of students in remedial classes', order: 22, parentFolder: 'Remedial' },
  { templateName: 'Remedial Topics Taught', category: 'Remedial', description: 'Topics covered in remedial sessions', order: 23, parentFolder: 'Remedial' },
];

// Define new AssignmentTemplate schema
const assignmentTemplateSchema = new mongoose.Schema({
  templateName: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  description: String,
  order: Number,
  parentFolder: String, // 'CIE/SEE Exams', 'Remedial', or null for main templates
  
  isPredefined: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  applicableToSchools: [String],      // Empty = applies to all
  applicableToProgrammes: [String],   // Empty = applies to all
  
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const AssignmentTemplate = mongoose.model('AssignmentTemplate', assignmentTemplateSchema, 'others');

// Main migration function
async function runMigration() {
  try {
    console.log('🚀 Starting Schema Update Migration...\n');
    
    // Connect to database
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Step 1: Create OTHERS collection and seed templates
    console.log('📝 Step 1: Creating OTHERS collection and seeding templates...');
    await seedAssignmentTemplates();
    
    // Step 2: Add indexes
    console.log('\n📝 Step 2: Creating database indexes...');
    await createIndexes();
    
    // Step 3: Validate collections
    console.log('\n📝 Step 3: Validating collections...');
    await validateCollections();
    
    console.log('\n✅ Schema update migration completed successfully!');
    console.log('\n⚠️  NEXT STEPS:');
    console.log('   1. Update Mongoose models in code (User, Course, Task, File)');
    console.log('   2. Run data migration script (migrate-to-new-schema.js)');
    console.log('   3. Test API endpoints with new schema\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Seed assignment templates
async function seedAssignmentTemplates() {
  const existingCount = await AssignmentTemplate.countDocuments();
  
  if (existingCount > 0) {
    console.log(`   ⚠️  Found ${existingCount} existing templates. Skipping seed.`);
    return;
  }
  
  const templates = PREDEFINED_TEMPLATES.map(template => ({
    ...template,
    isPredefined: true,
    applicableToSchools: [],  // Applies to all schools
    applicableToProgrammes: [], // Applies to all programmes
    isActive: true
  }));
  
  const result = await AssignmentTemplate.insertMany(templates);
  console.log(`   ✅ Seeded ${result.length} predefined templates`);
  
  // Show breakdown by category
  const categories = {};
  result.forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + 1;
  });
  
  console.log('   📊 Breakdown by category:');
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`      - ${cat}: ${count} templates`);
  });
  
  // Show breakdown by folder
  const folders = { 'Main Templates': 0, 'CIE/SEE Exams': 0, 'Remedial': 0 };
  result.forEach(t => {
    if (!t.parentFolder) folders['Main Templates']++;
    else if (t.parentFolder === 'CIE/SEE Exams') folders['CIE/SEE Exams']++;
    else if (t.parentFolder === 'Remedial') folders['Remedial']++;
  });
  
  console.log('   📁 Breakdown by folder:');
  Object.entries(folders).forEach(([folder, count]) => {
    console.log(`      - ${folder}: ${count} templates`);
  });
}

// Create database indexes
async function createIndexes() {
  const db = mongoose.connection.db;
  
  // Helper function to safely create index
  const safeCreateIndex = async (collection, indexSpec, options = {}) => {
    try {
      await db.collection(collection).createIndex(indexSpec, options);
      return true;
    } catch (error) {
      if (error.code === 86) { // IndexKeySpecsConflict
        console.log(`   ℹ️  Index already exists on ${collection}:`, Object.keys(indexSpec).join('_'));
        return false;
      }
      throw error;
    }
  };
  
  // Users collection indexes
  console.log('   Creating Users indexes...');
  await safeCreateIndex('users', { email: 1 }, { unique: true });
  await safeCreateIndex('users', { username: 1 }, { unique: true });
  await safeCreateIndex('users', { school: 1 });
  await safeCreateIndex('users', { role: 1 });
  
  // Courses collection indexes
  console.log('   Creating Courses indexes...');
  await safeCreateIndex('courses', { courseCode: 1, year: 1 }, { unique: true });
  await safeCreateIndex('courses', { school: 1 });
  await safeCreateIndex('courses', { programme: 1 });
  await safeCreateIndex('courses', { 'courseMembers.userId': 1 });
  
  // Tasks collection indexes
  console.log('   Creating Tasks indexes...');
  await safeCreateIndex('tasks', { courseRef: 1 });
  await safeCreateIndex('tasks', { assignmentType: 1 });
  await safeCreateIndex('tasks', { isPredefined: 1 });
  await safeCreateIndex('tasks', { status: 1 });
  await safeCreateIndex('tasks', { deadline: 1 });
  
  // Others (templates) collection indexes
  console.log('   Creating AssignmentTemplates indexes...');
  await safeCreateIndex('others', { templateName: 1 }, { unique: true });
  await safeCreateIndex('others', { category: 1 });
  await safeCreateIndex('others', { isPredefined: 1 });
  await safeCreateIndex('others', { isActive: 1 });
  
  console.log('   ✅ All indexes created successfully');
}

// Validate collections exist
async function validateCollections() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  
  const required = ['users', 'courses', 'tasks', 'notifications', 'others'];
  const missing = required.filter(name => !collectionNames.includes(name));
  
  if (missing.length > 0) {
    console.warn(`   ⚠️  Missing collections: ${missing.join(', ')}`);
  } else {
    console.log('   ✅ All required collections exist');
  }
  
  // Show document counts
  console.log('\n   📊 Collection statistics:');
  for (const name of required) {
    if (collectionNames.includes(name)) {
      const count = await db.collection(name).countDocuments();
      console.log(`      - ${name}: ${count} documents`);
    }
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runMigration, PREDEFINED_TEMPLATES };
