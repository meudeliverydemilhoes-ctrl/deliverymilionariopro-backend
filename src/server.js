require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      'https://meudeliverydemilhoes-ctrl.github.io',
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    if (!origin || allowed.some(a => origin.startsWith(a))) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.'
});

app.use(limiter);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`User joined conversation: ${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Route imports
const authRoutes = require('./routes/auth.routes');
const leadsRoutes = require('./routes/leads.routes');
const conversationsRoutes = require('./routes/conversations.routes');
const messagesRoutes = require('./routes/messages.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const followupRoutes = require('./routes/followup.routes');
const reportsRoutes = require('./routes/reports.routes');
const usersRoutes = require('./routes/users.routes');
const alertsRoutes = require('./routes/alerts.routes');

// Mount routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/leads', leadsRoutes);
app.use('/api/v1/conversations', conversationsRoutes);
app.use('/api/v1/messages', messagesRoutes);
app.use('/api/v1/campaigns', campaignsRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);
app.use('/api/v1/chatbot', chatbotRoutes);
app.use('/api/v1/followup', followupRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/alerts', alertsRoutes);

// Disponibilizar io para as rotas (socket.io em tempo real)
app.set('io', io);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    app: 'Delivery MilionÃ¡rio Pro',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    app: 'Delivery MilionÃ¡rio Pro - API',
    version: '1.0.0',
    docs: '/api/v1',
    health: '/health'
  });
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Run migrations and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Auto-run migrations on startup
    const knex = require('../knexfile');
    const db = require('knex')(knex[process.env.NODE_ENV || 'development'] || knex.production || knex);

    console.log('[DB] Running migrations...');
    await db.migrate.latest();
    console.log('[DB] Migrations completed successfully');

    // Run seeds if tables are empty
    try {
      const stages = await db('funnel_stages').count('id as count').first();
      if (!stages || parseInt(stages.count) === 0) {
        console.log('[DB] Running seeds...');
        await db.seed.run();
        console.log('[DB] Seeds completed');
      }
    } catch (seedErr) {
      console.log('[DB] Seeds skipped:', seedErr.message);
    }
  } catch (err) {
    console.error('[DB] Migration error:', err.message);
    console.log('[DB] Server will start anyway...');
  }

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();

module.exports = { app, server, io };
