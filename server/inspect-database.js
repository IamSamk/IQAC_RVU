const mongoose = require('mongoose');
require('dotenv').config();

// Import models to see their schemas
const User = require('./models/User');
const Task = require('./models/Task');
const Notification = require('./models/Notification');
const Course = require('./models/Course');
const File = require('./models/File');

async function inspectDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas\n');
    console.log('=' .repeat(80));

    const db = mongoose.connection.db;
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📊 COLLECTIONS IN DATABASE:');
    console.log('=' .repeat(80));
    collections.forEach(c => console.log(`  - ${c.name}`));

    console.log('\n\n');
    console.log('=' .repeat(80));
    console.log('📋 DETAILED COLLECTION ANALYSIS');
    console.log('=' .repeat(80));

    // Analyze each collection
    for (const collection of collections) {
      const collectionName = collection.name;
      const count = await db.collection(collectionName).countDocuments();
      
      console.log(`\n\n📁 Collection: ${collectionName.toUpperCase()}`);
      console.log('-' .repeat(80));
      console.log(`   Total Documents: ${count}`);
      
      if (count > 0) {
        // Get sample documents
        const samples = await db.collection(collectionName).find().limit(3).toArray();
        
        // Show schema structure from first document
        if (samples.length > 0) {
          console.log('\n   Schema Structure (from first document):');
          const firstDoc = samples[0];
          Object.keys(firstDoc).forEach(key => {
            const value = firstDoc[key];
            const type = Array.isArray(value) ? 'Array' : typeof value;
            const preview = Array.isArray(value) 
              ? `[${value.length} items]` 
              : type === 'object' 
                ? '{...}' 
                : String(value).substring(0, 50);
            console.log(`     • ${key}: ${type} = ${preview}`);
          });

          // Show sample data
          console.log('\n   Sample Documents:');
          samples.forEach((doc, idx) => {
            console.log(`\n   [${idx + 1}]`, JSON.stringify(doc, null, 6));
          });
        }
      } else {
        console.log('   (No documents in this collection)');
      }
    }

    // MODEL SCHEMA ANALYSIS
    console.log('\n\n');
    console.log('=' .repeat(80));
    console.log('🏗️  MODEL SCHEMAS (from code)');
    console.log('=' .repeat(80));

    console.log('\n📝 USER SCHEMA:');
    console.log('-' .repeat(80));
    console.log(User.schema.obj);

    console.log('\n\n📝 TASK SCHEMA:');
    console.log('-' .repeat(80));
    console.log(Task.schema.obj);

    console.log('\n\n📝 COURSE SCHEMA:');
    console.log('-' .repeat(80));
    console.log(Course.schema.obj);

    console.log('\n\n📝 NOTIFICATION SCHEMA:');
    console.log('-' .repeat(80));
    console.log(Notification.schema.obj);

    console.log('\n\n📝 FILE SCHEMA:');
    console.log('-' .repeat(80));
    console.log(File.schema.obj);

    // RELATIONSHIP ANALYSIS
    console.log('\n\n');
    console.log('=' .repeat(80));
    console.log('🔗 RELATIONSHIP ANALYSIS');
    console.log('=' .repeat(80));

    // Check Task relationships
    const tasks = await Task.find().limit(5);
    console.log('\n📋 TASKS (first 5):');
    console.log('-' .repeat(80));
    for (const task of tasks) {
      console.log(`\nTask ID: ${task._id}`);
      console.log(`  Title: ${task.title}`);
      console.log(`  Status: ${task.status}`);
      console.log(`  AssignedTo: ${task.assignedTo} (${task.assignedToRole || 'N/A'})`);
      console.log(`  AssignedBy: ${task.assignedBy}`);
      console.log(`  Reviewer: ${task.assignedToReviewers || 'N/A'}`);
      console.log(`  CourseCode: ${task.courseCode || 'N/A'}`);
      console.log(`  Program: ${task.program || 'N/A'}`);
      console.log(`  FileID: ${task.fileId || 'N/A'}`);
      console.log(`  Deadline: ${task.deadline || 'N/A'}`);
    }

    // Check User-Course relationships
    const users = await User.find().limit(5);
    console.log('\n\n👥 USERS (first 5):');
    console.log('-' .repeat(80));
    for (const user of users) {
      console.log(`\nUser ID: ${user._id}`);
      console.log(`  Name: ${user.firstName} ${user.lastName}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Username: ${user.username}`);
    }

    // Check Courses
    const courses = await Course.find();
    console.log('\n\n📚 COURSES:');
    console.log('-' .repeat(80));
    if (courses.length === 0) {
      console.log('  ⚠️  No courses found in database!');
    } else {
      for (const course of courses) {
        console.log(`\nCourse ID: ${course._id}`);
        console.log(`  Code: ${course.courseCode}`);
        console.log(`  Name: ${course.courseName}`);
        console.log(`  Program: ${course.program}`);
        console.log(`  Year: ${course.year}`);
        console.log(`  Semester: ${course.semester}`);
        console.log(`  Initiator: ${course.initiator || 'N/A'}`);
        console.log(`  Reviewers: ${course.reviewers || 'N/A'}`);
      }
    }

    // Check Files
    const filesCount = await db.collection('files.files').countDocuments();
    console.log('\n\n📎 FILES (GridFS):');
    console.log('-' .repeat(80));
    console.log(`  Total Files: ${filesCount}`);
    
    const sampleFiles = await db.collection('files.files').find().limit(5).toArray();
    sampleFiles.forEach(file => {
      console.log(`\n  File ID: ${file._id}`);
      console.log(`    Filename: ${file.filename}`);
      console.log(`    Size: ${(file.length / 1024).toFixed(2)} KB`);
      console.log(`    Upload Date: ${file.uploadDate}`);
      console.log(`    Metadata:`, file.metadata);
    });

    // SUMMARY AND RECOMMENDATIONS
    console.log('\n\n');
    console.log('=' .repeat(80));
    console.log('📊 SUMMARY & ANALYSIS');
    console.log('=' .repeat(80));

    const userCount = await User.countDocuments();
    const taskCount = await Task.countDocuments();
    const courseCount = await Course.countDocuments();
    const notificationCount = await Notification.countDocuments();

    console.log(`\n✅ Database Statistics:`);
    console.log(`   • Users: ${userCount}`);
    console.log(`   • Tasks/Assignments: ${taskCount}`);
    console.log(`   • Courses: ${courseCount}`);
    console.log(`   • Notifications: ${notificationCount}`);
    console.log(`   • Files: ${filesCount}`);

    console.log(`\n🎯 Current System Understanding:`);
    console.log(`   1. Tasks are assigned to individual users (assignedTo)`);
    console.log(`   2. Tasks have reviewers (assignedToReviewers array)`);
    console.log(`   3. Course model exists but may not be fully integrated`);
    console.log(`   4. File uploads use GridFS with metadata`);

    console.log(`\n⚠️  Missing/Incomplete Features:`);
    if (courseCount === 0) {
      console.log(`   • No courses in database - Course system not implemented`);
    }
    console.log(`   • Course-based role assignment (initiator/reviewer per course)`);
    console.log(`   • User profile showing course subroles`);
    console.log(`   • Assignment enablement per course`);
    console.log(`   • Reviewer can merge documents from multiple initiators`);

    await mongoose.disconnect();
    console.log('\n\n✅ Disconnected from MongoDB');
    console.log('=' .repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

inspectDatabase();
