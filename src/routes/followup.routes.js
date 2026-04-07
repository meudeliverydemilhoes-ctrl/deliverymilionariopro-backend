const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

/**
 * GET /api/v1/followup
 * Get list of follow-up tasks
 */
router.get('/', verifyToken, (req, res) => {
  try {
    const { page = 1, limit = 20, status, assignedTo, dueDate } = req.query;

    // Controller logic:
    // 1. Build query with filters (status, assignedTo, dueDate)
    // 2. Apply authorization checks
    // 3. Paginate results
    // 4. Order by dueDate (ascending - soonest first)
    // 5. Return follow-up tasks

    const followups = [
      {
        id: 'followup_001',
        leadId: 'lead_001',
        leadName: 'Carlos Silva',
        leadPhone: '+55 11 98765-4321',
        description: 'Send proposal',
        dueDate: '2024-03-08T15:00:00Z',
        status: 'pending',
        priority: 'high',
        assignedTo: 'user_123',
        assignedToName: 'João Santos',
        type: 'send_message', // send_message, send_email, call, meeting
        notes: 'Follow up on pricing discussion',
        reminderSent: false,
        createdAt: '2024-03-05T10:00:00Z',
        updatedAt: '2024-03-05T10:00:00Z'
      },
      {
        id: 'followup_002',
        leadId: 'lead_002',
        leadName: 'Ana Costa',
        leadPhone: '+55 21 99876-5432',
        description: 'Confirm meeting time',
        dueDate: '2024-03-10T09:00:00Z',
        status: 'pending',
        priority: 'medium',
        assignedTo: 'user_124',
        assignedToName: 'Maria Silva',
        type: 'call',
        notes: 'Confirm meeting for demo',
        reminderSent: true,
        createdAt: '2024-03-04T14:00:00Z',
        updatedAt: '2024-03-04T14:00:00Z'
      }
    ];

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: followups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 12,
        totalPages: Math.ceil(12 / parseInt(limit))
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
 * GET /api/v1/followup/:id
 * Get follow-up task details
 */
router.get('/:id', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Fetch follow-up by ID
    // 2. Include all details
    // 3. Return task

    const followup = {
      id: req.params.id,
      leadId: 'lead_001',
      leadName: 'Carlos Silva',
      leadPhone: '+55 11 98765-4321',
      leadEmail: 'carlos@example.com',
      description: 'Send proposal',
      dueDate: '2024-03-08T15:00:00Z',
      status: 'pending',
      priority: 'high',
      assignedTo: 'user_123',
      assignedToName: 'João Santos',
      type: 'send_message',
      notes: 'Follow up on pricing discussion',
      templateId: 'tmpl_proposal',
      customFields: {
        proposalAmount: 'R$ 5,000',
        paymentTerms: '30 dias'
      },
      reminderSent: false,
      reminderTime: '2024-03-08T14:00:00Z',
      completedAt: null,
      completedBy: null,
      createdAt: '2024-03-05T10:00:00Z',
      updatedAt: '2024-03-05T10:00:00Z'
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: followup
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
 * POST /api/v1/followup
 * Create a follow-up task
 */
router.post('/', verifyToken, (req, res) => {
  try {
    const { leadId, description, dueDate, priority = 'medium', type = 'send_message', notes } = req.body;

    // Controller logic:
    // 1. Validate required fields
    // 2. Check lead exists
    // 3. Create follow-up task
    // 4. Set default assignee to current user
    // 5. Return created task

    const newFollowup = {
      id: 'followup_' + Date.now(),
      leadId: leadId,
      description: description,
      dueDate: dueDate,
      status: 'pending',
      priority: priority,
      type: type,
      notes: notes || '',
      assignedTo: req.user.id,
      assignedToName: 'John Doe',
      reminderSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Follow-up task created successfully',
      data: newFollowup
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
 * PUT /api/v1/followup/:id
 * Update follow-up task
 */
router.put('/:id', verifyToken, (req, res) => {
  try {
    const { description, dueDate, priority, notes } = req.body;

    // Controller logic:
    // 1. Fetch follow-up by ID
    // 2. Check authorization
    // 3. Update allowed fields
    // 4. Return updated task

    const updatedFollowup = {
      id: req.params.id,
      description: description || 'Send proposal',
      dueDate: dueDate || '2024-03-08T15:00:00Z',
      priority: priority || 'medium',
      notes: notes || '',
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Follow-up task updated successfully',
      data: updatedFollowup
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
 * PATCH /api/v1/followup/:id/complete
 * Mark follow-up task as completed
 */
router.patch('/:id/complete', verifyToken, (req, res) => {
  try {
    const { notes } = req.body;

    // Controller logic:
    // 1. Check follow-up exists
    // 2. Check authorization
    // 3. Update status to completed
    // 4. Record completion time and user
    // 5. Create activity log entry

    const completedFollowup = {
      id: req.params.id,
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy: req.user.id,
      completedNotes: notes || '',
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Follow-up task marked as completed',
      data: completedFollowup
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
 * PATCH /api/v1/followup/:id/snooze
 * Snooze follow-up task (reschedule for later)
 */
router.patch('/:id/snooze', verifyToken, (req, res) => {
  try {
    const { duration } = req.body; // duration in minutes

    // Controller logic:
    // 1. Check follow-up exists
    // 2. Calculate new dueDate
    // 3. Update follow-up with new date
    // 4. Return updated task

    const newDueDate = new Date(Date.now() + duration * 60000);

    const snoozedFollowup = {
      id: req.params.id,
      dueDate: newDueDate.toISOString(),
      snoozedAt: new Date().toISOString(),
      snoozedFor: duration,
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `Follow-up task snoozed for ${duration} minutes`,
      data: snoozedFollowup
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
 * DELETE /api/v1/followup/:id
 * Delete follow-up task
 */
router.delete('/:id', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Check follow-up exists
    // 2. Check authorization
    // 3. Delete follow-up
    // 4. Log deletion

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Follow-up task deleted successfully',
      data: { id: req.params.id, deleted: true }
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
