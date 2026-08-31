const mongoose = require('mongoose');

const userMetricSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Daily counters
  notificationsSent: {
    type: Number,
    default: 0
  },
  notificationsCompleted: {
    type: Number,
    default: 0
  },
  notificationsDismissed: {
    type: Number,
    default: 0
  },
  notificationsSnoozed: {
    type: Number,
    default: 0
  },
  totalNotifications: {
    type: Number,
    default: 0
  },
  // Response time metrics
  totalResponseTime: {
    type: Number,
    default: 0
  },
  responseCount: {
    type: Number,
    default: 0
  },
  // Productivity metrics
  productiveHours: {
    type: Number,
    default: 0
  },
  breaksTaken: {
    type: Number,
    default: 0
  },
  // Calculated metrics
  completionRate: {
    type: Number,
    default: 0
  },
  averageResponseTime: {
    type: Number,
    default: 0
  },
  productivityScore: {
    type: Number,
    default: 0
  },
  engagementScore: {
    type: Number,
    default: 0
  }
});

// Compound index for efficient queries
userMetricSchema.index({ user: 1, date: 1 }, { unique: true });

// Pre-save middleware to calculate derived metrics
userMetricSchema.pre('save', function(next) {
  // Calculate completion rate
  if (this.totalNotifications > 0) {
    this.completionRate = (this.notificationsCompleted / this.totalNotifications) * 100;
  }
  
  // Calculate average response time
  if (this.responseCount > 0) {
    this.averageResponseTime = this.totalResponseTime / this.responseCount;
  }
  
  // Calculate productivity score (simplified formula)
  this.productivityScore = this.calculateProductivityScore();
  
  // Calculate engagement score
  this.engagementScore = this.calculateEngagementScore();
  
  next();
});

// Method to calculate productivity score
userMetricSchema.methods.calculateProductivityScore = function() {
  let score = 0;
  
  // Completion rate contributes 60%
  score += this.completionRate * 0.6;
  
  // Fast responses contribute 20%
  const responseBonus = Math.max(0, 20 - (this.averageResponseTime / 10));
  score += responseBonus;
  
  // Productive hours contribute 20%
  const hoursBonus = Math.min(20, this.productiveHours * 2);
  score += hoursBonus;
  
  return Math.min(100, Math.max(0, score));
};

// Method to calculate engagement score
userMetricSchema.methods.calculateEngagementScore = function() {
  if (this.totalNotifications === 0) return 0;
  
  const completionWeight = 0.5;
  const responseWeight = 0.3;
  const diversityWeight = 0.2;
  
  const completionScore = (this.notificationsCompleted / this.totalNotifications) * 100;
  const responseScore = Math.max(0, 100 - (this.averageResponseTime || 0));
  const diversityScore = (this.breaksTaken > 0 ? 100 : 0) * 0.5 + 
                        (this.productiveHours > 4 ? 100 : 50) * 0.5;
  
  return (completionScore * completionWeight) + 
         (responseScore * responseWeight) + 
         (diversityScore * diversityWeight);
};

// Static method to update metrics for a user response
userMetricSchema.statics.updateForResponse = async function(userId, action, responseTime) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const update = {
    $inc: {
      totalNotifications: 1,
      [`notifications${action.charAt(0).toUpperCase() + action.slice(1)}`]: 1
    }
  };
  
  if (responseTime) {
    update.$inc.totalResponseTime = responseTime;
    update.$inc.responseCount = 1;
  }
  
  if (action === 'completed') {
    update.$inc.productiveHours = 0.5; // Assume 30 minutes of productive time per completion
  }
  
  return this.findOneAndUpdate(
    { user: userId, date: today },
    update,
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('UserMetric', userMetricSchema);
