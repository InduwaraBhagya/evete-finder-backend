const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email, and password are required',
        status: 400,
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: 'Email already registered',
        status: 409,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
    });

    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      message: 'User registered successfully',
      status: 201,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      message: 'Registration failed',
      status: 500,
      error: error.message,
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        status: 400,
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
        status: 401,
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid email or password',
        status: 401,
      });
    }

    const token = generateToken(user._id, user.role);
    console.log(res.body);
    res.status(200).json({
      message: 'Login successful',
      status: 200,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profileImage: user.profileImage,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      status: 500,
      error: error.message,
    });
  }
});

// Get Current User
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'User fetched successfully',
      status: 200,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching user',
      status: 500,
      error: error.message,
    });
  }
});

// Update Profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, bio, profileImage } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, bio, profileImage },
      { new: true }
    );

    res.status(200).json({
      message: 'Profile updated successfully',
      status: 200,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating profile',
      status: 500,
      error: error.message,
    });
  }
});

// Logout 
router.post('/logout', authMiddleware, (req, res) => {
  res.status(200).json({
    message: 'Logged out successfully',
    status: 200,
  });
});

module.exports = router;
