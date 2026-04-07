const express = require('express');
const router = express.Router();
const { verifyToken, requireRole, isOwnerOrAdmin } = require('../middleware/auth');

/**
 * GET /api/v1/users
 * List all users in the workspace
 */
router.get('/', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    const { page = 1, limit = 20, role, status } = req.query;

    // Controller logic:
    // 1. Fetch users with pagination
    // 2. Apply role filter if provided
    // 3. Apply status filter if provided
    // 4. Return user list with metadata

    const users = [
      {
        id: 'user_123',
        email: 'joao@deliverymilionario.com.br',
        firstName: 'João',
        lastName: 'Santos',
        role: 'supervisor',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Joao+Santos',
        phone: '+55 11 98765-4321',
        lastLogin: '2024-03-05T16:45:00Z',
        createdAt: '2024-01-15T10:30:00Z',
        department: 'Sales',
        permissions: ['manage_leads', 'manage_agents', 'view_reports'],
        activeSessions: 1
      },
      {
        id: 'user_124',
        email: 'maria@deliverymilionario.com.br',
        firstName: 'Maria',
        lastName: 'Silva',
        role: 'agent',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Maria+Silva',
        phone: '+55 21 99876-5432',
        lastLogin: '2024-03-05T15:30:00Z',
        createdAt: '2024-02-01T14:00:00Z',
        department: 'Sales',
        permissions: ['chat_with_leads', 'view_own_reports'],
        activeSessions: 1
      }
    ];

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 8,
        totalPages: Math.ceil(8 / parseInt(limit))
      }
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
 * GET /api/v1/users/:userId
 * Get user profile details
 */
router.get('/:userId', verifyToken, isOwnerOrAdmin, (req, res) => {
  try {
    // Controller logic:
    // 1. Fetch user by ID
    // 2. Check authorization
    // 3. Return user details with permissions

    const user = {
      id: req.params.userId,
      email: 'joao@deliverymilionario.com.br',
      firstName: 'João',
      lastName: 'Santos',
      displayName: 'João Santos',
      role: 'supervisor',
      status: 'active',
      avatar: 'https://ui-avatars.com/api/?name=Joao+Santos',
      phone: '+55 11 98765-4321',
      lastLogin: '2024-03-05T16:45:00Z',
      createdAt: '2024-01-15T10:30:00Z',
      department: 'Sales',
      location: 'São Paulo, Brazil',
      timezone: 'America/Sao_Paulo',
      permissions: ['manage_leads', 'manage_agents', 'view_reports', 'manage_campaigns'],
      activeSessions: 1,
      twoFactorEnabled: true,
      preferences: {
        emailNotifications: true,
        pushNotifications: true,
        soundAlerts: true
      }
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
 * POST /api/v1/users
 * Create a new user (admin/supervisor only)
 */
router.post('/', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const { email, firstName, lastName, role = 'agent', phone, department } = req.body;

    // Controller logic:
    // 1. Validate email is unique
    // 2. Validate email format
    // 3. Create user in database
    // 4. Send welcome email with temporary password
    // 5. Log creation activity
    // 6. Return created user

    const newUser = {
      id: 'user_' + Date.now(),
      email: email,
      firstName: firstName,
      lastName: lastName,
      displayName: `${firstName} ${lastName}`,
      role: role,
      status: 'active',
      avatar: `https://ui-avatars.com/api/?name=${firstName}+${lastName}`,
      phone: phone || '',
      department: department || '',
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
      permissions: role === 'agent' ? ['chat_with_leads', 'view_own_reports'] : ['manage_leads', 'manage_agents']
    };

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'User created successfully',
      data: newUser
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
 * PUT /api/v1/users/:userId
 * Update user information
 */
router.put('/:userId', verifyToken, isOwnerOrAdmin, (req, res) => {
  try {
    const { firstName, lastName, phone, department, timezone, avatar } = req.body;

    // Controller logic:
    // 1. Validate user exists
    // 2. Check authorization
    // 3. Update allowed fields
    // 4. Return updated user

    const updatedUser = {
      id: req.params.userId,
      firstName: firstName || 'João',
      lastName: lastName || 'Santos',
      phone: phone || '+55 11 98765-4321',
      department: department || 'Sales',
      timezone: timezone || 'America/Sao_Paulo',
      avatar: avatar || 'https://ui-avatars.com/api/?name=Joao+Santos',
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'User updated successfully',
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

/**
 * PATCH /api/v1/users/:userId/role
 * Update user role (admin only)
 */
router.patch('/:userId/role', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const { role } = req.body;

    // Controller logic:
    // 1. Validate role value
    // 2. Check user exists
    // 3. Update user role
    // 4. Update permissions based on role
    // 5. Log role change
    // 6. Return updated user

    const updatedUser = {
      id: req.params.userId,
      role: role,
      previousRole: 'agent',
      permissions: role === 'supervisor' ? ['manage_leads', 'manage_agents', 'view_reports'] : ['chat_with_leads'],
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `User role updated to ${role}`,
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

/**
 * PATCH /api/v1/users/:userId/status
 * Update user status (activate/deactivate)
 */
router.patch('/:userId/status', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    const { status } = req.body;

    // Controller logic:
    // 1. Check user exists
    // 2. Update status
    // 3. If deactivating, close active sessions
    // 4. Log status change
    // 5. Return updated user

    const updatedUser = {
      id: req.params.userId,
      status: status,
      previousStatus: 'active',
      deactivatedAt: status === 'inactive' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `User status changed to ${status}`,
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

/**
 * PATCH /api/v1/users/:userId/permissions
 * Update user permissions
 */
router.patch('/:userId/permissions', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const { permissions } = req.body;

    // Controller logic:
    // 1. Validate permissions
    // 2. Update user permissions
    // 3. Log permission change
    // 4. Return updated user

    const updatedUser = {
      id: req.params.userId,
      permissions: permissions,
      previousPermissions: ['manage_leads', 'view_reports'],
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'User permissions updated successfully',
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

/**
 * DELETE /api/v1/users/:userId
 * Delete/deactivate user
 */
router.delete('/:userId', verifyToken, requireRole('admin'), (req, res) => {
  try {
    // Controller logic:
    // 1. Check user exists
    // 2. Check user is not the only admin
    // 3. Close all active sessions
    // 4. Archive user data
    // 5. Log deletion

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'User deleted successfully',
      data: { id: req.params.userId, deleted: true }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message
    });
  }
});

module.exports = router;
