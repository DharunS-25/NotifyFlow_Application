// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROUTINE_CATEGORIES } from '../config';

const Dashboard = ({ 
  routines = [], 
  notifications = [], 
  onToggleRoutine, 
  onNavigateToRoutines,
  onNavigateToAnalytics,
  onNavigateToSettings 
}) => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState({
    activeRoutines: 0,
    completedToday: 0,
    productivityScore: 0,
    nextNotification: null
  });
  
  // Local state for routines with updating status
  const [localRoutines, setLocalRoutines] = useState(routines || []);

  // Update local routines when prop changes
  useEffect(() => {
    setLocalRoutines(routines || []);
  }, [routines]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    calculateStats();

    return () => clearInterval(timer);
  }, [localRoutines, notifications]);

  const calculateStats = () => {
    const safeRoutines = localRoutines || [];
    const safeNotifications = notifications || [];

    const activeRoutines = safeRoutines.filter(r => r.isActive).length;
    
    const completedToday = safeNotifications.filter(n => 
      n.status === 'completed' && 
      n.deliveredAt && 
      new Date(n.deliveredAt).toDateString() === new Date().toDateString()
    ).length;

    const totalNotifications = safeNotifications.length;
    const completedNotifications = safeNotifications.filter(n => n.status === 'completed').length;
    const productivityScore = totalNotifications > 0 
      ? Math.round((completedNotifications / totalNotifications) * 100) 
      : 0;

    // Find next scheduled notification
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    let nextNotification = null;
    safeRoutines.forEach(routine => {
      if (routine.isActive && routine.schedule) {
        routine.schedule.forEach(schedule => {
          if (schedule.time && schedule.days) {
            const [hours, minutes] = schedule.time.split(':').map(Number);
            const scheduleTime = hours * 60 + minutes;
            
            if (scheduleTime > currentTime && schedule.days.includes(now.getDay())) {
              if (!nextNotification || scheduleTime < nextNotification.time) {
                nextNotification = {
                  routine: routine.title,
                  time: schedule.time,
                  scheduleTime
                };
              }
            }
          }
        });
      }
    });

    setStats({
      activeRoutines,
      completedToday,
      productivityScore,
      nextNotification
    });
  };

  const handleToggleRoutine = async (routineId) => {
    try {
      console.log(`🔄 Toggling routine ${routineId} from Dashboard`);
      
      // Show loading state
      setLocalRoutines(prev =>
        prev.map(routine =>
          routine._id === routineId 
            ? { ...routine, _isUpdating: true }
            : routine
        )
      );
      
      // Call the toggle function
      if (onToggleRoutine) {
        const result = await onToggleRoutine(routineId);
        console.log(`✅ Routine ${routineId} toggled to ${result ? 'active' : 'inactive'}`);
      }
      
    } catch (error) {
      console.error('❌ Error toggling routine in Dashboard:', error);
      alert(`Failed to toggle routine: ${error.message}`);
      
      // Reset loading state on error
      setLocalRoutines(prev =>
        prev.map(routine =>
          routine._id === routineId 
            ? { ...routine, _isUpdating: false }
            : routine
        )
      );
    }
  };

  const getCategoryIcon = (category) => {
    const cat = ROUTINE_CATEGORIES.find(c => c.value === category);
    return cat ? cat.icon : '🎯';
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleAddRoutine = () => {
    if (onNavigateToRoutines) {
      onNavigateToRoutines();
    }
  };

  const handleOpenSettings = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  const handleViewAnalytics = () => {
    if (onNavigateToAnalytics) {
      onNavigateToAnalytics();
    }
  };

  // Get user's first name
  const firstName = user?.firstName || 'User';

  // Filter active routines
  const activeRoutines = localRoutines.filter(r => r.isActive);
  const inactiveRoutines = localRoutines.filter(r => !r.isActive);

  return (
    <div className="dashboard">
      {/* Header with personalized greeting */}
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {firstName}! 👋</h1>
          <p>Manage your routines and boost your productivity</p>
        </div>
        <div className="current-time">
          {currentTime.toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <h3>Active Routines</h3>
            <span className="stat-value">{stats.activeRoutines}</span>
            <span className="stat-label">out of {localRoutines.length} total</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Completed Today</h3>
            <span className="stat-value">{stats.completedToday}</span>
            <span className="stat-label">tasks completed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Productivity Score</h3>
            <span className="stat-value">{stats.productivityScore}%</span>
            <span className="stat-label">overall efficiency</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔔</div>
          <div className="stat-content">
            <h3>Next Alarm</h3>
            <span className="stat-value">
              {stats.nextNotification ? formatTime(stats.nextNotification.time) : 'None'}
            </span>
            <span className="stat-label">
              {stats.nextNotification ? stats.nextNotification.routine : 'No scheduled routines'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <button className="action-btn primary" onClick={handleAddRoutine}>
            ➕ Add New Routine
          </button>
          <button 
            className="action-btn secondary" 
            onClick={handleOpenSettings}
          >
            ⚙️ Settings
          </button>
          <button 
            className="action-btn secondary" 
            onClick={handleViewAnalytics}
          >
            📊 View Analytics
          </button>
        </div>
      </div>

      {/* Active Routines */}
      <div className="routines-section">
        <div className="section-header">
          <h2>Your Active Routines</h2>
          <span className="section-subtitle">
            {activeRoutines.length} active, {inactiveRoutines.length} inactive
          </span>
        </div>
        
        {activeRoutines.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⏰</div>
            <h3>No Active Routines</h3>
            <p>Create your first routine to start receiving smart notifications!</p>
            <button className="btn-primary" onClick={handleAddRoutine}>
              Create Your First Routine
            </button>
          </div>
        ) : (
          <div className="routines-grid">
            {activeRoutines.map(routine => (
              <div key={routine._id} className="routine-card">
                <div className="routine-header">
                  <div className="routine-title">
                    <span className="category-icon">
                      {getCategoryIcon(routine.category)}
                    </span>
                    <h3>{routine.title}</h3>
                  </div>
                  <div className="routine-actions">
                    <button 
                      className={`toggle-btn ${routine.isActive ? 'active' : ''} ${routine._isUpdating ? 'updating' : ''}`}
                      onClick={() => handleToggleRoutine(routine._id)}
                      title={routine.isActive ? 'Disable routine' : 'Enable routine'}
                      disabled={routine._isUpdating}
                    >
                      {routine._isUpdating ? '⏳' : (routine.isActive ? '🔔' : '🔕')}
                    </button>
                  </div>
                </div>
                
                <p className="routine-description">{routine.description}</p>
                
                <div className="routine-schedule">
                  {routine.schedule && routine.schedule.map((schedule, index) => (
                    <div key={index} className="schedule-item">
                      <span className="schedule-time">{formatTime(schedule.time)}</span>
                      <span className="schedule-days">
                        {schedule.days && schedule.days.map(day => 
                          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]
                        ).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="routine-footer">
                  <span className="sound-badge">
                    🔊 {routine.sound}
                  </span>
                  <span className="volume-badge">
                    Vol: {Math.round((routine.volume || 0.7) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h2>Recent Activity</h2>
        {notifications.length === 0 ? (
          <div className="empty-state-small">
            <p>No recent notifications</p>
          </div>
        ) : (
          <div className="activity-list">
            {notifications.slice(0, 5).map((notification, index) => (
              <div key={index} className="activity-item">
                <div className="activity-icon">
                  {notification.status === 'completed' ? '✅' : 
                   notification.status === 'snoozed' ? '⏰' : 
                   notification.status === 'dismissed' ? '❌' : '🔔'}
                </div>
                <div className="activity-content">
                  <p>{notification.title}</p>
                  <span className="activity-time">
                    {new Date(notification.createdAt).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <div className="activity-status">
                  <span className={`status-badge ${notification.status}`}>
                    {notification.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;