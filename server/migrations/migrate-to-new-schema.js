const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const Task = require('../models/Task');
const File = require('../models/File');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://IamSamk:2gRB01wOhNhKIqvP@iqac.mlrfsfs.mongodb.net/IQAC';

async function migrateToNewSchema() {
  try {
    console.log('🔄 Starting migration to new schema...\n');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Create Course documents from existing Tasks
    console.log('📋 Step 1: Creating Course documents from existing Tasks...');
    const tasks = await Task.find({ courseCode: { $exists: true, $ne: '' } });
    console.log(`   Found ${tasks.length} tasks with course codes`);

    const courseMap = new Map(); // courseCode_year -> Course document
    const coursesToCreate = [];

    for (const task of tasks) {
      if (!task.courseCode || !task.courseName) continue;

      // Extract year from deadline or use current year
      const year = task.deadline ? task.deadline.getFullYear().toString() : new Date().getFullYear().toString();
      const courseKey = `${task.courseCode}_${year}`;

      if (!courseMap.has(courseKey)) {
        // Check if course already exists
        const existingCourse = await Course.findOne({ courseCode: task.courseCode, year });
        
        if (existingCourse) {
          courseMap.set(courseKey, existingCourse);
          console.log(`   ℹ️  Course already exists: ${task.courseCode} (${year})`);
        } else {
          // Prepare new course
          const courseData = {
            courseCode: task.courseCode,
            courseName: task.courseName,
            year,
            school: '', // Will be populated later if possible
            programme: '', // Will be populated later if possible
            semester: '',
            credits: 0,
            courseMembers: [],
            createdBy: task.assignedBy || null
          };
          coursesToCreate.push(courseData);
          console.log(`   ➕ Queued course: ${task.courseCode} - ${task.courseName} (${year})`);
        }
      }
    }

    // Create courses in bulk
    if (coursesToCreate.length > 0) {
      let createdCount = 0;
      for (const courseData of coursesToCreate) {
        try {
          const course = await Course.create(courseData);
          const courseKey = `${course.courseCode}_${course.year}`;
          courseMap.set(courseKey, course);
          createdCount++;
        } catch (error) {
          if (error.code === 11000) {
            // Duplicate key - course already exists, fetch it
            const existing = await Course.findOne({ 
              courseCode: courseData.courseCode, 
              year: courseData.year 
            });
            if (existing) {
              const courseKey = `${existing.courseCode}_${existing.year}`;
              courseMap.set(courseKey, existing);
            }
          } else {
            console.log(`   ⚠️  Error creating course ${courseData.courseCode}: ${error.message}`);
          }
        }
      }
      console.log(`   ✅ Created ${createdCount} new courses\n`);
    } else {
      console.log(`   ℹ️  No new courses to create\n`);
    }

    // Reload all courses to ensure we have complete data
    const allCourses = await Course.find();
    courseMap.clear();
    for (const course of allCourses) {
      const courseKey = `${course.courseCode}_${course.year}`;
      courseMap.set(courseKey, course);
    }

    // Step 2: Populate Course members from Tasks
    console.log('👥 Step 2: Populating course members from task assignments...');
    let memberAddCount = 0;

    for (const task of tasks) {
      if (!task.courseCode) continue;

      const year = task.deadline ? task.deadline.getFullYear().toString() : new Date().getFullYear().toString();
      const courseKey = `${task.courseCode}_${year}`;
      const course = courseMap.get(courseKey);

      if (!course) {
        console.log(`   ⚠️  Course not found for task: ${task.courseCode} (${year})`);
        continue;
      }

      // Add initiators
      const initiators = task.getAllInitiators ? task.getAllInitiators() : 
                        (task.assignedToInitiators || [task.assignedToInitiator].filter(Boolean));
      
      for (const initiatorId of initiators) {
        if (!course.isMember(initiatorId)) {
          course.addMember(initiatorId, 'initiator');
          memberAddCount++;
        }
      }

      // Add reviewers
      const reviewers = task.getAllReviewers ? task.getAllReviewers() : 
                       (task.assignedToReviewers || [task.assignedToReviewer].filter(Boolean));
      
      for (const reviewerId of reviewers) {
        if (!course.isMember(reviewerId)) {
          course.addMember(reviewerId, 'reviewer');
          memberAddCount++;
        }
      }

      await course.save();
    }

    console.log(`   ✅ Added ${memberAddCount} course members\n`);

    // Step 3: Update Tasks with courseRef
    console.log('🔗 Step 3: Updating tasks with courseRef...');
    let taskUpdateCount = 0;

    for (const task of tasks) {
      if (!task.courseCode || task.courseRef) continue; // Skip if already has courseRef

      const year = task.deadline ? task.deadline.getFullYear().toString() : new Date().getFullYear().toString();
      const courseKey = `${task.courseCode}_${year}`;
      const course = courseMap.get(courseKey);

      if (course) {
        task.courseRef = course._id;
        
        // Keep legacy fields for backward compatibility
        // task.courseCode and task.courseName remain unchanged
        
        await task.save();
        taskUpdateCount++;
      }
    }

    console.log(`   ✅ Updated ${taskUpdateCount} tasks with courseRef\n`);

    // Step 4: Update Files with courseRef and taskRef
    console.log('📁 Step 4: Updating files with courseRef and taskRef...');
    const files = await File.find();
    let fileUpdateCount = 0;

    for (const file of files) {
      let updated = false;

      // Set courseRef from metadata.courseCode
      if (file.metadata && file.metadata.courseCode && !file.courseRef) {
        const year = file.metadata.year || new Date().getFullYear().toString();
        const courseKey = `${file.metadata.courseCode}_${year}`;
        const course = courseMap.get(courseKey);

        if (course) {
          file.courseRef = course._id;
          updated = true;
        }
      }

      // Set taskRef from metadata.assignmentId
      if (file.metadata && file.metadata.assignmentId && !file.taskRef) {
        file.taskRef = file.metadata.assignmentId;
        updated = true;
      }

      // Set fileType from metadata.category
      if (file.metadata && file.metadata.category && !file.fileType) {
        if (file.metadata.category === 'assignment' || file.metadata.category === 'teaching-and-learning') {
          file.fileType = 'assignment';
        } else if (file.metadata.category === 'curriculum') {
          file.fileType = 'curriculum';
        } else {
          file.fileType = 'general';
        }
        updated = true;
      }

      if (updated) {
        await file.save();
        fileUpdateCount++;
      }
    }

    console.log(`   ✅ Updated ${fileUpdateCount} files with references\n`);

    // Step 5: Sync User assignedCourses
    console.log('🔄 Step 5: Syncing user assignedCourses...');
    const users = await User.find();
    let userSyncCount = 0;

    for (const user of users) {
      try {
        await user.syncAssignedCourses();
        userSyncCount++;
      } catch (error) {
        console.log(`   ⚠️  Error syncing user ${user.username}: ${error.message}`);
      }
    }

    console.log(`   ✅ Synced ${userSyncCount} users\n`);

    // Step 6: Cleanup legacy fields (optional - commented out for safety)
    console.log('🧹 Step 6: Legacy field cleanup (skipped for safety)');
    console.log('   ℹ️  Legacy fields kept for backward compatibility\n');

    // Migration Summary
    console.log('📊 Migration Summary:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Courses created/found: ${courseMap.size}`);
    console.log(`   Course members added: ${memberAddCount}`);
    console.log(`   Tasks updated: ${taskUpdateCount}`);
    console.log(`   Files updated: ${fileUpdateCount}`);
    console.log(`   Users synced: ${userSyncCount}`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Verify data integrity
    console.log('🔍 Verifying data integrity...');
    const coursesCount = await Course.countDocuments();
    const tasksCount = await Task.countDocuments();
    const filesCount = await File.countDocuments();
    const usersCount = await User.countDocuments();
    const tasksWithCourseRef = await Task.countDocuments({ courseRef: { $exists: true } });
    const filesWithCourseRef = await File.countDocuments({ courseRef: { $exists: true } });

    console.log('   Database Statistics:');
    console.log(`   - Courses: ${coursesCount}`);
    console.log(`   - Tasks: ${tasksCount} (${tasksWithCourseRef} with courseRef)`);
    console.log(`   - Files: ${filesCount} (${filesWithCourseRef} with courseRef)`);
    console.log(`   - Users: ${usersCount}`);
    console.log('');

    console.log('✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run migration
if (require.main === module) {
  migrateToNewSchema()
    .then(() => {
      console.log('\n🎉 All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = migrateToNewSchema;
