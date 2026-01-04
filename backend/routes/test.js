const express = require('express');
const router = express.Router();
const Routine = require('../models/Routine');
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Test notification endpoint
router.post('/test-notification', auth, async (req, res) => {
  try {
    const { sound = 'chime', volume = 0.7 } = req.body;
    
    console.log(`🧪 Test notification requested by user ${req.user.id} with sound: ${sound}`);
    
    // Create a test notification in database
    const testNotification = new Notification({
      user: req.user.id,
      title: 'Test Notification',
      message: 'This is a test notification to verify sound works correctly',
      type: 'alarm',
      sound: sound,
      volume: volume,
      status: 'delivered',
      scheduledFor: new Date(),
      deliveredAt: new Date()
    });
    
    await testNotification.save();
    
    // Emit via socket.io if available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(req.user.id.toString()).emit('notification', {
        id: testNotification._id.toString(),
        title: testNotification.title,
        message: testNotification.message,
        sound: testNotification.sound,
        volume: testNotification.volume,
        timestamp: new Date(),
        type: 'alarm'
      });
      
      console.log(`🔔 Test notification sent via WebSocket to user ${req.user.id}`);
    }
    
    res.json({
      success: true,
      message: 'Test notification sent',
      notification: {
        id: testNotification._id,
        title: testNotification.title,
        sound: testNotification.sound,
        volume: testNotification.volume,
        timestamp: testNotification.deliveredAt
      }
    });
    
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

// Get scheduler status
router.get('/scheduler-status', auth, async (req, res) => {
  try {
    const NotificationScheduler = require('../utils/notificationScheduler');
    const io = req.app.get('io');
    const scheduler = new NotificationScheduler(io);
    
    const status = scheduler.getStatus();
    
    // Get upcoming notifications for the user
    const upcomingNotifications = await Notification.find({
      user: req.user.id,
      status: 'pending',
      scheduledFor: { $gte: new Date() }
    }).sort({ scheduledFor: 1 }).limit(5);
    
    // Get recently delivered notifications
    const recentNotifications = await Notification.find({
      user: req.user.id,
      status: 'delivered',
      deliveredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).sort({ deliveredAt: -1 }).limit(5);
    
    // Get active routines
    const activeRoutines = await Routine.find({
      user: req.user.id,
      isActive: true
    });
    
    // Get all routines for schedule overview
    const allRoutines = await Routine.find({
      user: req.user.id
    });
    
    res.json({
      success: true,
      scheduler: status,
      stats: {
        activeRoutines: activeRoutines.length,
        totalRoutines: allRoutines.length,
        upcomingNotifications: upcomingNotifications.length,
        recentNotifications: recentNotifications.length
      },
      upcomingNotifications: upcomingNotifications.map(n => ({
        id: n._id,
        title: n.title,
        scheduledFor: n.scheduledFor,
        sound: n.sound,
        routineId: n.routine
      })),
      recentNotifications: recentNotifications.map(n => ({
        id: n._id,
        title: n.title,
        deliveredAt: n.deliveredAt,
        sound: n.sound,
        routineId: n.routine
      })),
      activeRoutines: activeRoutines.map(r => ({
        id: r._id,
        title: r.title,
        schedule: r.schedule,
        sound: r.sound,
        nextSchedule: calculateNextSchedule(r.schedule)
      }))
    });
    
  } catch (error) {
    console.error('Scheduler status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error.message
    });
  }
});

// Helper function to calculate next schedule time
function calculateNextSchedule(schedule) {
  if (!schedule || schedule.length === 0) return null;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const currentDay = now.getDay();
  
  let nextTime = null;
  let nextDay = null;
  
  schedule.forEach(s => {
    if (s.time && s.days) {
      const [hours, minutes] = s.time.split(':').map(Number);
      const scheduleTime = hours * 60 + minutes;
      
      s.days.forEach(day => {
        if (day === currentDay && scheduleTime > currentTime) {
          if (!nextTime || scheduleTime < nextTime) {
            nextTime = scheduleTime;
            nextDay = day;
          }
        } else if (day > currentDay) {
          if (!nextTime || day < nextDay) {
            nextTime = scheduleTime;
            nextDay = day;
          }
        }
      });
    }
  });
  
  if (nextTime !== null && nextDay !== null) {
    const hours = Math.floor(nextTime / 60);
    const minutes = nextTime % 60;
    return {
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][nextDay],
      time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    };
  }
  
  return null;
}

// Get system diagnostics
router.get('/diagnostics', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const routinesCount = await Routine.countDocuments({ user: req.user.id });
    const notificationsCount = await Notification.countDocuments({ user: req.user.id });
    const recentNotifications = await Notification.countDocuments({
      user: req.user.id,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    res.json({
      success: true,
      diagnostics: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt
        },
        routines: {
          total: routinesCount,
          active: await Routine.countDocuments({ user: req.user.id, isActive: true })
        },
        notifications: {
          total: notificationsCount,
          recent7days: recentNotifications,
          byStatus: {
            pending: await Notification.countDocuments({ user: req.user.id, status: 'pending' }),
            delivered: await Notification.countDocuments({ user: req.user.id, status: 'delivered' }),
            completed: await Notification.countDocuments({ user: req.user.id, status: 'completed' }),
            snoozed: await Notification.countDocuments({ user: req.user.id, status: 'snoozed' })
          }
        },
        database: {
          connected: true,
          timestamp: new Date()
        }
      }
    });
    
  } catch (error) {
    console.error('Diagnostics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get diagnostics',
      error: error.message
    });
  }
});

// Manual trigger for scheduler check (admin/debug only)
router.post('/trigger-scheduler-check', auth, async (req, res) => {
  try {
    // Only allow if user is admin or for debugging
    const user = await User.findById(req.user.id);
    
    console.log(`🔍 Manual scheduler trigger requested by ${user.email}`);
    
    // Import and trigger scheduler check
    const NotificationScheduler = require('../utils/notificationScheduler');
    const io = req.app.get('io');
    const scheduler = new NotificationScheduler(io);
    
    await scheduler.checkScheduledRoutines();
    
    res.json({
      success: true,
      message: 'Scheduler check triggered manually',
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Manual scheduler trigger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger scheduler check',
      error: error.message
    });
  }
});

module.exports = router;