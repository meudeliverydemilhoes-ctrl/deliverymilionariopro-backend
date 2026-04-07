const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/v1/leads
 * List all leads with pagination, search, and filtering
 */
router.get('/', verifyToken, (req, res) => {
  try {
    const { page = 1, limit = 20, search, stage, assignedTo, priority } = req.query;

    // Controller logic:
    // 1. Build query with filters (stage, assignedTo, priority)
    // 2. Apply search filter on name, email, phone
    // 3. Paginate results
    // 4. Return leads with pagination metadata

    const leads = [
      {
        id: 'lead_001',
        name: 'Carlos Silva',
        email: 'carlos@example.com',
        phone: '+55 11 98765-4321',
        stage: 'qualification',
        priority: 'high',
        source: 'whatsapp',
        company: 'Tech Solutions',
        assignedTo: 'user_123',
        assignedToName: 'João Santos',
        notes: 'Interested in bulk SMS service',
        value: 5000,
        createdAt: '2024-03-01T08:00:00Z',
        updatedAt: '2024-03-05T14:30:00Z'
      },
      {
        id: 'lead_002',
        name: 'Ana Costa',
        email: 'ana@example.com',
        phone: '+55 21 99876-5432',
        stage: 'proposal',
        priority: 'medium',
        source: 'whatsapp',
        company: 'Digital Marketing Co',
        assignedTo: 'user_124',
        assignedToName: 'Maria Silva',
        notes: 'Waiting for proposal feedback',
        value: 8000,
        createdAt: '2024-02-28T10:15:00Z',
        updatedAt: '2024-03-04T11:20:00Z'
      }
    ];

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 42,
        totalPages: Math.ceil(42 / parseInt(limit))
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
 * GET /api/v1/leads/:id
 * Get single lead details
 */
router.get('/:id', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Find lead by ID
    // 2. Fetch associated notes, interactions, and messages
    // 3. Return detailed lead information

    const lead = {
      id: req.params.id,
      name: 'Carlos Silva',
      email: 'carlos@example.com',
      phone: '+55 11 98765-4321',
      stage: 'qualification',
      priority: 'high',
      source: 'whatsapp',
      company: 'Tech Solutions',
      website: 'https://techsolutions.com.br',
      industry: 'Technology',
      employees: '50-100',
      assignedTo: 'user_123',
      assignedToName: 'João Santos',
      notes: 'Interested in bulk SMS service, budget ~5k',
      value: 5000,
      nextFollowUp: '2024-03-10T15:00:00Z',
      interactions: 15,
      lastInteraction: '2024-03-05T14:30:00Z',
      tags: ['interested', 'qualified', 'urgent'],
      createdAt: '2024-03-01T08:00:00Z',
      updatedAt: '2024-03-05T14:30:00Z'
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: lead
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
 * POST /api/v1/leads
 * Create a new lead
 */
router.post('/', verifyToken, (req, res) => {
  try {
    const { name, email, phone, company, stage = 'prospecting', priority = 'medium' } = req.body;

    // Controller logic:
    // 1. Validate required fields
    // 2. Check for duplicate emails/phones
    // 3. Create lead in database
    // 4. Return created lead with ID

    const newLead = {
      id: 'lead_' + Date.now(),
      name,
      email,
      phone,
      company,
      stage,
      priority,
      source: 'manual',
      assignedTo: null,
      notes: '',
      value: 0,
      interactions: 0,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Lead created successfully',
      data: newLead
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
 * PUT /api/v1/leads/:id
 * Update a lead (full update)
 */
router.put('/:id', verifyToken, (req, res) => {
  try {
    const { name, email, phone, company, notes, priority, value } = req.body;

    // Controller logic:
    // 1. Validate lead exists
    // 2. Update lead fields in database
    // 3. Return updated lead

    const updatedLead = {
      id: req.params.id,
      name: name || 'Carlos Silva',
      email: email || 'carlos@example.com',
      phone: phone || '+55 11 98765-4321',
      company: company || 'Tech Solutions',
      notes: notes || 'Updated lead information',
      priority: priority || 'high',
      value: value || 5000,
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Lead updated successfully',
      data: updatedLead
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
 * PATCH /api/v1/leads/:id/stage
 * Update lead stage in sales pipeline
 */
router.patch('/:id/stage', verifyToken, (req, res) => {
  try {
    const { stage } = req.body;

    // Controller logic:
    // 1. Validate stage value (prospecting, qualification, proposal, negotiation, closed-won, closed-lost)
    // 2. Update lead stage in database
    // 3. Log stage change
    // 4. Return updated lead

    const updatedLead = {
      id: req.params.id,
      stage: stage || 'qualification',
      previousStage: 'prospecting',
      movedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `Lead moved to ${stage} stage`,
      data: updatedLead
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
 * PATCH /api/v1/leads/:id/assign
 * Assign lead to a user
 */
router.patch('/:id/assign', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    const { userId } = req.body;

    // Controller logic:
    // 1. Validate user exists
    // 2. Update lead assignedTo field
    // 3. Create activity log entry
    // 4. Return updated lead

    const updatedLead = {
      id: req.params.id,
      assignedTo: userId,
      assignedToName: 'João Santos',
      assignedAt: new Date().toISOString(),
      previousAssignee: 'user_124',
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Lead assigned successfully',
      data: updatedLead
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
 * GET /api/v1/leads/:id/notes
 * Get all notes for a lead
 */
router.get('/:id/notes', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Fetch all notes for the lead
    // 2. Order by creation date (newest first)
    // 3. Include author information
    // 4. Return notes list

    const notes = [
      {
        id: 'note_001',
        leadId: req.params.id,
        authorId: 'user_123',
        authorName: 'João Santos',
        content: 'Client interested in annual plan. Will send proposal tomorrow.',
        type: 'internal',
        createdAt: '2024-03-05T14:30:00Z'
      },
      {
        id: 'note_002',
        leadId: req.params.id,
        authorId: 'user_124',
        authorName: 'Maria Silva',
        content: 'Initial contact made via WhatsApp. Sent product overview.',
        type: 'interaction',
        createdAt: '2024-03-04T10:15:00Z'
      }
    ];

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: notes
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
 * POST /api/v1/leads/:id/notes
 * Add a note to a lead
 */
router.post('/:id/notes', verifyToken, (req, res) => {
  try {
    const { content, type = 'internal' } = req.body;

    // Controller logic:
    // 1. Validate content is provided
    // 2. Create note entry in database
    // 3. Update lead lastInteraction timestamp
    // 4. Return created note

    const newNote = {
      id: 'note_' + Date.now(),
      leadId: req.params.id,
      authorId: req.user.id,
      authorName: 'John Doe',
      content: content,
      type: type,
      createdAt: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Note added successfully',
      data: newNote
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
 * DELETE /api/v1/leads/:id
 * Delete a lead (soft delete)
 */
router.delete('/:id', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    // Controller logic:
    // 1. Soft delete lead (set deleted flag)
    // 2. Archive related data
    // 3. Log deletion action

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Lead deleted successfully',
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
