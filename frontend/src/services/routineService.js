import { apiService } from './api';

export const routineService = {
  // Get all routines
  getRoutines: async () => {
    try {
      const response = await apiService.routines.getAll();
      return response.data;
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  },

  // Get routine by ID
  getRoutine: async (id) => {
    try {
      const response = await apiService.routines.getById(id);
      return response.data;
    } catch (error) {
      console.error('Error fetching routine:', error);
      throw error;
    }
  },

  // Create new routine
  createRoutine: async (routineData) => {
    try {
      const response = await apiService.routines.create(routineData);
      return response.data;
    } catch (error) {
      console.error('Error creating routine:', error);
      throw error;
    }
  },

  // Update routine
  updateRoutine: async (id, routineData) => {
    try {
      const response = await apiService.routines.update(id, routineData);
      return response.data;
    } catch (error) {
      console.error('Error updating routine:', error);
      throw error;
    }
  },

  // Delete routine
  deleteRoutine: async (id) => {
    try {
      await apiService.routines.delete(id);
      return true;
    } catch (error) {
      console.error('Error deleting routine:', error);
      throw error;
    }
  },

  // Toggle routine active status
  toggleRoutine: async (id) => {
    try {
      const response = await apiService.routines.toggleActive(id);
      return response.data;
    } catch (error) {
      console.error('Error toggling routine:', error);
      throw error;
    }
  }
};

export default routineService;
