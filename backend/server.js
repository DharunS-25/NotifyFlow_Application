const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Import database connection
const connectDB = require('./config/database');

// Import Models
const User = require('./models/User');
const UserMetric = require('./models/UserMetric');
const Routine = require('./models/Routine');
const Notification = require('./models/Notification');

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const routineRoutes = require('./routes/routines');
const notificationRoutes = require('./routes/notifications');
const metricsRoutes = require('./routes/metrics');
const testRoutes = require('./routes/test'); // NEW: Test routes

// Import Services
const NotificationScheduler = require('./utils/notificationScheduler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize notification scheduler
const notificationScheduler = new NotificationScheduler(io);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Debug middleware to log all incoming requests
app.use((req, res, next) => {
  console.log('=== Request Details ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Original URL:', req.originalUrl);
  console.log('Headers:', req.headers);
  console.log('=====================');
  next();
});

// Routes - Add explicit route logging
console.log('🚀 Registering API routes...');

// Test route to verify API is working
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Test notifications route
app.get('/api/notifications/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Notifications endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

// Register all routes
console.log('1. Registering /api/auth');
app.use('/api/auth', authRoutes);

console.log('2. Registering /api/users');
app.use('/api/users', userRoutes);

console.log('3. Registering /api/routines');
app.use('/api/routines', routineRoutes);

console.log('4. Registering /api/notifications');
app.use('/api/notifications', notificationRoutes);

console.log('5. Registering /api/metrics');
app.use('/api/metrics', metricsRoutes);

console.log('6. Registering /api/test'); // NEW: Test routes
app.use('/api/test', testRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  const routes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/me',
    '/api/routines',
    '/api/notifications',
    '/api/metrics/analytics',
    '/api/test/test-notification', // NEW: Added test route
    '/api/test/scheduler-status'   // NEW: Added scheduler status route
  ];
  
  res.json({ 
    status: 'OK', 
    message: 'NotifyFlow API is running',
    database: dbStatus,
    scheduler: notificationScheduler.isRunning ? 'running' : 'stopped',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    availableRoutes: routes
  });
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'NotifyFlow API',
    version: '1.0.0',
    description: 'Smart Routine Notification System API',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        profile: 'GET /api/auth/me'
      },
      users: {
        profile: 'GET /api/users/profile',
        preferences: 'PUT /api/users/preferences',
        metrics: 'GET /api/users/metrics'
      },
      routines: {
        getAll: 'GET /api/routines',
        create: 'POST /api/routines',
        update: 'PUT /api/routines/:id',
        delete: 'DELETE /api/routines/:id',
        toggle: 'PATCH /api/routines/:id/toggle'
      },
      notifications: {
        getAll: 'GET /api/notifications',
        getStats: 'GET /api/notifications/stats',
        sendResponse: 'POST /api/notifications/:id/response',
        snooze: 'POST /api/notifications/:id/snooze'
      },
      analytics: {
        analytics: 'GET /api/metrics/analytics?period=7d',
        insights: 'GET /api/metrics/insights',
        daily: 'GET /api/metrics/daily?date=YYYY-MM-DD'
      },
      test: { // NEW: Test endpoints
        test: 'GET /api/test',
        notificationsTest: 'GET /api/notifications/test',
        testNotification: 'POST /api/test/test-notification',
        schedulerStatus: 'GET /api/test/scheduler-status'
      }
    }
  });
});

// Debug endpoint to list all registered routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  res.json({ routes });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🔥 Global error handler:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  console.error('Full error stack:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler with detailed logging
app.use((req, res, next) => {
  console.error(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  
  // Log available routes for debugging
  console.log('Available routes that might match:');
  const availableRoutes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      availableRoutes.push(`${Object.keys(middleware.route.methods).join(', ')} ${middleware.route.path}`);
    }
  });
  
  console.log(availableRoutes);
  
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    suggestion: 'Check /api endpoint for available routes'
  });
});

// Store io instance in app for access in routes
app.set('io', io);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Remove 'Bearer ' prefix if present
    const tokenValue = token.replace('Bearer ', '');
    
    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
    
    // Verify user exists and is active
    const user = await User.findById(decoded.id).select('_id isActive username');
    if (!user || !user.isActive) {
      return next(new Error('Authentication error: User not found or inactive'));
    }

    socket.userId = decoded.id;
    socket.user = decoded;
    socket.username = user.username;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.userId} (${socket.username}) - Socket: ${socket.id}`);

  // Join user-specific room for targeted messaging
  socket.join(socket.userId);

  // Send connection confirmation
  socket.emit('connection-established', {
    userId: socket.userId,
    socketId: socket.id,
    timestamp: new Date(),
    message: 'Socket connection established successfully'
  });

  console.log(`🔗 User ${socket.userId} joined room: ${socket.userId}`);

  // Handle test notification request
  socket.on('request-test-notification', async (data = {}) => {
    try {
      const { sound = 'chime', volume = 0.7 } = data;
      console.log(`🧪 User ${socket.userId} requested test notification with sound: ${sound}`);
      
      const notificationData = await notificationScheduler.triggerTestNotification(socket.userId, sound, volume);
      
      socket.emit('test-notification-sent', {
        success: true,
        notification: notificationData,
        timestamp: new Date(),
        message: 'Test notification sent successfully'
      });
      
      console.log(`✅ Test notification sent to user ${socket.userId}`);
    } catch (error) {
      console.error('Error sending test notification:', error);
      socket.emit('test-notification-error', {
        success: false,
        message: error.message,
        timestamp: new Date()
      });
    }
  });

  // Handle notification responses from client
  socket.on('notification-response', async (data) => {
    try {
      const { notificationId, action, responseTime, snoozeMinutes } = data;
      
      console.log(`📢 Notification response from user ${socket.userId}:`, {
        notificationId,
        action,
        responseTime,
        snoozeMinutes
      });

      // Find and update notification
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        socket.emit('error', { message: 'Notification not found' });
        return;
      }

      // Verify the notification belongs to the user
      if (notification.user.toString() !== socket.userId) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      // Handle different response actions
      if (action === 'snoozed' && snoozeMinutes) {
        notification.status = 'snoozed';
        notification.snoozedUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);
        notification.userResponse = {
          action: 'snoozed',
          responseTime,
          timestamp: new Date()
        };
      } else {
        notification.status = action;
        notification.userResponse = {
          action,
          responseTime,
          timestamp: new Date()
        };
        
        if (action === 'completed') {
          notification.completedAt = new Date();
        }
      }

      await notification.save();

      // Update user metrics
      await UserMetric.updateForResponse(socket.userId, action, responseTime);

      // Update adaptive timing for the routine
      if (notification.routine && notification.userResponse) {
        await notificationScheduler.updateAdaptiveTiming(
          notification.routine,
          notification.userResponse
        );
      }

      // Emit update to all user's devices
      io.to(socket.userId).emit('notification-updated', {
        notificationId: notification._id,
        status: notification.status,
        action,
        snoozedUntil: notification.snoozedUntil,
        completedAt: notification.completedAt,
        timestamp: new Date()
      });

      console.log(`✅ Notification ${notificationId} ${action} by user ${socket.userId}`);

    } catch (error) {
      console.error('Error handling notification response:', error);
      socket.emit('error', { 
        message: 'Failed to process notification response',
        error: error.message,
        timestamp: new Date()
      });
    }
  });

  // Handle ping requests
  socket.on('ping', (data) => {
    socket.emit('pong', { 
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
      ...data 
    });
  });

  // Handle routine updates from client
  socket.on('routine-updated', async (data) => {
    try {
      const { routineId, updates } = data;
      
      const routine = await Routine.findOne({
        _id: routineId,
        user: socket.userId
      });
      
      if (routine) {
        // Reschedule notifications if needed
        if (updates.schedule || updates.isActive !== undefined) {
          await notificationScheduler.scheduleRoutineNotifications(routine);
        }
        
        io.to(socket.userId).emit('routine-synced', {
          routineId,
          updatedAt: new Date(),
          message: 'Routine updated and notifications rescheduled'
        });
      }
    } catch (error) {
      console.error('Error handling routine update:', error);
      socket.emit('routine-update-error', {
        message: 'Failed to update routine notifications',
        error: error.message
      });
    }
  });

  // Handle request for scheduler status
  socket.on('get-scheduler-status', () => {
    const status = notificationScheduler.getStatus();
    socket.emit('scheduler-status', {
      ...status,
      timestamp: new Date()
    });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.userId} (${socket.username}) - Socket: ${socket.id} - Reason: ${reason}`);
  });
});

// Database connection events
mongoose.connection.on('connected', () => {
  console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
  console.log(`📊 Database: ${mongoose.connection.name}`);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected');
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🛑 Received shutdown signal. Starting graceful shutdown...');
  
  // Stop notification scheduler
  if (notificationScheduler.isRunning) {
    notificationScheduler.stop();
  }
  
  // Close socket.io connections
  io.close(() => {
    console.log('🔌 Socket.io connections closed');
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('🔒 HTTP server closed');
    
    // Close MongoDB connection
    mongoose.connection.close(false, () => {
      console.log('🗄️ MongoDB connection closed');
      console.log('👋 Goodbye!');
      process.exit(0);
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⏰ Force shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server only after MongoDB is connected
mongoose.connection.once('open', () => {
  // Start notification scheduler
  try {
    notificationScheduler.start();
    console.log('✅ Notification scheduler started successfully');
  } catch (error) {
    console.error('❌ Failed to start notification scheduler:', error);
  }
  
  server.listen(PORT, () => {
    console.log(`
🚀 NotifyFlow Server Started!
───────────────────────────────────
📍 Port: ${PORT}
📊 Environment: ${process.env.NODE_ENV || 'development'}
🔗 MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}
🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
⏰ Scheduler: ${notificationScheduler.isRunning ? '✅ Running' : '❌ Stopped'}
🔌 WebSocket: Ready
───────────────────────────────────
✅ API Test: http://localhost:${PORT}/api/test
✅ Notifications Test: http://localhost:${PORT}/api/notifications/test
✅ Test Notification: POST http://localhost:${PORT}/api/test/test-notification
✅ Scheduler Status: GET http://localhost:${PORT}/api/test/scheduler-status
✅ API Health: http://localhost:${PORT}/api/health
📚 API Docs: http://localhost:${PORT}/api
🔍 Debug Routes: http://localhost:${PORT}/api/debug/routes
───────────────────────────────────
    `);
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Export for testing
module.exports = { app, server, io, notificationScheduler };