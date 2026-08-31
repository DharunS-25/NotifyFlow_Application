const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  routine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Routine',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['alarm', 'reminder', 'break', 'urgent'],
    default: 'alarm'
  },
  sound: {
    type: String,
    enum: ['chime', 'bell', 'digital', 'nature'],
    default: 'chime'
  },
  volume: {
    type: Number,
    default: 0.7,
    min: 0,
    max: 1
  },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'completed', 'dismissed', 'snoozed'],
    default: 'pending',
    index: true
  },
  userResponse: {
    action: { 
      type: String, 
      enum: ['completed', 'snoozed', 'dismissed', 'ignored'] 
    },
    responseTime: { type: Number }, // seconds to respond
    timestamp: { type: Date }
  },
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  scheduledFor: {
    type: Date,
    required: true,
    index: true
  },
  deliveredAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  snoozedUntil: {
    type: Date
  },
  metadata: {
    originalSchedule: { type: String }, // Original scheduled time
    adaptiveAdjustment: { type: Number, default: 0 } // Applied timing adjustment
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
notificationSchema.index({ user: 1, status: 1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ routine: 1, createdAt: -1 });

// Method to mark as delivered
notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  this.deliveryAttempts += 1;
  return this.save();
};

// Method to handle user response
notificationSchema.methods.handleUserResponse = function(action, responseTime) {
  this.status = action === 'snoozed' ? 'snoozed' : action;
  this.userResponse = {
    action,
    responseTime,
    timestamp: new Date()
  };
  
  if (action === 'completed') {
    this.completedAt = new Date();
  } else if (action === 'snoozed') {
    this.snoozedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  }
  
  return this.save();
};

// Static method to get pending notifications
notificationSchema.statics.getPendingNotifications = function() {
  return this.find({
    status: 'pending',
    scheduledFor: { $lte: new Date() }
  }).populate('user routine');
};

module.exports = mongoose.model('Notification', notificationSchema);
