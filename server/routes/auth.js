const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// JWT middleware for protected routes
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  console.log('Auth middleware - Header:', authHeader ? 'Present' : 'Missing');
  console.log('Auth middleware - Token:', token ? 'Present' : 'Missing');

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Auth middleware - Decoded:', decoded);
    
    // Add timeout and retry for database query
    const user = await Promise.race([
      User.findById(decoded.userId).select('-password').lean(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 15000)
      )
    ]);
    
    console.log('Auth middleware - User found:', user ? {
      id: user._id,
      email: user.email,
      role: user.role
    } : 'No user found');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    
    // Specific error handling for different types of errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    } else if (error.message === 'Database query timeout') {
      return res.status(503).json({ error: 'Database temporarily unavailable' });
    } else {
      return res.status(403).json({ error: 'Authentication failed' });
    }
  }
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Register route
router.post('/register', async (req, res) => {
  const { username, email, password, role, school } = req.body;
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userData = {
      username,
      email,
      password: hashedPassword, // Store hashed password
      role: role || 'user', // Use provided role or default to 'user'
      school: school || '',
      isActive: true,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    const user = await User.create(userData);
    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        school: user.school
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT token
    const token = generateToken(user._id);
    
    // Return user data and token
    res.json({ 
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName, // Uses virtual from User model
        role: user.role,
        school: user.school,
        assignedCourses: user.assignedCourses || [],
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get user profile
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile/:id', async (req, res) => {
  try {
    const { username, email, school } = req.body;
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (school) updateData.school = school;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true, context: 'query' }
    ).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users); // Return array directly
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create admin user (development only)
router.post('/create-admin', async (req, res) => {
  try {
    const { username, email, password, school } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const adminData = {
      username,
      email,
      password: hashedPassword,
      school: school || '',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    const admin = await User.create(adminData);
    res.status(201).json({ 
      message: 'Admin user created successfully',
      user: {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        school: admin.school,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Server error during admin creation' });
  }
});

// Update user role (admin only)
router.put('/users/:id/role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['admin', 'user', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User role updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user (admin only)
router.patch('/users/:id', authenticateToken, async (req, res) => {
  try {
    const updateData = req.body;
    
    // Remove sensitive fields that shouldn't be updated this way
    delete updateData.password;
    delete updateData._id;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Protected route to verify token and get user data
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    // Get fresh user data with populated courses
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        school: user.school,
        assignedCourses: user.assignedCourses || [],
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Get current user's profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      school: user.school,
      assignedCourses: user.assignedCourses || [],
      profileImage: user.profileImage,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Upload profile image
router.post('/upload-profile-image', authenticateToken, async (req, res) => {
  try {
    const multer = require('multer');
    const { GridFSBucket } = require('mongodb');
    const dbConfig = require('../config/database');
    
    // Configure multer for memory storage
    const storage = multer.memoryStorage();
    const upload = multer({
      storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'), false);
        }
      }
    }).single('profileImage');
    
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const db = dbConfig.getDatabase();
      const bucket = new GridFSBucket(db, { bucketName: 'profile-images' });
      
      // Delete old profile image if exists
      const user = await User.findById(req.user._id);
      if (user.profileImage) {
        try {
          await bucket.delete(user.profileImage);
        } catch (deleteErr) {
          console.error('Error deleting old profile image:', deleteErr);
        }
      }
      
      // Upload new image
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: req.user._id,
          uploadedAt: new Date()
        }
      });
      
      uploadStream.end(req.file.buffer);
      
      uploadStream.on('finish', async () => {
        // Update user with new profile image ID
        user.profileImage = uploadStream.id;
        await user.save();
        
        res.json({
          message: 'Profile image uploaded successfully',
          profileImage: uploadStream.id
        });
      });
      
      uploadStream.on('error', (error) => {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
      });
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get profile image
router.get('/profile-image/:userId', async (req, res) => {
  try {
    const { GridFSBucket } = require('mongodb');
    const dbConfig = require('../config/database');
    const { ObjectId } = require('mongodb');
    
    const user = await User.findById(req.params.userId);
    
    if (!user || !user.profileImage) {
      return res.status(404).json({ error: 'Profile image not found' });
    }
    
    const db = dbConfig.getDatabase();
    const bucket = new GridFSBucket(db, { bucketName: 'profile-images' });
    
    const downloadStream = bucket.openDownloadStream(new ObjectId(user.profileImage));
    
    downloadStream.on('error', (error) => {
      console.error('Download error:', error);
      res.status(404).json({ error: 'Profile image not found' });
    });
    
    res.setHeader('Content-Type', 'image/jpeg');
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Get profile image error:', error);
    res.status(500).json({ error: 'Failed to retrieve image' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;