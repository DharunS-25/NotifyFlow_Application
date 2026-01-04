const cron = require('node-cron');
const Routine = require('../models/Routine');
const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationScheduler {
  constructor(io) {
    this.io = io;
    this.isRunning = false;
    console.log('🔔 Notification Scheduler initialized');
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Notification scheduler already running');
      return;
    }
    
    console.log('🚀 Starting notification scheduler...');
    
    // Check for due notifications every minute
    cron.schedule('* * * * *', async () => {
      try {
        await this.checkScheduledRoutines();
      } catch (error) {
        console.error('❌ Error in cron job:', error);
      }
    });
    
    // Check for snoozed notifications every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.checkSnoozedNotifications();
      } catch (error) {
        console.error('❌ Error checking snoozed notifications:', error);
      }
    });
    
    // Clean up old notifications daily at midnight
    cron.schedule('0 0 * * *', async () => {
      try {
        await this.cleanupOldNotifications();
      } catch (error) {
        console.error('❌ Error cleaning up notifications:', error);
      }
    });
    
    // Test scheduler immediately on startup
    setTimeout(async () => {
      try {
        await this.testScheduler();
      } catch (error) {
        console.error('❌ Scheduler test failed:', error);
      }
    }, 5000);
    
    this.isRunning = true;
    console.log('✅ Notification scheduler started successfully');
  }

  async testScheduler() {
    console.log('🧪 Running scheduler test...');
    
    // Test: Check if there are any active routines
    const activeRoutines = await Routine.countDocuments({ isActive: true });
    console.log(`📊 Found ${activeRoutines} active routines`);
    
    // Test: Create a test notification if no active routines
    if (activeRoutines === 0) {
      console.log('📝 Creating test notification...');
      
      // Get any user to create test notification
      const testUser = await User.findOne();
      if (testUser) {
        const testNotification = new Notification({
          user: testUser._id,
          title: 'Test Notification',
          message: 'This is a test notification from the scheduler',
          type: 'alarm',
          sound: 'chime',
          volume: 0.7,
          status: 'delivered',
          scheduledFor: new Date(),
          deliveredAt: new Date()
        });
        
        await testNotification.save();
        
        if (this.io) {
          this.io.emit('notification', {
            id: testNotification._id.toString(),
            title: testNotification.title,
            message: testNotification.message,
            sound: testNotification.sound,
            volume: testNotification.volume,
            timestamp: new Date()
          });
        }
        
        console.log('✅ Test notification created and sent');
      }
    }
  }

  async checkScheduledRoutines() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentDay = now.getDay();
      const currentDateTime = now;

      console.log(`⏰ Checking routines at ${currentTime} (Day ${currentDay})`);

      // Find active routines with matching schedule for current time
      const activeRoutines = await Routine.find({
        isActive: true,
        $or: [
          {
            'schedule': {
              $elemMatch: {
                time: currentTime,
                days: currentDay
              }
            }
          },
          {
            'schedule.time': currentTime,
            'schedule.days': currentDay
          }
        ]
      }).populate('user');

      console.log(`📋 Found ${activeRoutines.length} due routines`);

      if (activeRoutines.length > 0) {
        for (const routine of activeRoutines) {
          console.log(`📅 Processing routine: ${routine.title} for user ${routine.user?.email}`);
          await this.createAndSendNotification(routine, currentDateTime);
        }
      }
    } catch (error) {
      console.error('❌ Error checking scheduled routines:', error);
    }
  }

  async createAndSendNotification(routine, scheduledTime) {
    try {
      console.log(`📝 Creating notification for routine: ${routine.title}`);
      
      // Check if a notification was already sent recently (within last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existingNotification = await Notification.findOne({
        user: routine.user._id,
        routine: routine._id,
        scheduledFor: { $gte: fiveMinutesAgo },
        status: { $in: ['pending', 'delivered', 'snoozed'] }
      });

      if (existingNotification) {
        console.log(`⏭️ Skipping duplicate notification for ${routine.title} (already sent at ${existingNotification.scheduledFor})`);
        return;
      }

      // Calculate adaptive timing based on routine's historical performance
      let adjustedTime = scheduledTime;
      let adaptiveAdjustment = 0;
      
      if (routine.adaptiveTiming?.enabled && routine.adaptiveTiming.adjustment) {
        adaptiveAdjustment = routine.adaptiveTiming.adjustment || 0;
        
        if (adaptiveAdjustment !== 0) {
          const adjustmentMs = adaptiveAdjustment * 60 * 1000;
          adjustedTime = new Date(scheduledTime.getTime() + adjustmentMs);
          console.log(`🕒 Applied ${adaptiveAdjustment}min adjustment for ${routine.title}`);
        }
      }

      // Create notification in database
      const notification = new Notification({
        user: routine.user._id,
        routine: routine._id,
        title: routine.title,
        message: routine.description || `Time for ${routine.title}`,
        type: 'alarm',
        sound: routine.sound || 'chime',
        volume: routine.volume || 0.7,
        scheduledFor: adjustedTime,
        status: 'pending',
        metadata: {
          originalSchedule: `${scheduledTime.getHours()}:${scheduledTime.getMinutes().toString().padStart(2, '0')}`,
          adaptiveAdjustment: adaptiveAdjustment
        }
      });

      await notification.save();
      console.log(`📝 Created notification in DB: ${notification.title} for ${routine.user.email}`);

      // Send real-time notification via Socket.io
      await this.sendRealTimeNotification(notification, routine);

    } catch (error) {
      console.error('❌ Error creating/sending notification:', error);
    }
  }

  async sendRealTimeNotification(notification, routine) {
    try {
      if (!this.io) {
        console.error('❌ Socket.io not available for real-time notification');
        return;
      }

      const notificationData = {
        id: notification._id.toString(),
        title: routine.title,
        message: routine.description || `Time for ${routine.title}`,
        sound: routine.sound || 'chime',
        volume: routine.volume || 0.7,
        routineId: routine._id.toString(),
        timestamp: new Date(),
        type: 'alarm'
      };

      console.log(`🔔 Sending real-time notification to user ${routine.user._id}:`, {
        title: notificationData.title,
        sound: notificationData.sound,
        volume: notificationData.volume
      });

      // Send to user's room
      this.io.to(routine.user._id.toString()).emit('notification', notificationData);
      
      // Also emit to all connections for debugging
      this.io.emit('notification-broadcast', {
        ...notificationData,
        userId: routine.user._id.toString(),
        broadcast: true
      });

      // Mark as delivered
      notification.status = 'delivered';
      notification.deliveredAt = new Date();
      await notification.save();

      console.log(`✅ Notification delivered: ${routine.title}`);

    } catch (error) {
      console.error('❌ Error sending real-time notification:', error);
      
      // Update notification status to failed
      notification.status = 'failed';
      notification.deliveryAttempts += 1;
      await notification.save();
    }
  }

  async checkSnoozedNotifications() {
    try {
      const now = new Date();
      const snoozedNotifications = await Notification.find({
        status: 'snoozed',
        snoozedUntil: { $lte: now }
      }).populate('user routine');

      console.log(`⏰ Checking ${snoozedNotifications.length} snoozed notifications`);

      for (const notification of snoozedNotifications) {
        console.log(`🔔 Resending snoozed notification: ${notification.title}`);
        await this.sendRealTimeNotification(notification, notification.routine);
      }
    } catch (error) {
      console.error('❌ Error checking snoozed notifications:', error);
    }
  }

  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Notification.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        status: { $in: ['completed', 'dismissed', 'failed'] }
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
    } catch (error) {
      console.error('❌ Error cleaning up old notifications:', error);
    }
  }

  async scheduleRoutineNotifications(routine) {
    try {
      console.log(`📅 Scheduling notifications for routine: ${routine.title}`);
      
      if (!routine.isActive) {
        console.log(`⏸️ Routine ${routine.title} is inactive, skipping scheduling`);
        return;
      }

      // Delete any existing pending notifications for this routine
      await Notification.deleteMany({
        routine: routine._id,
        status: { $in: ['pending', 'snoozed'] }
      });

      console.log(`✅ Prepared routine ${routine.title} for scheduling`);
      
    } catch (error) {
      console.error('❌ Error scheduling routine notifications:', error);
    }
  }

  async cancelRoutineNotifications(routineId) {
    try {
      const result = await Notification.updateMany(
        { 
          routine: routineId,
          status: { $in: ['pending', 'snoozed'] }
        },
        { 
          status: 'cancelled',
          cancelledAt: new Date()
        }
      );
      
      console.log(`🗑️ Cancelled ${result.modifiedCount} notifications for routine ${routineId}`);
    } catch (error) {
      console.error('❌ Error cancelling routine notifications:', error);
    }
  }

  async updateAdaptiveTiming(routineId, userResponse) {
    try {
      const routine = await Routine.findById(routineId);
      if (!routine || !routine.adaptiveTiming?.enabled) return;

      const { action, responseTime } = userResponse;
      let adjustment = routine.adaptiveTiming.adjustment || 0;

      // Adjust timing based on user response
      switch (action) {
        case 'completed':
          if (responseTime < 30) {
            // Fast completion - slightly reduce timing
            adjustment = Math.max(-10, adjustment - 1);
          } else if (responseTime > 120) {
            // Slow completion - increase timing
            adjustment = Math.min(10, adjustment + 2);
          }
          break;
          
        case 'dismissed':
          adjustment = Math.min(15, adjustment + 5);
          break;
          
        case 'snoozed':
          adjustment = Math.min(10, adjustment + 3);
          break;
      }

      // Update routine with new adjustment
      routine.adaptiveTiming.adjustment = adjustment;
      routine.adaptiveTiming.lastAdjustment = new Date();
      await routine.save();
      
      console.log(`📊 Updated adaptive timing for ${routine.title}: ${adjustment}min adjustment`);

    } catch (error) {
      console.error('❌ Error updating adaptive timing:', error);
    }
  }

  // New method to manually trigger a notification for testing
  async triggerTestNotification(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const testRoutine = {
        _id: 'test-routine-123',
        title: 'Test Notification',
        description: 'This is a test notification',
        sound: 'chime',
        volume: 0.7,
        user: user
      };

      const notificationData = {
        id: 'test-' + Date.now(),
        title: 'Test Notification',
        message: 'This is a test notification to verify sound works',
        sound: 'chime',
        volume: 0.7,
        routineId: 'test-routine-123',
        timestamp: new Date(),
        type: 'alarm'
      };

      if (this.io) {
        this.io.to(userId.toString()).emit('notification', notificationData);
        console.log(`✅ Test notification sent to user ${userId}`);
      }

      return notificationData;
    } catch (error) {
      console.error('❌ Error triggering test notification:', error);
      throw error;
    }
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Notification scheduler stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastChecked: new Date(),
      activeCronJobs: 3 // scheduler, snooze checker, cleanup
    };
  }
}

module.exports = NotificationScheduler;