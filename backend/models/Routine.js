const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  time: {
    type: String,
    required: true,
    validate: {
      validator: function(time) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: 'Time must be in HH:MM format'
    }
  },
  days: [{
    type: Number,
    required: true,
    min: 0,
    max: 6
  }]
});

const routineSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Routine title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Routine description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    enum: ['work', 'break', 'exercise', 'meeting', 'personal', 'health'],
    default: 'personal'
  },
  schedule: [scheduleSchema],
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
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  adaptiveTiming: {
    enabled: { type: Boolean, default: true },
    adjustment: { type: Number, default: 0 },
    lastAdjustment: { type: Date }
  },
  notificationSettings: {
    snoozeDuration: { type: Number, default: 5, min: 1, max: 30 },
    maxSnoozes: { type: Number, default: 3, min: 0, max: 10 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Routine', routineSchema);
