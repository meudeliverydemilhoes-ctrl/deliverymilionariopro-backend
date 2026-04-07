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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
    app: 'Delivery Milionário Pro',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    app: 'Delivery Milionário Pro - API',
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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
