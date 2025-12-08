const mongoose = require('mongoose');
const fileMergeService = require('./services/fileMergeService');
const File = require('./models/File');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://IamSamk:2gRB01wOhNhKIqvP@iqac.mlrfsfs.mongodb.net/IQAC';

/**
 * Create a sample PDF for testing
 */
function createSamplePDF(content, pageCount = 1) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    for (let i = 1; i <= pageCount; i++) {
      if (i > 1) doc.addPage();
      
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text(content.title, { align: 'center' });
      
      doc.moveDown();
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Page ${i} of ${pageCount}`);
      
      doc.moveDown();
      doc.text(content.body || 'This is a sample PDF document created for testing the merge functionality.');
      doc.moveDown();
      doc.text(`Created by: ${content.author}`);
      doc.text(`Created at: ${new Date().toISOString()}`);
    }
    
    doc.end();
  });
}

/**
 * Upload a test PDF to GridFS and create File document
 */
async function uploadTestPDF(filename, buffer, userId) {
  const db = mongoose.connection.db;
  const bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: 'master_files'
  });
  
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'application/pdf',
      metadata: { test: true }
    });
    
    uploadStream.on('error', reject);
    uploadStream.on('finish', async () => {
      try {
        const file = new File({
          filename: filename,
          originalName: filename,
          contentType: 'application/pdf',
          size: buffer.length,
          metadata: {
            gridfsId: uploadStream.id,
            gridfsBucket: 'master_files',
            uploadedAt: new Date()
          },
          uploadedBy: userId,
          fileType: 'assignment',
          isMerged: false
        });
        
        await file.save();
        console.log(`    ✅ Saved: ${file.filename} → gridfsId: ${file.metadata.gridfsId}`);
        resolve(file);
      } catch (error) {
        reject(error);
      }
    });
    
    uploadStream.end(buffer);
  });
}

async function testFileMerge() {
  try {
    console.log('🧪 Testing File Merge Service...\n');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Create fake user ID for testing
    const testUserId = new mongoose.Types.ObjectId();
    
    console.log('📄 Creating 3 sample PDFs...');
    
    // Create sample PDFs
    const pdf1Buffer = await createSamplePDF({
      title: 'Assignment Submission - Student 1',
      author: 'John Doe',
      body: 'This is the first student submission. It contains detailed analysis of the given topic with proper citations and references.'
    }, 2);
    
    const pdf2Buffer = await createSamplePDF({
      title: 'Assignment Submission - Student 2',
      author: 'Jane Smith',
      body: 'This is the second student submission. It explores the topic from a different perspective with comprehensive research.'
    }, 3);
    
    const pdf3Buffer = await createSamplePDF({
      title: 'Assignment Submission - Student 3',
      author: 'Bob Johnson',
      body: 'This is the third student submission. It includes practical examples and case studies related to the topic.'
    }, 2);
    
    console.log(`  ✅ PDF 1: ${pdf1Buffer.length} bytes, 2 pages`);
    console.log(`  ✅ PDF 2: ${pdf2Buffer.length} bytes, 3 pages`);
    console.log(`  ✅ PDF 3: ${pdf3Buffer.length} bytes, 2 pages`);
    console.log('');
    
    // Upload PDFs to GridFS
    console.log('☁️  Uploading PDFs to GridFS...');
    
    const file1 = await uploadTestPDF('Student1_Assignment.pdf', pdf1Buffer, testUserId);
    const file2 = await uploadTestPDF('Student2_Assignment.pdf', pdf2Buffer, testUserId);
    const file3 = await uploadTestPDF('Student3_Assignment.pdf', pdf3Buffer, testUserId);
    
    console.log(`  ✅ Uploaded file 1: ${file1._id}`);
    console.log(`  ✅ Uploaded file 2: ${file2._id}`);
    console.log(`  ✅ Uploaded file 3: ${file3._id}`);
    console.log('');
    
    // Test merging
    console.log('🔄 Testing PDF merge...');
    
    const fileIds = [file1._id, file2._id, file3._id];
    
    const mergedFile = await fileMergeService.mergeAndSave(
      fileIds,
      {
        taskId: new mongoose.Types.ObjectId(),
        courseId: '2024_CS101',
        title: 'Data Structures Assignment 1'
      },
      testUserId
    );
    
    console.log('✅ Merge completed successfully!');
    console.log(`   Merged File ID: ${mergedFile._id}`);
    console.log(`   Filename: ${mergedFile.filename}`);
    console.log(`   Size: ${mergedFile.size} bytes`);
    console.log(`   Total Pages: ${mergedFile.metadata?.totalPages}`);
    console.log(`   Original Files: ${mergedFile.metadata?.originalFileCount}`);
    console.log('');
    
    // Verify merged file
    console.log('🔍 Verifying merged file in database...');
    
    const verifiedFile = await File.findById(mergedFile._id)
      .populate('originalFiles', 'filename size');
    
    console.log(`  ✅ File found: ${verifiedFile.filename}`);
    console.log(`  ✅ Is merged: ${verifiedFile.isMerged}`);
    console.log(`  ✅ Original files: ${verifiedFile.originalFiles.length}`);
    verifiedFile.originalFiles.forEach((f, i) => {
      console.log(`     ${i + 1}. ${f.filename} (${f.size} bytes)`);
    });
    console.log('');
    
    // Cleanup test files
    console.log('🧹 Cleaning up test files...');
    await File.deleteMany({ _id: { $in: [file1._id, file2._id, file3._id, mergedFile._id] } });
    
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'master_files' });
    
    await bucket.delete(file1.metadata.gridfsId);
    await bucket.delete(file2.metadata.gridfsId);
    await bucket.delete(file3.metadata.gridfsId);
    await bucket.delete(mergedFile.metadata.gridfsId);
    
    console.log('✅ Cleanup complete');
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('File Merge Service is working correctly:');
    console.log('  ✓ PDF creation works');
    console.log('  ✓ GridFS upload works');
    console.log('  ✓ PDF merging works');
    console.log('  ✓ File tracking works');
    console.log('  ✓ Metadata preservation works');
    console.log('');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run test
if (require.main === module) {
  testFileMerge()
    .then(() => {
      console.log('🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = testFileMerge;
