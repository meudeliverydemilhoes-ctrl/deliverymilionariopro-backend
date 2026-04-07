const express = require('express');
const multer = require('multer');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');

// Configure multer for CSV uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * GET /api/v1/campaigns
 * List all campaigns
 */
router.get('/', verifyToken, (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    // Controller logic:
    // 1. Fetch campaigns with filters
    // 2. Include campaign stats (sent, delivered, clicked, replied)
    // 3. Paginate results
    // 4. Order by creation date (newest first)

    const campaigns = [
      {
        id: 'camp_001',
        name: 'Spring Promotion 2024',
        description: 'Special offer for new customers',
        status: 'active',
        type: 'promotional',
        createdBy: 'user_123',
        createdByName: 'João Santos',
        targetCount: 500,
        sentCount: 450,
        deliveredCount: 445,
        readCount: 320,
        clickCount: 85,
        replyCount: 42,
        conversionCount: 12,
        startDate: '2024-03-01T08:00:00Z',
        endDate: null,
        nextSendTime: null,
        schedule: 'immediate',
        createdAt: '2024-02-25T10:30:00Z',
        updatedAt: '2024-03-05T14:20:00Z'
      },
      {
        id: 'camp_002',
        name: 'Weekly Newsletter',
        description: 'Product updates and tips',
        status: 'scheduled',
        type: 'newsletter',
        createdBy: 'user_124',
        createdByName: 'Maria Silva',
        targetCount: 1200,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        clickCount: 0,
        replyCount: 0,
        conversionCount: 0,
        startDate: '2024-03-10T09:00:00Z',
        endDate: null,
        nextSendTime: '2024-03-10T09:00:00Z',
        schedule: 'weekly',
        createdAt: '2024-03-01T15:00:00Z',
        updatedAt: '2024-03-01T15:00:00Z'
      }
    ];

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: campaigns,
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
 * GET /api/v1/campaigns/:id
 * Get campaign details
 */
router.get('/:id', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Fetch campaign by ID
    // 2. Include full campaign details and stats
    // 3. Return campaign information

    const campaign = {
      id: req.params.id,
      name: 'Spring Promotion 2024',
      description: 'Special offer for new customers',
      status: 'active',
      type: 'promotional',
      createdBy: 'user_123',
      createdByName: 'João Santos',
      targetCount: 500,
      sentCount: 450,
      deliveredCount: 445,
      readCount: 320,
      clickCount: 85,
      replyCount: 42,
      conversionCount: 12,
      deliveryRate: 98.9,
      openRate: 71.9,
      clickRate: 19.1,
      replyRate: 9.4,
      conversionRate: 2.7,
      startDate: '2024-03-01T08:00:00Z',
      endDate: null,
      schedule: 'immediate',
      template: {
        id: 'tmpl_001',
        name: 'Promotional Message',
        content: 'Check out our spring promotion! Limited time offer...'
      },
      segments: ['interests_sales', 'active_contacts'],
      createdAt: '2024-02-25T10:30:00Z',
      updatedAt: '2024-03-05T14:20:00Z'
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: campaign
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
 * POST /api/v1/campaigns
 * Create a new campaign
 */
router.post('/', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    const { name, description, type, templateId, targetSegments, schedule, startDate } = req.body;

    // Controller logic:
    // 1. Validate required fields
    // 2. Check template exists
    // 3. Create campaign in database
    // 4. Set initial status to 'draft'
    // 5. Return created campaign

    const newCampaign = {
      id: 'camp_' + Date.now(),
      name: name,
      description: description,
      status: 'draft',
      type: type,
      createdBy: req.user.id,
      createdByName: 'John Doe',
      targetCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      clickCount: 0,
      replyCount: 0,
      conversionCount: 0,
      startDate: startDate || null,
      schedule: schedule || 'immediate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Campaign created successfully',
      data: newCampaign
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
 * PUT /api/v1/campaigns/:id
 * Update campaign
 */
router.put('/:id', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    const { name, description, templateId, targetSegments, schedule, startDate } = req.body;

    // Controller logic:
    // 1. Check campaign is in draft status (can't edit active campaigns)
    // 2. Validate fields
    // 3. Update campaign in database
    // 4. Return updated campaign

    const updatedCampaign = {
      id: req.params.id,
      name: name || 'Campaign Name',
      description: description || '',
      schedule: schedule || 'immediate',
      startDate: startDate || null,
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Campaign updated successfully',
      data: updatedCampaign
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
 * POST /api/v1/campaigns/:id/start
 * Start a campaign (send messages)
 */
router.post('/:id/start', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    // Controller logic:
    // 1. Check campaign is in draft status
    // 2. Validate campaign has target segment and template
    // 3. Queue campaign for sending via Evolution API
    // 4. Update campaign status to 'active'
    // 5. Begin tracking delivery and engagement metrics
    // 6. Return updated campaign

    const startedCampaign = {
      id: req.params.id,
      status: 'active',
      startedAt: new Date().toISOString(),
      estimatedCompletionTime: '2024-03-06T14:20:00Z'
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Campaign started successfully',
      data: startedCampaign
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
 * POST /api/v1/campaigns/upload-csv
 * Upload CSV file to create campaign targets
 */
router.post('/upload-csv', verifyToken, requireRole('supervisor'), upload.single('file'), (req, res) => {
  try {
    // Controller logic:
    // 1. Validate file was uploaded
    // 2. Parse CSV file
    // 3. Validate required columns (name, phone, email)
    // 4. Check for duplicate phone numbers
    // 5. Create leads/contacts from CSV
    // 6. Return import results with success/error counts

    const fileContent = req.file.buffer.toString('utf-8');
    const lines = fileContent.split('\n');

    const importResult = {
      filename: req.file.originalname,
      totalRecords: Math.max(0, lines.length - 1),
      successCount: Math.max(0, lines.length - 1),
      errorCount: 0,
      errors: [],
      uploadedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'CSV uploaded and processed successfully',
      data: importResult
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
 * GET /api/v1/campaigns/:id/report
 * Get detailed campaign performance report
 */
router.get('/:id/report', verifyToken, (req, res) => {
  try {
    // Controller logic:
    // 1. Fetch campaign details
    // 2. Calculate detailed metrics
    // 3. Generate hourly/daily stats
    // 4. Return comprehensive report data

    const report = {
      campaignId: req.params.id,
      campaignName: 'Spring Promotion 2024',
      period: {
        start: '2024-03-01T08:00:00Z',
        end: '2024-03-05T14:20:00Z'
      },
      metrics: {
        targetCount: 500,
        sentCount: 450,
        deliveredCount: 445,
        failedCount: 5,
        readCount: 320,
        clickCount: 85,
        replyCount: 42,
        conversionCount: 12
      },
      rates: {
        deliveryRate: 98.9,
        openRate: 71.9,
        clickRate: 19.1,
        replyRate: 9.4,
        conversionRate: 2.7
      },
      topMetrics: {
        bestHour: '14:00',
        bestDay: 'Tuesday',
        highestEngagementSegment: 'interests_sales'
      },
      timeline: [
        {
          date: '2024-03-01',
          sent: 150,
          delivered: 149,
          read: 89,
          clicked: 18,
          replied: 8
        }
      ]
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: report
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
 * DELETE /api/v1/campaigns/:id
 * Delete a campaign (only draft campaigns)
 */
router.delete('/:id', verifyToken, requireRole('supervisor'), (req, res) => {
  try {
    // Controller logic:
    // 1. Check campaign is in draft status
    // 2. Delete campaign from database
    // 3. Clean up associated data

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Campaign deleted successfully',
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
