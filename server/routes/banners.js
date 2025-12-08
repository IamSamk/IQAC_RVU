const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const { getDb } = require('../config/database');
const { ObjectId } = require('mongodb');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// JWT middleware (assuming it's defined in your auth routes)
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const User = require('../models/User');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.use(authenticateToken);

// Upload banner PDF
router.post('/upload', requireAdmin, upload.single('banner'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = getDb();
    const bucket = new GridFSBucket(db, { bucketName: 'banners' });

    // Create upload stream
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      contentType: 'application/pdf',
      metadata: {
        uploadedBy: req.user._id,
        uploadedAt: new Date(),
        originalName: req.file.originalname,
        isActive: true
      }
    });

    // Write file buffer to stream
    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', () => {
      res.status(201).json({
        message: 'Banner uploaded successfully',
        fileId: uploadStream.id,
        filename: req.file.originalname
      });
    });

    uploadStream.on('error', (error) => {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload banner' });
    });

  } catch (error) {
    console.error('Banner upload error:', error);
    res.status(500).json({ error: 'Failed to upload banner' });
  }
});

// List all banners
router.get('/list', async (req, res) => {
  try {
    const db = getDb();
    
    if (!db) {
      console.error('❌ Database not connected');
      return res.status(503).json({ error: 'Database not connected', banners: [] });
    }
    
    const bucket = new GridFSBucket(db, { bucketName: 'banners' });

    const files = await bucket.find({
      'metadata.isActive': true
    }).toArray();

    const banners = files.map(file => ({
      _id: file._id,
      filename: file.filename,
      uploadDate: file.uploadDate,
      length: file.length,
      uploadedBy: file.metadata?.uploadedBy,
      originalName: file.metadata?.originalName
    }));

    res.json({ banners });
  } catch (error) {
    console.error('❌ List banners error:', error);
    console.error('❌ Error stack:', error.stack);
    // Return empty array instead of failing completely
    res.json({ banners: [] });
  }
});

// Get specific banner PDF
router.get('/:fileId', async (req, res) => {
  try {
    const db = getDb();
    const bucket = new GridFSBucket(db, { bucketName: 'banners' });

    const fileId = new ObjectId(req.params.fileId);

    // Check if file exists
    const files = await bucket.find({ _id: fileId }).toArray();
    if (files.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const file = files[0];

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);

    // Stream file to response
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Failed to download banner' });
    });

  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({ error: 'Failed to retrieve banner' });
  }
});

// Delete banner
router.delete('/:fileId', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const bucket = new GridFSBucket(db, { bucketName: 'banners' });

    const fileId = new ObjectId(req.params.fileId);

    // Check if file exists
    const files = await bucket.find({ _id: fileId }).toArray();
    if (files.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    // Delete file
    await bucket.delete(fileId);

    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

module.exports = router;
