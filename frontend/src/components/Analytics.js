import React, { useState, useEffect } from 'react';

const Analytics = ({ routines = [], notifications = [], user }) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState({
    completionRate: 0,
    averageResponseTime: 0,
    productivityScore: 0,
    totalNotifications: 0,
    activeRoutines: 0,
    bestTime: 'N/A',
    mostProductiveDay: 'N/A',
    routineStats: {},
    categoryStats: {}
  });

  // Helper function to ensure data is always an array
  const ensureArray = (data) => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      // Try to extract array from object
      if (data.notifications && Array.isArray(data.notifications)) return data.notifications;
      if (data.data && Array.isArray(data.data)) return data.data;
      if (data.results && Array.isArray(data.results)) return data.results;
      
      // Check if object values are all objects (might be an object of objects)
      const values = Object.values(data);
      if (values.length > 0 && values.every(v => v && typeof v === 'object')) {
        return values;
      }
    }
    return []; // Always return empty array as fallback
  };

  useEffect(() => {
    console.log('🔍 Analytics: Routines received:', routines);
    console.log('🔍 Analytics: Notifications received:', notifications);
    console.log('🔍 Analytics: Notifications type:', typeof notifications);
    
    calculateAnalytics();
  }, [routines, notifications, timeRange]);

  const calculateAnalytics = () => {
    // Always convert to arrays first
    const safeRoutines = ensureArray(routines);
    const safeNotifications = ensureArray(notifications);
    
    console.log('📊 Safe routines count:', safeRoutines.length);
    console.log('📊 Safe notifications count:', safeNotifications.length);
    console.log('📊 First notification sample:', safeNotifications[0]);

    // Basic metrics - with null checks
    const activeRoutines = safeRoutines.filter(r => r && r.isActive).length;
    const completedNotifications = safeNotifications.filter(n => 
      n && n.status === 'completed'
    ).length;
    const totalNotifications = safeNotifications.length;
    
    const completionRate = totalNotifications > 0 ? (completedNotifications / totalNotifications) * 100 : 0;
    
    // Response time calculation - with null checks
    const responsesWithTime = safeNotifications.filter(n => 
      n && n.userResponse && typeof n.userResponse.responseTime === 'number'
    );
    
    const averageResponseTime = responsesWithTime.length > 0 
      ? responsesWithTime.reduce((sum, n) => sum + n.userResponse.responseTime, 0) / responsesWithTime.length 
      : 0;

    // Productivity score calculation
    const productivityScore = Math.max(0, Math.min(100, 
      completionRate * 0.7 + 
      (Math.max(0, 100 - averageResponseTime) * 0.3)
    ));

    // Calculate best time of day
    const bestTime = calculateBestTime(safeNotifications);
    
    // Calculate most productive day
    const mostProductiveDay = calculateMostProductiveDay(safeNotifications);
    
    // Calculate routine statistics
    const routineStats = calculateRoutineStats(safeRoutines, safeNotifications);
    
    // Calculate category statistics
    const categoryStats = calculateCategoryStats(safeRoutines, safeNotifications);

    setAnalyticsData({
      completionRate,
      averageResponseTime,
      productivityScore,
      totalNotifications,
      activeRoutines,
      bestTime,
      mostProductiveDay,
      routineStats,
      categoryStats
    });
  };

  const calculateBestTime = (notifications) => {
    if (!notifications.length) return 'N/A';
    
    const timeSlots = {
      'Morning (6AM-12PM)': 0,
      'Afternoon (12PM-6PM)': 0,
      'Evening (6PM-12AM)': 0,
      'Night (12AM-6AM)': 0
    };

    notifications.forEach(notification => {
      if (notification && notification.deliveredAt) {
        const hour = new Date(notification.deliveredAt).getHours();
        if (hour >= 6 && hour < 12) timeSlots['Morning (6AM-12PM)']++;
        else if (hour >= 12 && hour < 18) timeSlots['Afternoon (12PM-6PM)']++;
        else if (hour >= 18 && hour < 24) timeSlots['Evening (6PM-12AM)']++;
        else timeSlots['Night (12AM-6AM)']++;
      }
    });

    const bestSlot = Object.entries(timeSlots).reduce((best, [slot, count]) => 
      count > best.count ? { slot, count } : best, 
      { slot: 'N/A', count: 0 }
    );

    return bestSlot.count > 0 ? bestSlot.slot : 'N/A';
  };

  const calculateMostProductiveDay = (notifications) => {
    if (!notifications.length) return 'N/A';
    
    const dayCounts = {
      'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
      'Thursday': 0, 'Friday': 0, 'Saturday': 0
    };

    notifications
      .filter(n => n && n.status === 'completed' && n.completedAt)
      .forEach(notification => {
        const day = new Date(notification.completedAt).toLocaleDateString('en-US', { weekday: 'long' });
        dayCounts[day]++;
      });

    const mostProductive = Object.entries(dayCounts).reduce((best, [day, count]) => 
      count > best.count ? { day, count } : best, 
      { day: 'N/A', count: 0 }
    );

    return mostProductive.count > 0 ? mostProductive.day : 'N/A';
  };

  const calculateRoutineStats = (routines, notifications) => {
    const stats = {};
    
    routines.forEach(routine => {
      if (!routine || !routine._id) return;
      
      const routineNotifications = notifications.filter(n => 
        n && n.routine && n.routine._id === routine._id
      );
      
      const completed = routineNotifications.filter(n => n.status === 'completed').length;
      const total = routineNotifications.length;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      
      stats[routine._id] = {
        name: routine.title || 'Unnamed Routine',
        total,
        completed,
        completionRate
      };
    });
    
    return stats;
  };

  const calculateCategoryStats = (routines, notifications) => {
    const stats = {};
    const categories = ['work', 'break', 'exercise', 'meeting', 'personal', 'health'];
    
    categories.forEach(category => {
      const categoryRoutines = routines.filter(r => r && r.category === category);
      const categoryNotifications = notifications.filter(n => 
        n && n.routine && categoryRoutines.some(r => r._id === n.routine._id)
      );
      
      const completed = categoryNotifications.filter(n => n.status === 'completed').length;
      const total = categoryNotifications.length;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      
      stats[category] = {
        total,
        completed,
        completionRate,
        routineCount: categoryRoutines.length
      };
    });
    
    return stats;
  };

  const getProductivityLevel = (score) => {
    if (score >= 80) return { level: 'Excellent', color: '#4CAF50', emoji: '🎉' };
    if (score >= 60) return { level: 'Good', color: '#FF9800', emoji: '👍' };
    if (score >= 40) return { level: 'Fair', color: '#FFC107', emoji: '😊' };
    return { level: 'Needs Improvement', color: '#F44336', emoji: '💪' };
  };

  const generateInsights = () => {
    const insights = [];
    const { completionRate, averageResponseTime, productivityScore, activeRoutines } = analyticsData;

    // Completion rate insights
    if (completionRate < 50) {
      insights.push({
        type: 'warning',
        title: 'Low Completion Rate',
        message: `Your completion rate is ${Math.round(completionRate)}%. Consider adjusting notification timing or reducing frequency.`,
        suggestion: 'Try scheduling routines during your most productive hours.'
      });
    } else if (completionRate > 80) {
      insights.push({
        type: 'success',
        title: 'Great Completion Rate!',
        message: `You're completing ${Math.round(completionRate)}% of your tasks. Keep up the good work!`,
        suggestion: 'Consider adding more challenging routines to maintain momentum.'
      });
    }

    // Response time insights
    if (averageResponseTime > 120) {
      insights.push({
        type: 'info',
        title: 'Slow Response Time',
        message: `Your average response time is ${Math.round(averageResponseTime)} seconds. Faster responses can improve productivity.`,
        suggestion: 'Enable louder alarm sounds or place your device closer.'
      });
    } else if (averageResponseTime < 30 && averageResponseTime > 0) {
      insights.push({
        type: 'success',
        title: 'Quick Responses!',
        message: `You're responding to notifications in just ${Math.round(averageResponseTime)} seconds on average.`,
        suggestion: 'Your quick response time shows great engagement with your routines.'
      });
    }

    // Routine count insights
    if (activeRoutines === 0) {
      insights.push({
        type: 'info',
        title: 'No Active Routines',
        message: 'You currently have no active routines set up.',
        suggestion: 'Create your first routine to start tracking your productivity.'
      });
    } else if (activeRoutines < 3) {
      insights.push({
        type: 'suggestion',
        title: 'Expand Your Routines',
        message: `You have ${activeRoutines} active routine${activeRoutines === 1 ? '' : 's'}.`,
        suggestion: 'Consider adding more routines to build better habits.'
      });
    }

    // Productivity score insights
    if (productivityScore < 40) {
      insights.push({
        type: 'warning',
        title: 'Low Productivity Score',
        message: `Your productivity score is ${Math.round(productivityScore)}%. There's room for improvement.`,
        suggestion: 'Focus on completing tasks and responding faster to notifications.'
      });
    }

    // Default insight if no specific ones apply
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'Good Progress',
        message: 'Your productivity metrics are looking good. Continue with your current routine setup.',
        suggestion: 'Consider experimenting with different notification sounds or schedules.'
      });
    }

    return insights;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      work: '💼',
      break: '☕',
      exercise: '💪',
      meeting: '👥',
      personal: '🎯',
      health: '❤️'
    };
    return icons[category] || '📊';
  };

  const productivityLevel = getProductivityLevel(analyticsData.productivityScore);
  const insights = generateInsights();

  return (
    <div className="analytics">
      <div className="page-header">
        <h1>Analytics & Insights</h1>
        <div className="time-range-selector">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card large">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Productivity Score</h3>
            <div className="metric-value" style={{ color: productivityLevel.color }}>
              {Math.round(analyticsData.productivityScore)}%
            </div>
            <div className="metric-trend">
              <span style={{ color: productivityLevel.color }}>
                {productivityLevel.emoji} {productivityLevel.level}
              </span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <h3>Completion Rate</h3>
            <div className="metric-value">{Math.round(analyticsData.completionRate)}%</div>
            <div className="metric-label">tasks completed</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏱️</div>
          <div className="metric-content">
            <h3>Avg Response Time</h3>
            <div className="metric-value">{Math.round(analyticsData.averageResponseTime)}s</div>
            <div className="metric-label">time to respond</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏰</div>
          <div className="metric-content">
            <h3>Active Routines</h3>
            <div className="metric-value">{analyticsData.activeRoutines}</div>
            <div className="metric-label">currently active</div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-section">
        <h3>Detailed Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total Routines</span>
            <span className="stat-value">{ensureArray(routines).length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Notifications Sent</span>
            <span className="stat-value">{analyticsData.totalNotifications}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Best Time</span>
            <span className="stat-value">{analyticsData.bestTime}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Most Productive</span>
            <span className="stat-value">{analyticsData.mostProductiveDay}</span>
          </div>
        </div>
      </div>

      {/* Category Performance */}
      {Object.keys(analyticsData.categoryStats).length > 0 && (
        <div className="category-stats">
          <h3>Category Performance</h3>
          <div className="category-grid">
            {Object.entries(analyticsData.categoryStats).map(([category, stats]) => (
              stats.total > 0 && (
                <div key={category} className="category-card">
                  <div className="category-header">
                    <span className="category-icon">{getCategoryIcon(category)}</span>
                    <span className="category-name">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                  </div>
                  <div className="category-stats">
                    <div className="stat">
                      <span className="stat-value">{stats.completed}/{stats.total}</span>
                      <span className="stat-label">Completed</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{Math.round(stats.completionRate)}%</span>
                      <span className="stat-label">Rate</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{stats.routineCount}</span>
                      <span className="stat-label">Routines</span>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="insights-card">
        <h3>Performance Insights</h3>
        <div className="insights-list">
          {insights.map((insight, index) => (
            <div key={index} className={`insight-item ${insight.type}`}>
              <span className="insight-icon">
                {insight.type === 'success' ? '🎉' : 
                 insight.type === 'warning' ? '⚠️' : 
                 insight.type === 'info' ? '💡' : '✨'}
              </span>
              <div className="insight-content">
                <strong>{insight.title}</strong>
                <p>{insight.message}</p>
                <small className="suggestion">{insight.suggestion}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;