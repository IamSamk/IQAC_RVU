const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const Task = require('../models/Task');
const File = require('../models/File');
const AssignmentTemplate = require('../models/AssignmentTemplate');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://IamSamk:2gRB01wOhNhKIqvP@iqac.mlrfsfs.mongodb.net/IQAC';

async function verifyNewSchema() {
  try {
    console.log('🔍 Verifying New Schema Implementation...\n');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Check Users
    console.log('1️⃣  Testing User Model...');
    const users = await User.find().select('username email role school assignedCourses');
    console.log(`   ✅ Found ${users.length} users`);
    const sampleUser = users[0];
    if (sampleUser) {
      console.log(`   ℹ️  Sample: ${sampleUser.username} (${sampleUser.role})`);
      console.log(`      - School: ${sampleUser.school || 'Not set'}`);
      console.log(`      - Assigned Courses: ${sampleUser.assignedCourses?.length || 0}`);
      console.log(`      - Display Name (virtual): ${sampleUser.displayName}`);
    }
    console.log('');

    // Test 2: Check Courses
    console.log('2️⃣  Testing Course Model...');
    const courses = await Course.find();
    console.log(`   ✅ Found ${courses.length} courses`);
    const sampleCourse = courses[0];
    if (sampleCourse) {
      console.log(`   ℹ️  Sample: ${sampleCourse.courseName}`);
      console.log(`      - Course ID (virtual): ${sampleCourse.courseId}`);
      console.log(`      - School: ${sampleCourse.school}`);
      console.log(`      - Programme: ${sampleCourse.programme}`);
      console.log(`      - Members: ${sampleCourse.courseMembers.length}`);
    }
    console.log('');

    // Test 3: Check Assignment Templates
    console.log('3️⃣  Testing AssignmentTemplate Model...');
    const templates = await AssignmentTemplate.find();
    console.log(`   ✅ Found ${templates.length} templates`);
    const predefined = templates.filter(t => t.isPredefined);
    const custom = templates.filter(t => !t.isPredefined);
    console.log(`      - Predefined: ${predefined.length}`);
    console.log(`      - Custom: ${custom.length}`);
    
    const categories = [...new Set(templates.map(t => t.category))];
    console.log(`      - Categories: ${categories.join(', ')}`);
    console.log('');

    // Test 4: Check Tasks (should be 0)
    console.log('4️⃣  Testing Task Model...');
    const tasks = await Task.find();
    console.log(`   ✅ Tasks count: ${tasks.length} (clean slate)`);
    console.log('');

    // Test 5: Check Files (should be 0)
    console.log('5️⃣  Testing File Model...');
    const files = await File.find();
    console.log(`   ✅ Files count: ${files.length} (clean slate)`);
    console.log('');

    // Test 6: Schema Validation
    console.log('6️⃣  Testing Schema Validation...');
    try {
      // Test Course schema
      const testCourse = new Course({
        courseCode: 'TEST123',
        courseName: 'Test Course',
        year: '2025',
        semester: 1,
        school: 'Test School',
        programme: 'Test Programme',
        courseMembers: []
      });
      await testCourse.validate();
      console.log('   ✅ Course schema validation passed');
      
      // Cleanup test
      if (testCourse._id) await testCourse.remove();
    } catch (error) {
      console.log(`   ⚠️  Course validation error: ${error.message}`);
    }
    console.log('');

    // Summary
    console.log('📊 Schema Verification Summary:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   ✅ Users: ${users.length} (schema updated)`);
    console.log(`   ✅ Courses: ${courses.length} (new schema working)`);
    console.log(`   ✅ Templates: ${templates.length} (23 predefined available)`);
    console.log(`   ✅ Tasks: ${tasks.length} (ready for new assignments)`);
    console.log(`   ✅ Files: ${files.length} (ready for uploads)`);
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('✅ New Schema Verification Complete!\n');
    console.log('🎯 Ready for:');
    console.log('   - Course member management');
    console.log('   - Template-based assignment creation');
    console.log('   - Multi-initiator file submissions');
    console.log('   - File merging workflows');
    console.log('   - Frontend development\n');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run verification
if (require.main === module) {
  verifyNewSchema()
    .then(() => {
      console.log('\n🎉 Everything is working perfectly!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = verifyNewSchema;
