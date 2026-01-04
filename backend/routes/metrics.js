const express = require('express');
const router = express.Router();
const UserMetric = require('../models/UserMetric');
const Routine = require('../models/Routine');
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Helper function to calculate completion rate
const calculateCompletionRate = (notifications) => {
  if (!notifications || notifications.length === 0) return 0;
  
  const completed = notifications.filter(n => n.status === 'completed').length;
  return (completed / notifications.length) * 100;
};

// Helper function to calculate average response time
const calculateAverageResponseTime = (notifications) => {
  const responses = notifications.filter(n => 
    n.userResponse && n.userResponse.responseTime && n.status === 'completed'
  );
  
  if (responses.length === 0) return 0;
  
  const totalTime = responses.reduce((sum, n) => sum + n.userResponse.responseTime, 0);
  return totalTime / responses.length;
};

// Helper function to calculate productivity score
const calculateProductivityScore = (completionRate, avgResponseTime, productiveHours) => {
  let score = 0;
  
  // Completion rate contributes 40%
  score += completionRate * 0.4;
  
  // Response time contributes 30% (faster is better)
  const responseScore = Math.max(0, 30 - (avgResponseTime / 10));
  score += responseScore;
  
  // Productive hours contribute 30% (max 8 hours per day = 100%)
  const hoursScore = Math.min(30, (productiveHours / 8) * 30);
  score += hoursScore;
  
  return Math.min(100, Math.max(0, score));
};

// Helper function to identify peak hours
const identifyPeakHours = (notifications) => {
  const hourCounts = Array(24).fill(0);
  
  notifications.forEach(notification => {
    if (notification.deliveredAt && notification.status === 'completed') {
      const hour = new Date(notification.deliveredAt).getHours();
      hourCounts[hour]++;
    }
  });
  
  const maxCount = Math.max(...hourCounts);
  if (maxCount === 0) return [];
  
  return hourCounts
    .map((count, hour) => ({ hour, count, percentage: (count / maxCount) * 100 }))
    .filter(item => item.percentage > 70)
    .map(item => item.hour)
    .sort((a, b) => a - b);
};

// Get comprehensive analytics
router.get('/analytics', auth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    let days;
    
    switch (period) {
      case '1d': days = 1; break;
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      default: days = parseInt(period) || 7;
    }
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get metrics data
    const metrics = await UserMetric.find({
      user: req.user.id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    // Get notifications for the period
    const notifications = await Notification.find({
      user: req.user.id,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('routine', 'title category');
    
    // Get routine statistics
    const routines = await Routine.find({ user: req.user.id });
    const routineStats = await Routine.aggregate([
      { $match: { user: req.user.id } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          avgPriority: { $avg: '$priority' }
        }
      }
    ]);
    
    // Calculate key metrics
    const completionRate = calculateCompletionRate(notifications);
    const avgResponseTime = calculateAverageResponseTime(notifications);
    
    // Calculate productive hours from metrics
    const totalProductiveHours = metrics.reduce((sum, metric) => sum + (metric.productiveHours || 0), 0);
    const avgProductiveHours = metrics.length > 0 ? totalProductiveHours / metrics.length : 0;
    
    const productivityScore = calculateProductivityScore(
      completionRate,
      avgResponseTime,
      avgProductiveHours
    );
    
    // Get notification trends by day
    const notificationTrends = await Notification.aggregate([
      {
        $match: {
          user: req.user.id,
          createdAt: { $gte: startDate, $lte: endDate }
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
          dismissed: {
            $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] }
          },
          snoozed: {
            $sum: { $cond: [{ $eq: ['$status', 'snoozed'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Calculate category performance
    const categoryPerformance = {};
    const categories = ['work', 'break', 'exercise', 'meeting', 'personal', 'health'];
    
    for (const category of categories) {
      const categoryNotifications = notifications.filter(n => 
        n.routine && n.routine.category === category
      );
      
      if (categoryNotifications.length > 0) {
        const catCompletionRate = calculateCompletionRate(categoryNotifications);
        const catAvgResponseTime = calculateAverageResponseTime(categoryNotifications);
        
        categoryPerformance[category] = {
          total: categoryNotifications.length,
          completed: categoryNotifications.filter(n => n.status === 'completed').length,
          completionRate: catCompletionRate,
          avgResponseTime: catAvgResponseTime
        };
      }
    }
    
    // Identify peak hours
    const peakHours = identifyPeakHours(notifications);
    
    res.json({
      period: {
        start: startDate,
        end: endDate,
        days
      },
      summary: {
        totalRoutines: routines.length,
        activeRoutines: routines.filter(r => r.isActive).length,
        totalNotifications: notifications.length,
        completedNotifications: notifications.filter(n => n.status === 'completed').length,
        completionRate: Math.round(completionRate * 100) / 100,
        averageResponseTime: Math.round(avgResponseTime * 100) / 100,
        productivityScore: Math.round(productivityScore * 100) / 100,
        peakHours: peakHours.map(h => `${h}:00`)
      },
      metrics: metrics.map(m => ({
        date: m.date,
        completionRate: m.completionRate,
        averageResponseTime: m.averageResponseTime,
        productivityScore: m.productivityScore,
        notificationsSent: m.notificationsSent,
        notificationsCompleted: m.notificationsCompleted
      })),
      routineStats,
      notificationTrends,
      categoryPerformance,
      insights: generateInsights(completionRate, avgResponseTime, productivityScore, routines)
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching analytics data',
      error: error.message 
    });
  }
});

// Generate insights based on metrics
const generateInsights = (completionRate, avgResponseTime, productivityScore, routines) => {
  const insights = [];
  
  // Completion rate insights
  if (completionRate < 50) {
    insights.push({
      type: 'warning',
      title: 'Low Completion Rate',
      message: `Your completion rate is ${Math.round(completionRate)}%. Try adjusting notification timing or reducing frequency.`,
      suggestion: 'Consider scheduling routines during your most productive hours.',
      priority: 1
    });
  } else if (completionRate > 80) {
    insights.push({
      type: 'success',
      title: 'Excellent Completion Rate',
      message: `You're completing ${Math.round(completionRate)}% of your tasks. Great work!`,
      suggestion: 'Maintain this momentum by keeping your routine schedule consistent.',
      priority: 3
    });
  }
  
  // Response time insights
  if (avgResponseTime > 120) {
    insights.push({
      type: 'warning',
      title: 'Slow Response Time',
      message: `Your average response time is ${Math.round(avgResponseTime)} seconds.`,
      suggestion: 'Try enabling louder sounds or placing your device closer.',
      priority: 2
    });
  } else if (avgResponseTime < 30 && avgResponseTime > 0) {
    insights.push({
      type: 'success',
      title: 'Quick Responses',
      message: `You respond in just ${Math.round(avgResponseTime)} seconds on average.`,
      suggestion: 'Your quick response time shows great engagement!',
      priority: 3
    });
  }
  
  // Productivity score insights
  if (productivityScore < 40) {
    insights.push({
      type: 'warning',
      title: 'Low Productivity Score',
      message: `Your productivity score is ${Math.round(productivityScore)}%.`,
      suggestion: 'Focus on completing tasks and responding promptly to improve your score.',
      priority: 1
    });
  } else if (productivityScore > 70) {
    insights.push({
      type: 'success',
      title: 'High Productivity',
      message: `Your productivity score is ${Math.round(productivityScore)}% - excellent!`,
      suggestion: 'Consider sharing your routine tips with others.',
      priority: 3
    });
  }
  
  // Routine count insights
  const activeRoutines = routines.filter(r => r.isActive).length;
  if (activeRoutines === 0) {
    insights.push({
      type: 'info',
      title: 'No Active Routines',
      message: 'You have no active routines set up.',
      suggestion: 'Create your first routine to start building habits.',
      priority: 1
    });
  } else if (activeRoutines > 10) {
    insights.push({
      type: 'warning',
      title: 'Many Active Routines',
      message: `You have ${activeRoutines} active routines. This might be overwhelming.`,
      suggestion: 'Consider consolidating or disabling some routines.',
      priority: 2
    });
  }
  
  // Sort insights by priority
  return insights.sort((a, b) => a.priority - b.priority);
};

// Get productivity insights
router.get('/insights', auth, async (req, res) => {
  try {
    const recentMetrics = await UserMetric.find({
      user: req.user.id
    })
    .sort({ date: -1 })
    .limit(10);
    
    const notifications = await Notification.find({
      user: req.user.id,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });
    
    const routines = await Routine.find({ user: req.user.id });
    
    if (recentMetrics.length === 0) {
      return res.json({ insights: generateInsights(0, 0, 0, []) });
    }
    
    const latestMetric = recentMetrics[0];
    const completionRate = latestMetric.completionRate || 0;
    const avgResponseTime = latestMetric.averageResponseTime || 0;
    const productivityScore = latestMetric.productivityScore || 0;
    
    const insights = generateInsights(completionRate, avgResponseTime, productivityScore, routines);
    
    res.json({ insights });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error generating insights',
      error: error.message 
    });
  }
});

// Get daily productivity data
router.get('/daily', auth, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Get metrics for the day
    const metric = await UserMetric.findOne({
      user: req.user.id,
      date: { $gte: targetDate, $lt: nextDay }
    });
    
    // Get notifications for the day
    const notifications = await Notification.find({
      user: req.user.id,
      createdAt: { $gte: targetDate, $lt: nextDay }
    }).populate('routine', 'title category');
    
    // Calculate completion rate for the day
    const dailyCompletionRate = calculateCompletionRate(notifications);
    const dailyAvgResponseTime = calculateAverageResponseTime(notifications);
    
    res.json({
      date: targetDate,
      metric: metric || {},
      notifications,
      dailyStats: {
        total: notifications.length,
        completed: notifications.filter(n => n.status === 'completed').length,
        completionRate: dailyCompletionRate,
        averageResponseTime: dailyAvgResponseTime
      }
    });
  } catch (error) {
    console.error('Daily analytics error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching daily data',
      error: error.message 
    });
  }
});

// Export the router
module.exports = router;