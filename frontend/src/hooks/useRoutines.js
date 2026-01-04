import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export const useRoutines = () => {
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadRoutines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📋 Loading routines...');
      const response = await apiService.routines.getAll();
      
      console.log('📋 Routines API response:', {
        status: response.status,
        success: response.data?.success,
        count: response.data?.count,
        isArray: Array.isArray(response.data?.routines)
      });
      
      if (response.data && response.data.success) {
        const routinesArray = Array.isArray(response.data.routines) 
          ? response.data.routines 
          : [];
        
        console.log(`📋 Loaded ${routinesArray.length} routines`);
        setRoutines(routinesArray);
        
        return routinesArray;
      } else {
        throw new Error(response.data?.message || 'Failed to load routines');
      }
    } catch (err) {
      console.error('❌ Error loading routines:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load routines';
      setError(errorMessage);
      setRoutines([]); // Reset to empty array on error
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addRoutine = useCallback(async (routineData) => {
    try {
      setError(null);
      console.log('➕ Creating routine:', routineData.title);
      const response = await apiService.routines.create(routineData);
      console.log('✅ Routine created:', response.data);
      
      if (response.data && response.data.success) {
        // Add the new routine to the list
        setRoutines(prev => [...prev, response.data.routine]);
        return response.data.routine;
      } else {
        throw new Error(response.data?.message || 'Failed to create routine');
      }
    } catch (err) {
      console.error('❌ Error creating routine:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create routine';
      throw new Error(errorMessage);
    }
  }, []);

  const updateRoutine = useCallback(async (routineId, updates) => {
    try {
      setError(null);
      console.log('✏️ Updating routine:', routineId, updates);
      const response = await apiService.routines.update(routineId, updates);
      console.log('✅ Routine updated:', response.data);
      
      if (response.data && response.data.success) {
        // Update the routine in the list
        setRoutines(prev =>
          prev.map(routine =>
            routine._id === routineId ? response.data.routine : routine
          )
        );
        return response.data.routine;
      } else {
        throw new Error(response.data?.message || 'Failed to update routine');
      }
    } catch (err) {
      console.error('❌ Error updating routine:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update routine';
      throw new Error(errorMessage);
    }
  }, []);

  const deleteRoutine = useCallback(async (routineId) => {
    try {
      setError(null);
      console.log('🗑️ Deleting routine:', routineId);
      const response = await apiService.routines.delete(routineId);
      console.log('✅ Routine deleted:', response.data);
      
      if (response.data && response.data.success) {
        // Remove the routine from the list
        setRoutines(prev => prev.filter(routine => routine._id !== routineId));
      } else {
        throw new Error(response.data?.message || 'Failed to delete routine');
      }
    } catch (err) {
      console.error('❌ Error deleting routine:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete routine';
      throw new Error(errorMessage);
    }
  }, []);

  // ENHANCED TOGGLE ROUTINE ACTIVE METHOD WITH LOADING STATE
  const toggleRoutineActive = useCallback(async (routineId) => {
    try {
      setError(null);
      console.log('🔄 Toggling routine:', routineId);
      
      // Show loading state immediately
      setRoutines(prev =>
        prev.map(routine =>
          routine._id === routineId 
            ? { ...routine, _isUpdating: true }
            : routine
        )
      );
      
      const response = await apiService.routines.toggleActive(routineId);
      
      console.log('✅ Toggle routine response:', response.data);
      
      if (response.data && response.data.success) {
        // Update the routine in the list
        setRoutines(prev =>
          prev.map(routine => {
            if (routine._id === routineId) {
              return {
                ...response.data.routine,
                _isUpdating: false,
                // Ensure we preserve all properties
                ...(response.data.routine || {})
              };
            }
            return routine;
          })
        );
        
        console.log(`✅ Routine ${routineId} toggled to ${response.data.routine?.isActive ? 'active' : 'inactive'}`);
        return response.data.routine.isActive;
      } else {
        throw new Error(response.data?.message || 'Failed to toggle routine');
      }
    } catch (err) {
      console.error('❌ Error toggling routine:', err);
      
      // Reset loading state on error
      setRoutines(prev =>
        prev.map(routine =>
          routine._id === routineId 
            ? { ...routine, _isUpdating: false }
            : routine
        )
      );
      
      // Try local fallback toggle if API fails
      console.log('🔄 Trying local fallback toggle...');
      setRoutines(prev =>
        prev.map(routine => {
          if (routine._id === routineId) {
            const updatedRoutine = {
              ...routine,
              isActive: !routine.isActive,
              _isUpdating: false
            };
            console.log(`✅ Local fallback: ${routineId} toggled to ${updatedRoutine.isActive ? 'active' : 'inactive'}`);
            return updatedRoutine;
          }
          return routine;
        })
      );
      
      const errorMessage = err.response?.data?.message || err.message || 'Failed to toggle routine. Using local state.';
      setError(errorMessage);
      
      // Return the local toggle state
      const currentRoutine = routines.find(r => r._id === routineId);
      return currentRoutine ? !currentRoutine.isActive : false;
    }
  }, [routines]);

  // Load routines on mount
  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  // Helper function to get routine by ID
  const getRoutineById = useCallback((id) => {
    return routines.find(routine => routine._id === id);
  }, [routines]);

  // Helper function to filter routines
  const filterRoutines = useCallback((filterFn) => {
    return routines.filter(filterFn);
  }, [routines]);

  return {
    // State
    routines,
    loading,
    error,
    
    // Actions
    addRoutine,
    updateRoutine,
    deleteRoutine,
    toggleRoutineActive,
    loadRoutines,
    
    // Helper functions
    getRoutineById,
    filterRoutines,
    
    // Statistics
    getStats: useCallback(() => {
      const total = routines.length;
      const active = routines.filter(r => r.isActive).length;
      const inactive = total - active;
      
      return {
        total,
        active,
        inactive,
        activePercentage: total > 0 ? Math.round((active / total) * 100) : 0
      };
    }, [routines]),
    
    // Get routines by category
    getRoutinesByCategory: useCallback((category) => {
      return routines.filter(routine => routine.category === category);
    }, [routines]),
    
    // Clear error
    clearError: useCallback(() => {
      setError(null);
    }, [])
  };
};