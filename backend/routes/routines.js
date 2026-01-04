const express = require('express');
const router = express.Router();
const Routine = require('../models/Routine');
const auth = require('../middleware/auth');

// Get all routines for user
router.get('/', auth, async (req, res) => {
  try {
    const routines = await Routine.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: routines.length,
      routines
    });
  } catch (error) {
    console.error('Error fetching routines:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Get specific routine
router.get('/:id', auth, async (req, res) => {
  try {
    const routine = await Routine.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!routine) {
      return res.status(404).json({ 
        success: false,
        message: 'Routine not found' 
      });
    }
    
    res.json({
      success: true,
      routine
    });
  } catch (error) {
    console.error('Error fetching routine:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Create new routine
router.post('/', auth, async (req, res) => {
  try {
    const routine = new Routine({
      ...req.body,
      user: req.user.id
    });
    
    await routine.save();
    
    // Schedule notifications for this routine
    try {
      const NotificationScheduler = require('../utils/notificationScheduler');
      const notificationScheduler = new NotificationScheduler();
      await notificationScheduler.scheduleRoutineNotifications(routine);
    } catch (schedulerError) {
      console.warn('⚠️ Warning: Could not schedule notifications:', schedulerError.message);
      // Don't fail the routine creation if scheduling fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Routine created successfully',
      routine
    });
  } catch (error) {
    console.error('Error creating routine:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Update routine
router.put('/:id', auth, async (req, res) => {
  try {
    const routine = await Routine.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!routine) {
      return res.status(404).json({ 
        success: false,
        message: 'Routine not found' 
      });
    }
    
    // Reschedule notifications if schedule changed
    if (req.body.schedule || req.body.isActive !== undefined) {
      try {
        const NotificationScheduler = require('../utils/notificationScheduler');
        const notificationScheduler = new NotificationScheduler();
        await notificationScheduler.scheduleRoutineNotifications(routine);
      } catch (schedulerError) {
        console.warn('⚠️ Warning: Could not reschedule notifications:', schedulerError.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Routine updated successfully',
      routine
    });
  } catch (error) {
    console.error('Error updating routine:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error', 
        errors: Object.values(error.errors).map(e => e.message) 
      });
    }
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Delete routine
router.delete('/:id', auth, async (req, res) => {
  try {
    const routine = await Routine.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!routine) {
      return res.status(404).json({ 
        success: false,
        message: 'Routine not found' 
      });
    }
    
    // Cancel scheduled notifications
    const Notification = require('../models/Notification');
    await Notification.deleteMany({ routine: req.params.id });
    
    res.json({ 
      success: true,
      message: 'Routine deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting routine:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// ============================================
// TOGGLE ROUTINE ACTIVE STATUS - FIXED VERSION
// ============================================
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    console.log(`🔄 Toggling routine ${req.params.id} for user ${req.user.id}`);
    
    const routine = await Routine.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!routine) {
      return res.status(404).json({ 
        success: false,
        message: 'Routine not found' 
      });
    }
    
    // Toggle the active status
    routine.isActive = !routine.isActive;
    routine.updatedAt = new Date();
    
    await routine.save();
    
    console.log(`✅ Routine "${routine.title}" ${routine.isActive ? 'activated' : 'deactivated'}`);
    
    // Reschedule notifications based on active status
    try {
      const NotificationScheduler = require('../utils/notificationScheduler');
      const io = req.app.get('io');
      const notificationScheduler = new NotificationScheduler(io);
      await notificationScheduler.scheduleRoutineNotifications(routine);
    } catch (schedulerError) {
      console.warn('⚠️ Warning: Could not reschedule notifications:', schedulerError.message);
    }
    
    // Return the updated routine
    res.json({
      success: true,
      message: `Routine ${routine.isActive ? 'activated' : 'deactivated'} successfully`,
      routine: routine
    });
    
  } catch (error) {
    console.error('❌ Error toggling routine:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to toggle routine status',
      error: error.message 
    });
  }
});

// Schedule notifications for a routine
router.post('/:id/schedule', auth, async (req, res) => {
  try {
    const routine = await Routine.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!routine) {
      return res.status(404).json({ 
        success: false,
        message: 'Routine not found' 
      });
    }
    
    console.log(`📅 Scheduling notifications for routine: ${routine.title}`);
    
    // Import the notification scheduler
    const NotificationScheduler = require('../utils/notificationScheduler');
    const io = req.app.get('io');
    const notificationScheduler = new NotificationScheduler(io);
    
    // Schedule notifications
    await notificationScheduler.scheduleRoutineNotifications(routine);
    
    res.json({ 
      success: true, 
      message: 'Notifications scheduled successfully' 
    });
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Cancel all notifications for a routine
router.delete('/:id/notifications', auth, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const routine = await Routine.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!routine) {
      return res.status(404).json({ 
        success: false,
        message: 'Routine not found' 
      });
    }
    
    console.log(`🗑️ Cancelling notifications for routine: ${routine.title}`);
    
    const result = await Notification.deleteMany({ 
      routine: req.params.id,
      user: req.user.id,
      status: { $in: ['pending', 'snoozed'] }
    });
    
    res.json({ 
      success: true, 
      message: 'Notifications cancelled',
      cancelledCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error cancelling notifications:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Update notifications for a routine
router.put('/:id/notifications', auth, async (req, res) => {
  try {
    const routine = await Routine.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!routine) {
      return res.status(404).json({ 
        success: false,
        message: 'Routine not found' 
      });
    }
    
    console.log(`🔄 Updating notifications for routine: ${routine.title}`);
    
    // First cancel existing notifications
    const Notification = require('../models/Notification');
    const deleteResult = await Notification.deleteMany({ 
      routine: req.params.id,
      user: req.user.id,
      status: { $in: ['pending', 'snoozed'] }
    });
    
    console.log(`🗑️ Cancelled ${deleteResult.deletedCount} existing notifications`);
    
    // Then schedule new notifications if routine is active
    if (routine.isActive) {
      const NotificationScheduler = require('../utils/notificationScheduler');
      const io = req.app.get('io');
      const notificationScheduler = new NotificationScheduler(io);
      await notificationScheduler.scheduleRoutineNotifications(routine);
    }
    
    res.json({ 
      success: true, 
      message: 'Notifications updated successfully',
      cancelledCount: deleteResult.deletedCount 
    });
  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

module.exports = router;