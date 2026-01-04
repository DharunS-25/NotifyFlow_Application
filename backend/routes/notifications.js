const express = require('express');
const router = express.Router();
const UserMetric = require('../models/UserMetric');
const Routine = require('../models/Routine');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Get user notifications
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    const query = { user: req.user.id };
    
    if (status) {
      query.status = status;
    }
    
    const notifications = await Notification.find(query)
      .populate('routine', 'title category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// ENHANCED RESPONSE ENDPOINT - FIXED VERSION
// ============================================
router.post('/:id/response', auth, async (req, res) => {
  const session = await Notification.startSession();
  session.startTransaction();
  
  try {
    const { action, responseTime, snoozeMinutes = 5 } = req.body;
    
    console.log(`📢 Processing ${action} response for notification ${req.params.id}`);
    console.log(`⏱️ Response time: ${responseTime} seconds`);
    console.log(`⏰ Snooze minutes: ${snoozeMinutes}`);
    
    // Find notification with lock to prevent race conditions
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id,
      $or: [
        { processing: { $exists: false } },
        { processing: false }
      ]
    }).session(session).populate('routine');

    if (!notification) {
      await session.abortTransaction();
      session.endSession();
      
      // Check if notification exists but is being processed
      const existingNotification = await Notification.findOne({
        _id: req.params.id,
        user: req.user.id
      });
      
      if (existingNotification && existingNotification.processing) {
        return res.status(409).json({ 
          success: false,
          message: 'Notification is already being processed. Please wait.',
          isProcessing: true
        });
      }
      
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }

    // Validate action
    const validActions = ['completed', 'snoozed', 'dismissed'];
    if (!validActions.includes(action)) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        message: `Invalid action. Must be one of: ${validActions.join(', ')}`
      });
    }

    // Set processing flag
    notification.processing = true;
    await notification.save({ session });

    // Update notification based on action
    notification.status = action;
    notification.userResponse = {
      action,
      responseTime: responseTime || 0,
      timestamp: new Date()
    };
    
    if (action === 'completed') {
      notification.completedAt = new Date();
      console.log(`✅ Notification marked as completed at ${notification.completedAt.toLocaleString()}`);
    } else if (action === 'dismissed') {
      console.log(`❌ Notification dismissed at ${new Date().toLocaleString()}`);
    } else if (action === 'snoozed') {
      const snoozeTime = new Date(Date.now() + snoozeMinutes * 60 * 1000);
      notification.snoozedUntil = snoozeTime;
      console.log(`⏰ Notification snoozed until ${snoozeTime.toLocaleString()}`);
    }

    // Remove processing flag
    notification.processing = false;
    
    await notification.save({ session });

    // Update user metrics
    try {
      await UserMetric.updateForResponse(req.user.id, action, responseTime || 0);
      console.log(`📊 Updated metrics for ${action} action`);
    } catch (metricError) {
      console.warn('⚠️ Could not update user metrics:', metricError.message);
      // Don't fail the transaction for metrics errors
    }

    // Update routine adaptive timing if applicable
    if (notification.routine && notification.routine.adaptiveTiming?.enabled) {
      try {
        const NotificationScheduler = require('../utils/notificationScheduler');
        const notificationScheduler = new NotificationScheduler();
        await notificationScheduler.updateAdaptiveTiming(
          notification.routine._id,
          notification.userResponse
        );
        console.log(`🔄 Updated adaptive timing for routine ${notification.routine.title}`);
      } catch (timingError) {
        console.warn('⚠️ Could not update adaptive timing:', timingError.message);
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Send response to all connected devices
    const io = req.app.get('io');
    if (io) {
      const updateData = {
        notificationId: notification._id,
        status: notification.status,
        action,
        responseTime: responseTime || 0,
        snoozedUntil: notification.snoozedUntil,
        completedAt: notification.completedAt,
        timestamp: new Date(),
        message: `Notification ${action} successfully`,
        userResponse: notification.userResponse
      };
      
      io.to(req.user.id.toString()).emit('notification-updated', updateData);
      console.log(`📡 Sent notification update to user ${req.user.id}`);
    }

    // Prepare response
    const response = { 
      success: true,
      message: `Notification ${action} successfully`,
      notification: {
        id: notification._id,
        status: notification.status,
        userResponse: notification.userResponse,
        snoozedUntil: notification.snoozedUntil,
        completedAt: notification.completedAt,
        responseTime: responseTime || 0
      }
    };
    
    console.log(`✅ Notification ${req.params.id} ${action} by user ${req.user.id} in ${responseTime || 0} seconds`);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error handling notification response:', error);
    
    // Abort transaction and cleanup
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
    } catch (cleanupError) {
      console.error('❌ Error cleaning up transaction:', cleanupError);
    }
    
    // Remove any lock if it exists
    try {
      await Notification.updateOne(
        { _id: req.params.id },
        { $set: { processing: false } }
      );
    } catch (lockError) {
      console.error('❌ Error removing lock:', lockError);
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to process notification response',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Snooze notification (legacy endpoint for backward compatibility)
router.post('/:id/snooze', auth, async (req, res) => {
  try {
    const { minutes = 5 } = req.body;
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    notification.status = 'snoozed';
    notification.snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
    notification.userResponse = {
      action: 'snoozed',
      timestamp: new Date()
    };
    
    await notification.save();
    
    res.json({ 
      message: `Notification snoozed for ${minutes} minutes`,
      snoozedUntil: notification.snoozedUntil 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get notification statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      { $match: { user: req.user.id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$userResponse.responseTime' }
        }
      }
    ]);
    
    const total = await Notification.countDocuments({ user: req.user.id });
    const completed = await Notification.countDocuments({ 
      user: req.user.id, 
      status: 'completed' 
    });
    
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    
    // Get recent response times for completed notifications
    const recentCompleted = await Notification.find({
      user: req.user.id,
      status: 'completed',
      'userResponse.responseTime': { $exists: true }
    })
    .sort({ completedAt: -1 })
    .limit(10)
    .select('userResponse.responseTime completedAt');
    
    const recentResponseTimes = recentCompleted.map(n => ({
      responseTime: n.userResponse.responseTime,
      completedAt: n.completedAt
    }));
    
    res.json({
      stats,
      total,
      completed,
      completionRate: Math.round(completionRate * 100) / 100,
      recentResponseTimes,
      summary: {
        totalNotifications: total,
        completionRate: Math.round(completionRate * 100) / 100,
        averageResponseTime: stats.find(s => s._id === 'completed')?.avgResponseTime || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get comprehensive analytics
router.get('/analytics', auth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const days = parseInt(period) || (period === '30d' ? 30 : 7);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get metrics data
    const metrics = await UserMetric.find({
      user: req.user.id,
      date: { $gte: startDate }
    }).sort({ date: 1 });
    
    // Get routine statistics
    const routineStats = await Routine.aggregate([
      { $match: { user: req.user.id } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          avgCompletionRate: { 
            $avg: { 
              $cond: [
                { $gt: ['$totalNotifications', 0] },
                { $divide: ['$completedNotifications', '$totalNotifications'] },
                0
              ]
            }
          }
        }
      }
    ]);
    
    // Get notification trends
    const notificationTrends = await Notification.aggregate([
      {
        $match: {
          user: req.user.id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          avgResponseTime: { 
            $avg: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                '$userResponse.responseTime',
                null
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Calculate overall statistics
    const totalRoutines = await Routine.countDocuments({ user: req.user.id });
    const activeRoutines = await Routine.countDocuments({ 
      user: req.user.id, 
      isActive: true 
    });
    
    const totalNotifications = await Notification.countDocuments({ 
      user: req.user.id 
    });
    const completedNotifications = await Notification.countDocuments({ 
      user: req.user.id, 
      status: 'completed' 
    });
    
    const overallCompletionRate = totalNotifications > 0 
      ? (completedNotifications / totalNotifications) * 100 
      : 0;
    
    // Get average response time for completed notifications
    const avgResponseResult = await Notification.aggregate([
      {
        $match: {
          user: req.user.id,
          status: 'completed',
          'userResponse.responseTime': { $exists: true, $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$userResponse.responseTime' }
        }
      }
    ]);
    
    const avgResponseTime = avgResponseResult.length > 0 ? avgResponseResult[0].avgResponseTime : 0;
    
    res.json({
      period: {
        start: startDate,
        end: new Date(),
        days
      },
      summary: {
        totalRoutines,
        activeRoutines,
        totalNotifications,
        completedNotifications,
        overallCompletionRate: Math.round(overallCompletionRate * 100) / 100,
        averageResponseTime: Math.round(avgResponseTime * 100) / 100
      },
      metrics,
      routineStats,
      notificationTrends,
      performance: {
        completionRate: Math.round(overallCompletionRate * 100) / 100,
        responseEfficiency: avgResponseTime > 0 ? Math.round(Math.max(0, 100 - (avgResponseTime / 10))) : 0,
        productivityScore: Math.round(
          (overallCompletionRate * 0.6) + 
          (Math.max(0, 100 - (avgResponseTime / 10)) * 0.4)
        )
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get productivity insights
router.get('/insights', auth, async (req, res) => {
  try {
    const recentMetrics = await UserMetric.find({
      user: req.user.id
    })
    .sort({ date: -1 })
    .limit(10);
    
    if (recentMetrics.length === 0) {
      return res.json({ insights: [] });
    }
    
    const insights = [];
    const latestMetric = recentMetrics[0];
    
    // Generate insights based on metrics
    if (latestMetric.completionRate < 50) {
      insights.push({
        type: 'warning',
        title: 'Low Completion Rate',
        message: `Your completion rate is ${latestMetric.completionRate.toFixed(1)}%. Consider adjusting your routine timing or reducing notification frequency.`,
        suggestion: 'Try scheduling routines during your most productive hours.',
        priority: 1
      });
    }
    
    if (latestMetric.averageResponseTime > 120) {
      insights.push({
        type: 'info',
        title: 'Slow Response Time',
        message: `Your average response time is ${latestMetric.averageResponseTime.toFixed(1)} seconds. Faster responses can improve productivity.`,
        suggestion: 'Enable louder alarm sounds or place your device closer.',
        priority: 2
      });
    }
    
    if (latestMetric.productiveHours < 4) {
      insights.push({
        type: 'suggestion',
        title: 'Increase Productive Time',
        message: `You've logged ${latestMetric.productiveHours} productive hours today.`,
        suggestion: 'Add more work-focused routines to your schedule.',
        priority: 3
      });
    }
    
    // Compare with previous period
    if (recentMetrics.length > 1) {
      const previousMetric = recentMetrics[1];
      const completionChange = latestMetric.completionRate - previousMetric.completionRate;
      
      if (Math.abs(completionChange) > 10) {
        insights.push({
          type: completionChange > 0 ? 'success' : 'warning',
          title: `Completion Rate ${completionChange > 0 ? 'Improved' : 'Declined'}`,
          message: `Your completion rate has ${completionChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(completionChange).toFixed(1)}% compared to the previous period.`,
          suggestion: completionChange > 0 ? 'Keep up the good work!' : 'Review your recent routine adjustments.',
          priority: completionChange > 0 ? 4 : 1
        });
      }
    }
    
    // Sort insights by priority (lower number = higher priority)
    insights.sort((a, b) => a.priority - b.priority);
    
    res.json({ insights });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Clear all snoozed notifications
router.post('/clear-snoozed', auth, async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      user: req.user.id,
      status: 'snoozed'
    });
    
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} snoozed notifications`,
      clearedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get notification by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('routine', 'title category schedule');
    
    if (!notification) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }
    
    res.json({
      success: true,
      notification
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Test notification endpoint (for debugging)
router.post('/test/response-sync', auth, async (req, res) => {
  try {
    const { action = 'completed', responseTime = 5, simulateDelay = 0 } = req.body;
    
    console.log(`🧪 Testing response sync with action: ${action}, delay: ${simulateDelay}ms`);
    
    // Simulate processing delay if requested
    if (simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, simulateDelay));
    }
    
    // Create a test notification response
    const testResponse = {
      success: true,
      message: `Test ${action} response processed successfully`,
      data: {
        action,
        responseTime,
        timestamp: new Date(),
        simulatedDelay: simulateDelay,
        serverTime: new Date().toISOString()
      }
    };
    
    // Emit test event if socket.io is available
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.id.toString()).emit('test-response-sync', {
        ...testResponse.data,
        userId: req.user.id,
        test: true
      });
    }
    
    res.json(testResponse);
    
  } catch (error) {
    console.error('Test response sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

// Check if a notification is being processed
router.get('/:id/status', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id
    }).select('status processing userResponse');
    
    if (!notification) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }
    
    res.json({
      success: true,
      status: notification.status,
      isProcessing: notification.processing || false,
      userResponse: notification.userResponse,
      lastUpdated: notification.updatedAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;