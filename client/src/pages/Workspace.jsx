import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import axios from 'axios';
import TaskBoard from '../components/TaskBoard';
import TaskModal from '../components/TaskModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import CertificateManager from '../components/CertificateManager';
import FeedbackAnalytics from '../components/FeedbackAnalytics';

const Workspace = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [event, setEvent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignedTo: '',
    category: ''
  });

  const fetchWorkspaceData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      
      console.log("Workspace Event ID:", eventId);
      console.log("Current User:", user);

      // 1. Fetch Event
      const eventRes = await axios.get(`/api/events/${eventId}`);
      const eventData = eventRes.data;
      console.log("Workspace API Response:", eventRes);
      
      // 2. Fetch Organizers
      console.log('GET /api/events/' + eventId + '/organizers');
      const orgRes = await axios.get(`/api/events/${eventId}/organizers`);
      const orgData = orgRes.data;
      console.log('Organizers Data:', orgData);
      
      // Access check
      const isAdmin = user.roles?.includes('admin');
      const isFaculty = user.id === eventData.faculty_id;
      const isEventHead = user.id === eventData.student_organizer_id || user.id === eventData.proposed_by;
      const isOrganizer = orgData.some(org => String(org.userId) === String(user.id));
      
      if (!isAdmin && !isFaculty && !isEventHead && !isOrganizer) {
        console.warn('Access denied. Redirecting...');
        navigate('/'); // Redirect if no access
        return;
      }
      
      setEvent(eventData);
      setOrganizers(orgData);

      // 3. Fetch Tasks
      console.log('GET /api/tasks/event/' + eventId);
      const tasksRes = await axios.get(`/api/tasks/event/${eventId}`);
      console.log('Tasks Data:', tasksRes.data);
      setTasks(tasksRes.data);
      
    } catch (err) {
      console.error('WORKSPACE LOAD ERROR:', err);
      console.log('Error details:', {
        message: err.message,
        response: err.response?.data
      });
      setError(err.response?.data?.message || err.message || 'Failed to load workspace data. Please check console for details.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();

    // Set up Realtime Subscription for tasks in this event
    const channel = supabase
      .channel(`workspace-tasks-${eventId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks', 
        filter: `event_id=eq.${eventId}` 
      }, (payload) => {
        console.log('Realtime task change received!', payload);
        // Refetch the workspace data to get updated tasks with joined profiles
        fetchWorkspaceData(true);
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, user.id]);

  const handleCreateTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };
  
  const handleEditTask = (task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };
  
  const handleViewTask = (task) => {
    setSelectedTask(task);
    setIsDetailsModalOpen(true);
  };

  const hasFullAccess = () => {
    if (!event) return false;
    return user.roles.includes('admin') || user.id === event.faculty_id || user.id === event.student_organizer_id;
  };

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'To Do').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const blockedTasks = tasks.filter(t => t.status === 'Blocked').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.assignedTo && task.assigned_to !== filters.assignedTo) return false;
    if (filters.category && task.category !== filters.category) return false;
    return true;
  });

  const suggestedCategories = [
    'Event Head', 'Technical Team', 'Design Team', 'Media Team', 
    'Hospitality Team', 'Logistics Team', 'Sponsorship Team', 
    'Volunteer Team', 'Registration Team'
  ];

  const handleMarkCompleted = async () => {
    if (!window.confirm('Are you sure you want to mark this event as completed? This will open feedback and certificates.')) {
      return;
    }
    
    try {
      await axios.put(`/api/events/${eventId}/status`, { status: 'completed' });
      fetchWorkspaceData(); // Refresh the event data
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark event as completed.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="animate-spin w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-8 bg-slate-50 min-h-screen">{error}</div>;
  }

  if (!event) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{event.title} - Workspace</h1>
          <p className="text-slate-500">Manage tasks and coordinate with your team</p>
        </div>
        <div className="flex items-center gap-3">
          {hasFullAccess() && event.status !== 'completed' && (
            <button 
              onClick={handleMarkCompleted}
              className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition shadow"
            >
              ✓ Mark as Completed
            </button>
          )}
          {hasFullAccess() && (
            <button 
              onClick={handleCreateTask}
              className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition shadow"
            >
              + Create Task
            </button>
          )}
        </div>
      </div>

      {/* Event Progress */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800">Event Progress</h2>
            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
              {totalTasks} Total Tasks
            </span>
          </div>
          <span className="text-lg font-bold text-slate-900">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-5 overflow-hidden">
          <div className="bg-slate-900 h-5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-4 items-center">
        <span className="font-medium text-slate-700 mr-2">Filters:</span>
        <select 
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
          value={filters.status}
          onChange={e => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Statuses</option>
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Blocked">Blocked</option>
        </select>

        <select 
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
          value={filters.priority}
          onChange={e => setFilters({...filters, priority: e.target.value})}
        >
          <option value="">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>

        <select 
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
          value={filters.assignedTo}
          onChange={e => setFilters({...filters, assignedTo: e.target.value})}
        >
          <option value="">All Assignees</option>
          {organizers.map(org => (
            <option key={org.userId} value={org.userId}>{org.name}</option>
          ))}
        </select>

        <select 
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
          value={filters.category}
          onChange={e => setFilters({...filters, category: e.target.value})}
        >
          <option value="">All Categories</option>
          {suggestedCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {(filters.status || filters.priority || filters.assignedTo || filters.category) && (
          <button 
            onClick={() => setFilters({status: '', priority: '', assignedTo: '', category: ''})}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Task Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-amber-50 p-4 rounded-xl text-center border border-amber-100 shadow-sm transition-transform hover:-translate-y-1">
          <div className="text-2xl font-black text-amber-700">{pendingTasks}</div>
          <div className="text-sm text-amber-600 font-bold uppercase tracking-wider mt-1">To Do</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-100 shadow-sm transition-transform hover:-translate-y-1">
          <div className="text-2xl font-black text-blue-700">{inProgressTasks}</div>
          <div className="text-sm text-blue-600 font-bold uppercase tracking-wider mt-1">In Progress</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl text-center border border-red-100 shadow-sm transition-transform hover:-translate-y-1">
          <div className="text-2xl font-black text-red-700">{blockedTasks}</div>
          <div className="text-sm text-red-600 font-bold uppercase tracking-wider mt-1">Blocked</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100 shadow-sm transition-transform hover:-translate-y-1">
          <div className="text-2xl font-black text-emerald-700">{completedTasks}</div>
          <div className="text-sm text-emerald-600 font-bold uppercase tracking-wider mt-1">Completed</div>
        </div>
      </div>
      {/* Task Board */}
      <TaskBoard 
        tasks={filteredTasks} 
        onViewTask={handleViewTask} 
        onEditTask={hasFullAccess() ? handleEditTask : undefined}
      />

      {/* Certificate Management (Only for completed events) */}
      {hasFullAccess() && (
        <CertificateManager eventId={eventId} eventStatus={event.status} />
      )}

      {/* Feedback Analytics (Only for completed events) */}
      {event.status === 'completed' && (
        <div className="mb-8 mt-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Post-Event Feedback Analytics</h2>
          <FeedbackAnalytics eventId={eventId} />
        </div>
      )}

      {/* Modals */}
      <TaskModal 
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={editingTask}
        eventId={eventId}
        eventDate={event?.date}
        organizers={organizers}
        onSave={() => fetchWorkspaceData(true)}
      />

      <TaskDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        task={selectedTask}
        organizers={organizers}
        hasFullAccess={hasFullAccess()}
        currentUserId={user.id}
        onUpdate={() => fetchWorkspaceData(true)}
      />
    </div>
  );
};

export default Workspace;
