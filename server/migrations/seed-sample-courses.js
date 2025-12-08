const mongoose = require('mongoose');
const Course = require('../models/Course');
const User = require('../models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://IamSamk:2gRB01wOhNhKIqvP@iqac.mlrfsfs.mongodb.net/IQAC';

async function seedSampleCourses() {
  try {
    console.log('🌱 Seeding sample courses...\n');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find admin user to set as creator
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️  No admin user found. Creating courses without creator reference.\n');
    }

    // Sample courses for SoCSE (School of Computer Science and Engineering)
    const sampleCourses = [
      {
        courseCode: 'CS101',
        courseName: 'Data Structures and Computer Applications',
        year: '2024',
        semester: 3,
        school: 'SoCSE',
        programme: 'BTech',
        credits: 4,
        courseMembers: [],
        createdBy: adminUser?._id
      },
      {
        courseCode: 'CS102',
        courseName: 'Database Management Systems',
        year: '2024',
        semester: 4,
        school: 'SoCSE',
        programme: 'BTech',
        credits: 4,
        courseMembers: [],
        createdBy: adminUser?._id
      },
      {
        courseCode: 'CS201',
        courseName: 'Advanced Algorithms',
        year: '2024',
        semester: 5,
        school: 'SoCSE',
        programme: 'BTech',
        credits: 3,
        courseMembers: [],
        createdBy: adminUser?._id
      },
      {
        courseCode: 'CS301',
        courseName: 'Machine Learning',
        year: '2025',
        semester: 6,
        school: 'SoCSE',
        programme: 'BTech',
        credits: 4,
        courseMembers: [],
        createdBy: adminUser?._id
      },
      {
        courseCode: 'BCA101',
        courseName: 'Programming in C',
        year: '2024',
        semester: 1,
        school: 'SoCSE',
        programme: 'BCA',
        credits: 3,
        courseMembers: [],
        createdBy: adminUser?._id
      }
    ];

    // Create courses
    let createdCount = 0;
    for (const courseData of sampleCourses) {
      try {
        const course = await Course.create(courseData);
        console.log(`   ✅ Created: ${course.courseCode} - ${course.courseName}`);
        createdCount++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`   ℹ️  Already exists: ${courseData.courseCode}`);
        } else {
          console.log(`   ⚠️  Error creating ${courseData.courseCode}: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Created ${createdCount} sample courses\n`);

    // Verify
    const totalCourses = await Course.countDocuments();
    console.log(`📊 Total courses in database: ${totalCourses}\n`);

    const courses = await Course.find().select('courseCode courseName school programme year semester');
    console.log('📋 Available Courses:');
    console.log('═══════════════════════════════════════════════════════');
    courses.forEach(c => {
      console.log(`   ${c.courseId} | ${c.courseName} | ${c.school} ${c.programme} | Sem ${c.semester}`);
    });
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run seeding
if (require.main === module) {
  seedSampleCourses()
    .then(() => {
      console.log('\n🎉 Sample courses created successfully!');
      console.log('💡 Next steps:');
      console.log('   1. Use the API to add members to courses');
      console.log('   2. Create assignments from templates');
      console.log('   3. Test the complete workflow!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = seedSampleCourses;
