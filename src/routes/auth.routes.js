const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

/**
 * POST /api/v1/auth/register
 * Register a new user account
 */
router.post('/register', (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName } = req.body;

    // Controller logic:
    // 1. Validate required fields
    // 2. Check if email already exists
    // 3. Hash password using bcrypt
    // 4. Create user in database
    // 5. Generate JWT token
    // 6. Return user and token

    const user = {
      id: 'user_' + Date.now(),
      email,
      firstName,
      lastName,
      companyName,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: error.message
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    // Controller logic:
    // 1. Validate email and password provided
    // 2. Find user by email
    // 3. Compare password with hashed password in database
    // 4. Generate JWT token
    // 5. Return user and token

    const user = {
      id: 'user_123',
      email: email || 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      companyName: 'ABC Corp',
      role: 'supervisor',
      createdAt: '2024-01-15T10:30:00Z'
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Invalid credentials'
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user profile
 */
router.get('/me', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Get user ID from req.user (set by verifyToken middleware)
    // 2. Fetch user details from database
    // 3. Return user profile

    const user = {
      id: req.user.id,
      email: req.user.email,
      firstName: 'John',
      lastName: 'Doe',
      companyName: 'ABC Corp',
      role: req.user.role,
      avatar: 'https://ui-avatars.com/api/?name=John+Doe',
      createdAt: '2024-01-15T10:30:00Z',
      lastLogin: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/auth/profile
 * Update user profile
 */
router.put('/profile', verifyToken, (req, res) => {
  try {
    const { firstName, lastName, avatar, phone } = req.body;

    // Controller logic:
    // 1. Validate input fields
    // 2. Update user in database
    // 3. Return updated user

    const updatedUser = {
      id: req.user.id,
      email: req.user.email,
      firstName: firstName || 'John',
      lastName: lastName || 'Doe',
      companyName: 'ABC Corp',
      phone: phone || '+1-555-0123',
      avatar: avatar || 'https://ui-avatars.com/api/?name=John+Doe',
      role: req.user.role,
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: error.message
    });
  }
});

module.exports = router;
