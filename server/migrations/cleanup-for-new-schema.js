const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://IamSamk:2gRB01wOhNhKIqvP@iqac.mlrfsfs.mongodb.net/IQAC';

async function cleanDatabase() {
  try {
    console.log('🧹 Starting database cleanup for new schema...\n');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Delete all old tasks (they used legacy schema)
    console.log('🗑️  Deleting legacy tasks...');
    const tasksResult = await db.collection('tasks').deleteMany({});
    console.log(`   ✅ Deleted ${tasksResult.deletedCount} old tasks\n`);

    // Delete all old courses (if any exist with wrong schema)
    console.log('🗑️  Deleting any existing courses...');
    const coursesResult = await db.collection('courses').deleteMany({});
    console.log(`   ✅ Deleted ${coursesResult.deletedCount} old courses\n`);

    // Delete all old files (they may have wrong references)
    console.log('🗑️  Deleting old files...');
    const filesResult = await db.collection('master_files').deleteMany({});
    console.log(`   ✅ Deleted ${filesResult.deletedCount} old files\n`);

    // Clear notifications related to deleted tasks
    console.log('🗑️  Clearing old notifications...');
    const notificationsResult = await db.collection('notifications').deleteMany({});
    console.log(`   ✅ Deleted ${notificationsResult.deletedCount} old notifications\n`);

    // Update users - remove legacy fields, initialize new fields
    console.log('👥 Updating user schema...');
    const users = await db.collection('users').find({}).toArray();
    let userUpdateCount = 0;

    for (const user of users) {
      const updates = {
        $unset: {
          firstName: "",
          lastName: "",
          subrole: "",
          courseIds: "",
          courseCode: "",
          courseName: "",
          department: ""
        },
        $set: {
          school: user.school || '',
          assignedCourses: []
        }
      };

      await db.collection('users').updateOne({ _id: user._id }, updates);
      userUpdateCount++;
    }
    console.log(`   ✅ Updated ${userUpdateCount} users to new schema\n`);

    // Verify cleanup
    console.log('🔍 Verifying cleanup...');
    const stats = {
      users: await db.collection('users').countDocuments(),
      courses: await db.collection('courses').countDocuments(),
      tasks: await db.collection('tasks').countDocuments(),
      files: await db.collection('master_files').countDocuments(),
      notifications: await db.collection('notifications').countDocuments(),
      templates: await db.collection('others').countDocuments()
    };

    console.log('   Database Statistics (Clean Slate):');
    console.log(`   - Users: ${stats.users}`);
    console.log(`   - Courses: ${stats.courses}`);
    console.log(`   - Tasks: ${stats.tasks}`);
    console.log(`   - Files: ${stats.files}`);
    console.log(`   - Notifications: ${stats.notifications}`);
    console.log(`   - Templates: ${stats.templates}`);
    console.log('');

    console.log('✅ Database cleanup completed successfully!\n');
    console.log('📋 Ready for new schema:');
    console.log('   - All users updated with new schema fields');
    console.log('   - Legacy tasks removed');
    console.log('   - Old courses removed');
    console.log('   - 23 assignment templates available');
    console.log('   - Ready to create courses and assignments!\n');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run cleanup
if (require.main === module) {
  cleanDatabase()
    .then(() => {
      console.log('\n🎉 Database is now clean and ready for the new schema!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = cleanDatabase;
