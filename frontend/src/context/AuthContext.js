// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiService } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Store token consistently
  const storeToken = (token) => {
    localStorage.setItem('notifyflow_token', token);
    // Also store with generic key for compatibility
    localStorage.setItem('token', token);
  };

  const clearToken = () => {
    localStorage.removeItem('notifyflow_token');
    localStorage.removeItem('token');
  };

  const checkAuthStatus = async () => {
    try {
      // Try both token keys for compatibility
      const token = localStorage.getItem('notifyflow_token') || localStorage.getItem('token');
      
      if (token) {
        // Verify token by fetching user profile
        const response = await apiService.auth.getProfile();
        
        if (response.data && response.data.success) {
          setUser(response.data.user);
          setIsAuthenticated(true);
        } else {
          clearToken();
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      clearToken();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await apiService.auth.register(userData);
      
      if (response.data && response.data.success) {
        const { token, user } = response.data;
        
        // Store token
        storeToken(token);
        
        // Update state
        setUser(user);
        setIsAuthenticated(true);
        
        return { success: true, user };
      } else {
        return { 
          success: false, 
          message: response.data?.message || 'Registration failed' 
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.errors?.join(', ') || 
                          'Registration failed. Please try again.';
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await apiService.auth.login({ email, password });
      
      if (response.data && response.data.success) {
        const { token, user } = response.data;
        
        // Store token
        storeToken(token);
        
        // Update state
        setUser(user);
        setIsAuthenticated(true);
        
        return { success: true, user };
      } else {
        return { 
          success: false, 
          message: response.data?.message || 'Login failed' 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await apiService.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearToken();
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    register,  // Added register function
    login,
    logout,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};