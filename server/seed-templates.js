const mongoose = require('mongoose');
require('dotenv').config();
const AssignmentTemplate = require('./models/AssignmentTemplate');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://IamSamk:2gRB01wOhNhKIqvP@iqac.mlrfsfs.mongodb.net/IQAC?retryWrites=true&w=majority&appName=IQAC';

// 23 NAAC templates matching SoCSE Course File Templates structure
const templates = [
  // Root Level Templates (Order 1-11)
  {
    templateName: '00_Front Sheet',
    category: 'Documentation',
    description: 'Course file front sheet with basic course information',
    order: 1,
    parentFolder: null,
    isPredefined: true
  },
  {
    templateName: '01_Index Sheet',
    category: 'Documentation',
    description: 'Index/Table of contents for course file',
    order: 2,
    parentFolder: null,
    isPredefined: true
  },
  {
    templateName: '02_Syllabus & Lesson Plan',
    category: 'Academic',
    description: '2025-26 Template for course syllabus and lesson plan',
    order: 3,
    parentFolder: null,
    isPredefined: true
  },
  {
    templateName: '03_Class Timetable',
    category: 'Academic',
    description: 'Sample class timetable format',
    order: 4,
    parentFolder: null,
    isPredefined: true
  },
  {
    templateName: '04_Students List',
    category: 'Academic',
    description: 'Format for student list with enrollment details',
    order: 5,
    parentFolder: null,
    isPredefined: true
  },
  {
    templateName: '05_Grade Book',
    category: 'Evaluation',
    description: 'Sample grade book for marking and tracking',
    order: 6,
    parentFolder: null,
    isPredefined: true
  },
  {
    templateName: '06_Course Exit Survey Analysis',
    category: 'Feedback',
    description: 'Analysis of course exit survey responses',
    order: 7,
    parentFolder: null,
    isPredefined: true
  },
  {
    templateName: '07_Minutes of Meeting',
    category: 'Administrative',
    description: 'MOM for course design, CIE, retest, NE list, SEE discussions',
    order: 8,
    parentFolder: null,
    isPredefined: true
  },
  {
    templateName: '08_Individual Faculty Timetable',
    category: 'Academic',
    description: 'Individual faculty teaching timetable',
    order: 9,
    parentFolder: null,
    isPredefined: true
  },

  // 6a_CIE/SEE Exams Folder Templates (Order 10-18)
  {
    templateName: '09_CIE-1 Question Paper',
    category: 'Evaluation',
    description: 'CIE-1 question paper format',
    order: 10,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },
  {
    templateName: '10_CIE-1 Answer Scheme',
    category: 'Evaluation',
    description: 'CIE-1 answer key and marking scheme',
    order: 11,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },
  {
    templateName: '11_CIE-1 Consolidated Marks',
    category: 'Evaluation',
    description: 'Consolidated marks sheet for CIE-1',
    order: 12,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },
  {
    templateName: '12_CIE-2 Question Paper',
    category: 'Evaluation',
    description: 'CIE-2 question paper format',
    order: 13,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },
  {
    templateName: '13_CIE-2 Consolidated Marks',
    category: 'Evaluation',
    description: 'Consolidated marks sheet for CIE-2',
    order: 14,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },
  {
    templateName: '14_CIE-3 Consolidated Marks',
    category: 'Evaluation',
    description: 'Consolidated marks sheet for CIE-3',
    order: 15,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },
  {
    templateName: '15_CIE Consolidated Marks (All)',
    category: 'Evaluation',
    description: 'Overall consolidated marks for all CIE assessments',
    order: 16,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },
  {
    templateName: '16_List of Slow Learners',
    category: 'Academic',
    description: 'Identification of students needing additional support',
    order: 17,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },
  {
    templateName: '17_SEE Question Paper',
    category: 'Evaluation',
    description: 'Semester End Examination question paper format',
    order: 18,
    parentFolder: 'CIE/SEE Exams',
    isPredefined: true
  },

  // 6b_Remedial Folder Templates (Order 19-23)
  {
    templateName: '18_Remedial Timetable',
    category: 'Remedial',
    description: 'BTech remedial class timetable',
    order: 19,
    parentFolder: 'Remedial',
    isPredefined: true
  },
  {
    templateName: '19_Remedial Student List',
    category: 'Remedial',
    description: 'List of students enrolled in remedial classes',
    order: 20,
    parentFolder: 'Remedial',
    isPredefined: true
  },
  {
    templateName: '20_Remedial Attendance',
    category: 'Remedial',
    description: 'Attendance tracking for remedial classes',
    order: 21,
    parentFolder: 'Remedial',
    isPredefined: true
  },
  {
    templateName: '21_Remedial Topics Taught',
    category: 'Remedial',
    description: 'Documentation of topics covered in remedial sessions',
    order: 22,
    parentFolder: 'Remedial',
    isPredefined: true
  },
  {
    templateName: '22_Improvement Marks Analysis',
    category: 'Remedial',
    description: 'Analysis of student improvement after remedial classes',
    order: 23,
    parentFolder: 'Remedial',
    isPredefined: true
  }
];

async function seedTemplates() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing templates
    console.log('🗑️  Clearing existing templates...');
    await AssignmentTemplate.deleteMany({ isPredefined: true });
    console.log('✅ Existing templates cleared');

    // Insert new templates
    console.log('📝 Inserting 23 NAAC templates...');
    const result = await AssignmentTemplate.insertMany(templates);
    console.log(`✅ Successfully inserted ${result.length} templates`);

    // Display template summary
    console.log('\n📊 Template Summary by Category:');
    const byCategory = templates.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} templates`);
    });

    console.log('\n📁 Template Summary by Folder:');
    const byFolder = templates.reduce((acc, t) => {
      const folder = t.parentFolder || 'Root Level';
      acc[folder] = (acc[folder] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byFolder).forEach(([folder, count]) => {
      console.log(`   ${folder}: ${count} templates`);
    });

    console.log('\n🎉 Template seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seed function
seedTemplates();
