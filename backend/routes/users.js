const express = require('express');
const router = express.Router();
const User = require('../models/User');
const UserMetric = require('../models/UserMetric');
const auth = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferences: req.body },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get user metrics
router.get('/metrics', auth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 1;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const metrics = await UserMetric.find({
      user: req.user.id,
      date: { $gte: startDate }
    }).sort({ date: 1 });
    
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user responsiveness
router.patch('/responsiveness', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          'responsiveness.lastActive': new Date(),
          ...req.body 
        } 
      },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

