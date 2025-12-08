const { PDFDocument } = require('pdf-lib');
const mongoose = require('mongoose');

/**
 * Service for merging multiple PDF files into a single PDF
 * Used by reviewers to combine initiator submissions
 */
class FileMergeService {
  
  /**
   * Merge multiple PDF files from GridFS into a single PDF
   * @param {Array<ObjectId>} fileIds - Array of File model IDs to merge
   * @param {Object} metadata - Metadata for the merged file (taskId, userId, etc.)
   * @returns {Object} - { buffer: Buffer, metadata: Object }
   */
  async mergePDFFiles(fileIds, metadata = {}) {
    try {
      if (!fileIds || fileIds.length === 0) {
        throw new Error('No files provided for merging');
      }

      console.log(`📋 Starting PDF merge for ${fileIds.length} files...`);

      const File = require('../models/File');
      
      // Fetch all files from database
      const files = await File.find({ _id: { $in: fileIds } }).sort({ createdAt: 1 });
      
      if (files.length === 0) {
        throw new Error('No files found with provided IDs');
      }

      if (files.length !== fileIds.length) {
        console.warn(`⚠️  Only found ${files.length} out of ${fileIds.length} requested files`);
      }

      // Verify all files are PDFs
      const nonPDFs = files.filter(f => !f.filename?.toLowerCase().endsWith('.pdf') && f.contentType !== 'application/pdf');
      if (nonPDFs.length > 0) {
        throw new Error(`Cannot merge non-PDF files: ${nonPDFs.map(f => f.filename).join(', ')}`);
      }

      // Download all PDFs from GridFS
      const pdfBuffers = await Promise.all(
        files.map(async (file) => {
          try {
            console.log(`  Downloading: ${file.filename}, GridFS ID: ${file.metadata?.gridfsId}`);
            
            if (!file.metadata?.gridfsId) {
              throw new Error(`File ${file.filename} has no gridfsId in metadata`);
            }
            
            const buffer = await this.downloadFromGridFS(file.metadata.gridfsId);
            return { buffer, filename: file.filename };
          } catch (error) {
            console.error(`❌ Failed to download file ${file.filename}:`, error);
            throw new Error(`Failed to download file: ${file.filename}`);
          }
        })
      );

      console.log(`✅ Downloaded ${pdfBuffers.length} PDF files`);

      // Create new merged PDF document
      const mergedPdf = await PDFDocument.create();
      
      // Track total pages for logging
      let totalPages = 0;

      // Merge each PDF
      for (const { buffer, filename } of pdfBuffers) {
        try {
          const pdf = await PDFDocument.load(buffer);
          const pageCount = pdf.getPageCount();
          
          console.log(`  📄 ${filename}: ${pageCount} pages`);
          
          // Copy all pages from this PDF
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
          });
          
          totalPages += pageCount;
        } catch (error) {
          console.error(`❌ Failed to merge ${filename}:`, error);
          throw new Error(`Failed to merge PDF: ${filename}`);
        }
      }

      console.log(`✅ Merged ${pdfBuffers.length} PDFs with total ${totalPages} pages`);

      // Generate final PDF buffer
      const mergedPdfBuffer = await mergedPdf.save();

      return {
        buffer: Buffer.from(mergedPdfBuffer),
        metadata: {
          ...metadata,
          originalFileCount: files.length,
          totalPages: totalPages,
          originalFiles: files.map(f => ({
            id: f._id,
            filename: f.filename,
            uploadedBy: f.uploadedBy
          })),
          mergedAt: new Date()
        }
      };

    } catch (error) {
      console.error('❌ PDF merge error:', error);
      throw error;
    }
  }

  /**
   * Download a file from GridFS
   * @param {ObjectId} gridFSFileId - The GridFS file ID
   * @returns {Promise<Buffer>} - File buffer
   */
  async downloadFromGridFS(gridFSFileId) {
    return new Promise((resolve, reject) => {
      try {
        const db = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(db, {
          bucketName: 'master_files'
        });

        const chunks = [];
        const downloadStream = bucket.openDownloadStream(gridFSFileId);

        downloadStream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        downloadStream.on('error', (error) => {
          reject(error);
        });

        downloadStream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Upload merged PDF to GridFS
   * @param {Buffer} buffer - PDF buffer
   * @param {Object} metadata - File metadata
   * @returns {Promise<ObjectId>} - GridFS file ID
   */
  async uploadToGridFS(buffer, metadata) {
    return new Promise((resolve, reject) => {
      try {
        const db = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(db, {
          bucketName: 'master_files'
        });

        const uploadStream = bucket.openUploadStream(metadata.filename, {
          contentType: 'application/pdf',
          metadata: metadata
        });

        uploadStream.on('error', reject);
        uploadStream.on('finish', () => {
          resolve(uploadStream.id);
        });

        uploadStream.end(buffer);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Complete workflow: Merge PDFs and save to database
   * @param {Array<ObjectId>} fileIds - Files to merge
   * @param {Object} taskInfo - Task information
   * @param {ObjectId} userId - User performing the merge
   * @returns {Promise<Object>} - Created File document
   */
  async mergeAndSave(fileIds, taskInfo, userId) {
    try {
      const File = require('../models/File');
      
      // Generate filename for merged PDF
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `${taskInfo.courseId || 'MERGED'}_${taskInfo.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Assignment'}_${timestamp}_merged.pdf`;

      console.log(`🔄 Merging files for task: ${taskInfo.title}`);

      // Merge the PDFs
      const { buffer, metadata } = await this.mergePDFFiles(fileIds, {
        taskId: taskInfo.taskId,
        courseId: taskInfo.courseId,
        mergedBy: userId,
        isMerged: true
      });

      // Upload to GridFS
      const gridFSFileId = await this.uploadToGridFS(buffer, {
        ...metadata,
        filename: filename
      });

      console.log(`✅ Uploaded merged PDF to GridFS: ${gridFSFileId}`);

      // Create File document
      const mergedFile = new File({
        filename: filename,
        originalName: filename,
        contentType: 'application/pdf',
        size: buffer.length,
        metadata: {
          gridfsId: gridFSFileId,
          gridfsBucket: 'master_files',
          originalFileCount: metadata.originalFileCount,
          totalPages: metadata.totalPages,
          mergedAt: metadata.mergedAt,
          uploadedAt: new Date()
        },
        uploadedBy: userId,
        fileType: 'assignment',
        courseRef: taskInfo.courseRef,
        taskRef: taskInfo.taskId,
        isMerged: true,
        originalFiles: metadata.originalFiles.map(f => f.id),
        mergedBy: userId
      });

      await mergedFile.save();

      console.log(`✅ Saved merged file to database: ${mergedFile._id}`);

      return mergedFile;

    } catch (error) {
      console.error('❌ Merge and save error:', error);
      throw error;
    }
  }
}

module.exports = new FileMergeService();
