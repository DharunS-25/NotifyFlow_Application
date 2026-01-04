import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { socketService } from '../services/socket';

const DebugPanel = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }].slice(-10)); // Keep last 10 logs
  };

  const checkSchedulerStatus = async () => {
    setLoading(true);
    addLog('Checking scheduler status...', 'info');
    
    try {
      const response = await apiService.notifications.getSchedulerStatus();
      if (response.data.success) {
        setStatus(response.data);
        addLog('Scheduler status retrieved successfully', 'success');
      } else {
        addLog(`Failed to get status: ${response.data.message}`, 'error');
      }
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      console.error('Status check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSocketConnection = () => {
    const socketStatus = socketService.getConnectionStatus();
    addLog(`Socket status: ${socketStatus.isConnected ? 'Connected' : 'Disconnected'}`, 
           socketStatus.isConnected ? 'success' : 'error');
    
    if (socketStatus.isConnected) {
      addLog(`Socket ID: ${socketStatus.socketId}`, 'info');
    }
  };

  const clearNotifications = () => {
    setLogs([]);
    addLog('Logs cleared', 'info');
  };

  useEffect(() => {
    // Initial check
    checkSchedulerStatus();
    checkSocketConnection();
    
    // Add socket status listener
    const interval = setInterval(checkSocketConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h4>🔧 System Debug</h4>
        <button 
          className="debug-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      <div className="debug-actions">
        <button 
          className="btn-secondary"
          onClick={checkSchedulerStatus}
          disabled={loading}
        >
          {loading ? 'Checking...' : '🔄 Refresh Status'}
        </button>
        
        <button 
          className="btn-secondary"
          onClick={checkSocketConnection}
        >
          🔌 Check Socket
        </button>
        
        <button 
          className="btn-secondary"
          onClick={clearNotifications}
        >
          🧹 Clear Logs
        </button>
      </div>
      
      {status && (
        <div className="status-summary">
          <div className="status-item">
            <span className="status-label">Scheduler:</span>
            <span className={`status-value ${status.scheduler?.isRunning ? 'success' : 'error'}`}>
              {status.scheduler?.isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Active Routines:</span>
            <span className="status-value info">{status.stats?.activeRoutines || 0}</span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Upcoming Notifications:</span>
            <span className="status-value info">{status.stats?.upcomingNotifications || 0}</span>
          </div>
        </div>
      )}
      
      {showDetails && (
        <div className="debug-details">
          <div className="logs-container">
            <h5>Recent Logs</h5>
            <div className="logs-list">
              {logs.map((log, index) => (
                <div key={index} className={`log-item ${log.type}`}>
                  <span className="log-time">[{log.timestamp}]</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
          
          {status && (
            <div className="detailed-status">
              <h5>Detailed Status</h5>
              <pre>{JSON.stringify(status, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugPanel;