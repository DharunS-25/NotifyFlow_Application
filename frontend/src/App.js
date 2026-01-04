import React, { useEffect, useState, useCallback } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  useLocation,
  useParams 
} from 'react-router-dom';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/Dashboard';
import RoutineManager from './components/RoutineManager';
import AddRoutine from './components/AddRoutine';
import Analytics from './components/Analytics';
import SoundSettings from './components/SoundSettings';
import NotificationModal from './components/NotificationModal';

// Services
import { socketService } from './services/socket';
import { soundService } from './services/soundService';
import { apiService } from './services/api';

// Hooks
import { useRoutines } from './hooks/useRoutines';
import { useNotifications } from './hooks/useNotifications';

// Styles
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

// Public Route Component
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Edit Routine Wrapper Component
const EditRoutineWrapper = ({ routines, onUpdateRoutine, onDeleteRoutine, onTestSound }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('Looking for routine with ID:', id);
    
    const foundRoutine = routines.find(r => r._id === id);
    
    if (foundRoutine) {
      console.log('Routine found:', foundRoutine.title);
      setRoutine(foundRoutine);
      setError(null);
    } else {
      console.log('Routine not found');
      setError('Routine not found');
    }
    
    setLoading(false);
  }, [id, routines]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading routine data...</p>
      </div>
    );
  }

  if (error || !routine) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Routine Not Found</h3>
        <p>The routine you're trying to edit doesn't exist.</p>
        <button 
          className="btn-primary" 
          onClick={() => navigate('/routines')}
        >
          Back to Routines
        </button>
      </div>
    );
  }

  return (
    <AddRoutine 
      key={routine._id}
      routine={routine}
      onSaveRoutine={(updates) => onUpdateRoutine(id, updates)}
      onCancel={() => navigate('/routines')}
      onDelete={() => onDeleteRoutine(id)}
      onTestSound={onTestSound}
      isEditing={true}
    />
  );
};

// Main Layout Component
const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const {
    routines,
    loading: routinesLoading,
    error: routinesError,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    toggleRoutineActive,
    loadRoutines,
  } = useRoutines();

  const {
    notifications,
    currentNotification,
    loading: notificationsLoading,
    error: notificationsError,
    addNotification,
    handleNotificationResponse,
    clearCurrentNotification,
    loadNotifications,
    testNotificationSound,
    responseTime,
  } = useNotifications();

  const loading = routinesLoading || notificationsLoading;
  const error = routinesError || notificationsError;

  const [soundStatus, setSoundStatus] = useState({
    isMuted: soundService.getStatus().isMuted,
    isPlaying: soundService.getStatus().isPlaying,
    volume: soundService.getStatus().volume
  });

  useEffect(() => {
    const updateSoundStatus = () => {
      setSoundStatus(soundService.getStatus());
    };
    
    updateSoundStatus();
    
    const interval = setInterval(updateSoundStatus, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Enhanced handleNotificationAction with emergency stop and data reload
  const handleNotificationAction = useCallback(async (action, responseTime, snoozeMinutes) => {
    try {
      console.log(`🔄 Handling ${action} response`);
      
      // Immediate sound stop
      await soundService.emergencyStop();
      
      // Ensure sound is completely stopped
      setTimeout(() => {
        soundService.stop();
      }, 100);
      
      // Update sound status
      setSoundStatus({
        isMuted: false,
        isPlaying: false,
        volume: soundStatus.volume
      });
      
      // Process notification response
      const result = await handleNotificationResponse(action, responseTime, snoozeMinutes);
      
      if (result.success) {
        // Reload data for updated analytics
        setTimeout(async () => {
          try {
            await loadRoutines();
            await loadNotifications();
            console.log('📊 Data reloaded after notification response');
          } catch (error) {
            console.warn('Error reloading data:', error);
          }
        }, 500);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error handling notification response:', error);
      throw error;
    }
  }, [handleNotificationResponse, loadRoutines, loadNotifications, soundStatus.volume]);

  // Close notification modal
  const handleCloseNotification = useCallback(() => {
    soundService.emergencyStop();
    clearCurrentNotification();
    setSoundStatus(soundService.getStatus());
  }, [clearCurrentNotification]);

  // Initialize services and load data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing app for user:', user?.email);
        
        // Initialize socket service
        const socket = socketService.init();
        
        if (socket && user) {
          socketService.joinUser(user.id);
          console.log('Socket service initialized');
        }
        
        // Preload sounds
        soundService.preloadSounds();

        // Set up notification listener
        socketService.onNotification((notificationData) => {
          console.log('New notification:', notificationData);
          
          if (notificationData.sound) {
            soundService.play(
              notificationData.sound, 
              notificationData.volume || 0.7,
              { loop: true }
            );
            setSoundStatus(soundService.getStatus());
          }
          
          addNotification(notificationData);
        });

        // Load initial data
        if (user) {
          console.log('Loading user data...');
          await loadRoutines();
          await loadNotifications();
          console.log('Data loaded successfully');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    initializeApp();

    // Cleanup
    return () => {
      socketService.disconnect();
      soundService.stop();
    };
  }, [user, loadRoutines, loadNotifications, addNotification]);

  // Add global keyboard shortcuts for sound control
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl+Shift+S to stop all sounds
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        console.log('⌨️ Keyboard shortcut: Stopping all sounds');
        soundService.emergencyStop();
        if (currentNotification) {
          clearCurrentNotification();
        }
        setSoundStatus(soundService.getStatus());
      }
      
      // Space to mark as complete when notification is active
      if (e.key === ' ' && currentNotification) {
        e.preventDefault();
        console.log('⌨️ Spacebar: Marking as complete');
        handleNotificationAction('completed', responseTime);
      }
      
      // Escape to dismiss when notification is active
      if (e.key === 'Escape' && currentNotification) {
        e.preventDefault();
        console.log('⌨️ Escape: Dismissing notification');
        handleNotificationAction('dismissed', responseTime);
      }
      
      // 'S' key to snooze when notification is active
      if ((e.key === 's' || e.key === 'S') && currentNotification) {
        e.preventDefault();
        console.log('⌨️ S key: Snoozing notification');
        handleNotificationAction('snoozed', responseTime, 5);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentNotification, handleNotificationAction, clearCurrentNotification, responseTime]);

  // Handle routine actions
  const handleAddRoutine = useCallback(async (routineData) => {
    try {
      console.log('Adding new routine:', routineData.title);
      return await addRoutine(routineData);
    } catch (error) {
      console.error('Error adding routine:', error);
      throw error;
    }
  }, [addRoutine]);

  const handleUpdateRoutine = useCallback(async (routineId, updatedData) => {
    try {
      console.log('Updating routine:', routineId);
      return await updateRoutine(routineId, updatedData);
    } catch (error) {
      console.error('Error updating routine:', error);
      throw error;
    }
  }, [updateRoutine]);

  const handleDeleteRoutine = useCallback(async (routineId) => {
    try {
      console.log('Deleting routine:', routineId);
      await deleteRoutine(routineId);
      await loadRoutines();
    } catch (error) {
      console.error('Error deleting routine:', error);
      throw error;
    }
  }, [deleteRoutine, loadRoutines]);

  const handleToggleRoutine = useCallback(async (routineId) => {
    try {
      console.log('Toggling routine:', routineId);
      await toggleRoutineActive(routineId);
      await loadRoutines();
    } catch (error) {
      console.error('Error toggling routine:', error);
      throw error;
    }
  }, [toggleRoutineActive, loadRoutines]);

  // Refresh data
  const handleRefreshData = useCallback(async () => {
    try {
      console.log('Refreshing data...');
      await loadRoutines();
      await loadNotifications();
      console.log('Data refreshed');
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, [loadRoutines, loadNotifications]);

  // Test notification sound
  const handleTestSound = useCallback((soundType, volume) => {
    console.log('Testing sound from App:', soundType, volume);
    testNotificationSound(soundType, volume);
    setSoundStatus(soundService.getStatus());
  }, [testNotificationSound]);

  // Handle sound mute toggle
  const handleToggleMute = useCallback(() => {
    const isMuted = soundService.toggleMute();
    setSoundStatus(prev => ({ ...prev, isMuted }));
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Data</h3>
        <p>{error}</p>
        <div className="error-actions">
          <button 
            className="btn-primary" 
            onClick={handleRefreshData}
          >
            Retry
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Check active route for highlighting
  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/routines') return location.pathname.startsWith('/routines');
    if (path === '/analytics') return location.pathname === '/analytics';
    if (path === '/settings') return location.pathname === '/settings';
    return false;
  };

  return (
    <div className="App">
      {/* Navigation */}
      <nav className="main-nav">
        <div 
          className="nav-brand" 
          onClick={() => navigate('/dashboard')} 
          style={{ cursor: 'pointer' }}
        >
          <h1>🔔 NotifyFlow</h1>
          <span className="nav-subtitle">Smart Routine Manager</span>
        </div>
        
        <div className="nav-links">
          <button 
            className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`} 
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-link ${isActive('/routines') ? 'active' : ''}`}
            onClick={() => navigate('/routines')}
          >
            Routines
          </button>
          <button 
            className={`nav-link ${isActive('/analytics') ? 'active' : ''}`}
            onClick={() => navigate('/analytics')}
          >
            Analytics
          </button>
          <button 
            className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
          >
            Settings
          </button>
          <button 
            className="nav-link refresh-btn"
            onClick={handleRefreshData}
            title="Refresh Data"
          >
            🔄
          </button>
        </div>
        
        <div className="nav-user">
          <div className="user-avatar">
            {user?.firstName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <span className="username">Welcome, {user?.firstName || 'User'}</span>
            <span className="user-email">{user?.email}</span>
            <span className="user-status">
              ● {socketService.getConnectionStatus().isConnected ? 'Online' : 'Offline'}
            </span>
          </div>
          
          <button 
            className="logout-btn" 
            onClick={logout}
            title="Logout"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-container">
          <Routes>
            <Route path="/dashboard" element={
              <Dashboard 
                routines={routines} 
                notifications={notifications} 
                user={user}
                onToggleRoutine={handleToggleRoutine}
                onNavigateToRoutines={() => navigate('/routines')}
                onNavigateToAnalytics={() => navigate('/analytics')}
                onNavigateToSettings={() => navigate('/settings')}
              />
            } />
            
            <Route path="/routines" element={
              <RoutineManager 
                routines={routines}
                onAddRoutine={() => navigate('/routines/add')}
                onEditRoutine={(routine) => navigate(`/routines/edit/${routine._id}`)}
                onDeleteRoutine={handleDeleteRoutine}
                onToggleRoutine={handleToggleRoutine}
              />
            } />
            
            <Route path="/routines/add" element={
              <AddRoutine 
                onSaveRoutine={async (routineData) => {
                  try {
                    await handleAddRoutine(routineData);
                    navigate('/routines');
                  } catch (error) {
                    throw error;
                  }
                }}
                onCancel={() => navigate('/routines')}
                onTestSound={(soundType, volume) => soundService.testSound(soundType, volume)}
              />
            } />
            
            <Route 
              path="/routines/edit/:id" 
              element={
                <EditRoutineWrapper 
                  routines={routines}
                  onUpdateRoutine={async (routineId, updates) => {
                    try {
                      await handleUpdateRoutine(routineId, updates);
                      navigate('/routines');
                    } catch (error) {
                      throw error;
                    }
                  }}
                  onDeleteRoutine={async (routineId) => {
                    try {
                      await handleDeleteRoutine(routineId);
                      navigate('/routines');
                    } catch (error) {
                      alert('Failed to delete routine: ' + error.message);
                    }
                  }}
                  onTestSound={(soundType, volume) => soundService.testSound(soundType, volume)}
                />
              } 
            />
            
            <Route path="/analytics" element={
              <Analytics 
                routines={routines} 
                notifications={notifications} 
                user={user} 
              />
            } />
            
            <Route path="/settings" element={
              <SoundSettings 
                user={user}
                onTestSound={(soundType, volume) => soundService.testSound(soundType, volume)}
              />
            } />
          </Routes>
        </div>
      </main>

      {/* Notification Modal */}
      {currentNotification && (
        <NotificationModal
          notification={currentNotification}
          onResponse={handleNotificationAction}
          onClose={handleCloseNotification}
          responseTime={responseTime}
        />
      )}

      {/* Connection Status */}
      <div className={`connection-status ${socketService.getConnectionStatus().isConnected ? 'connected' : 'disconnected'}`}>
        {socketService.getConnectionStatus().isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* Sound Status with Mute Toggle */}
      <div 
        className="sound-status"
        onClick={handleToggleMute}
        style={{ cursor: 'pointer' }}
        title="Click to mute/unmute"
      >
        🔊 {soundStatus.isMuted ? 'Muted' : 'Ready'} (Click to toggle)
      </div>
    </div>
  );
};

// Root App Component
function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing NotifyFlow App...');
        console.log('🌐 API URL:', process.env.REACT_APP_API_URL);
        
        // Preload sounds
        soundService.preloadSounds();
        
        // Test API connection
        try {
          const testResult = await apiService.testApiConnection();
          console.log('🌐 API Test:', testResult.message);
        } catch (apiError) {
          console.warn('⚠️ API connection test failed:', apiError.message);
        }
        
        setAppReady(true);
        console.log('✅ App initialized successfully');
      } catch (error) {
        console.error('❌ App initialization failed:', error);
        setAppReady(true);
      }
    };

    initializeApp();

    return () => {
      soundService.destroy();
    };
  }, []);

  if (!appReady) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>NotifyFlow</h2>
          <p>Initializing your smart routine manager...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          
          <Route path="/register" element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } />
          
          {/* Protected Routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          } />
          
          {/* Default Route */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          
          {/* 404 Route */}
          <Route path="*" element={
            <div className="error-container">
              <h1>404 - Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
              <button 
                className="btn-primary" 
                onClick={() => window.location.href = '/'}
              >
                Go to Home
              </button>
            </div>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;