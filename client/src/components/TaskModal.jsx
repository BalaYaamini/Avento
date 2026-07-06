import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Modal from './Modal';
const TaskModal = ({ isOpen, onClose, task, eventId, eventDate, organizers, onSave }) => {
  const { user } = useAuth();
  const isEditing = !!task;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    assigned_to: '',
    priority: 'Medium',
    deadline: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const suggestedCategories = [
    'Event Head', 'Technical Team', 'Design Team', 'Media Team', 
    'Hospitality Team', 'Logistics Team', 'Sponsorship Team', 
    'Volunteer Team', 'Registration Team'
  ];

  useEffect(() => {
    if (isOpen) {
      if (isEditing && task) {
        setFormData({
          title: task.title || '',
          description: task.description || '',
          category: task.category || '',
          assigned_to: task.assigned_to || '',
          priority: task.priority || 'Medium',
          deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''
        });
      } else {
        setFormData({
          title: '',
          description: '',
          category: '',
          assigned_to: '',
          priority: 'Medium',
          deadline: ''
        });
      }
      setError('');
    }
  }, [isOpen, task, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (formData.deadline) {
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const eDate = new Date(eventDate);
      eDate.setHours(23, 59, 59, 999);
      
      if (deadlineDate < today || deadlineDate > eDate) {
        setError('Invalid task due date. Must be between today and the event date.');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category || null,
        assigned_to: formData.assigned_to || null,
        priority: formData.priority,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null
      };

      let requestError;

      try {
        if (isEditing) {
          await axios.put(`/api/tasks/${task.id}`, payload);
        } else {
          await axios.post(`/api/tasks/event/${eventId}`, payload);
        }
      } catch (reqErr) {
        requestError = reqErr;
      }

      if (requestError) throw requestError;

      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Task" : "Create Task"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded-md focus:ring-slate-500 focus:border-slate-500"
            placeholder="E.g., Design event poster"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:ring-slate-500 focus:border-slate-500"
            placeholder="Task details and instructions..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="">Select Category</option>
              {suggestedCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
            <select
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="">Unassigned</option>
              {organizers.map(org => (
                <option key={org.userId} value={org.userId}>{org.name} ({org.category})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:ring-slate-500 focus:border-slate-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
            <input
              type="date"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
              max={eventDate ? new Date(new Date(eventDate).getTime() - new Date(eventDate).getTimezoneOffset() * 60000).toISOString().split('T')[0] : ''}
              className="w-full px-3 py-2 border rounded-md focus:ring-slate-500 focus:border-slate-500"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 border rounded-md hover:bg-slate-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 flex items-center"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>Saving...</>
            ) : (
              'Save Task'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TaskModal;
