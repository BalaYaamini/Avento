import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import axios from 'axios';
import TaskBoard from '../components/TaskBoard';
import TaskListView from '../components/TaskListView';
import TaskModal from '../components/TaskModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import CertificateManager from '../components/CertificateManager';
import FeedbackAnalytics from '../components/FeedbackAnalytics';
import FeedbackQuestionBuilder from '../components/FeedbackQuestionBuilder';
import OrganizerRegistrations from '../components/OrganizerRegistrations';
import ConfirmedTeamsOverview from '../components/ConfirmedTeamsOverview';
import Modal from '../components/Modal';
import QRScanner from '../components/QRScanner';
import TeamAllocation from '../components/TeamAllocation';
import AdminCreateTeamModal from '../components/AdminCreateTeamModal';
import ScoringBoard from '../components/ScoringBoard';
import ConfirmationEmailModal from '../components/ConfirmationEmailModal';
import IDCardManager from '../components/IDCardManager';
import OrganizerPeriodicAttendance from '../components/OrganizerPeriodicAttendance';
import ReviewDiscussionTab from '../components/ReviewDiscussionTab';
import OrganizingTeamTab from '../components/OrganizingTeamTab';
import SlotManagementTab from '../components/SlotManagementTab';

const Workspace = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [event, setEvent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get('tab') || 'tasks';
    } catch (e) {
      return 'tasks';
    }
  });

  const [registrationSubTab, setRegistrationSubTab] = useState(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get('tab');
      if (tab === 'confirmed_teams') return 'confirmed_teams';
      return 'registrations';
    } catch (e) {
      return 'registrations';
    }
  });

  const handleTabChange = (newTab, subTab) => {
    setActiveTab(newTab);
    if (subTab) {
      setRegistrationSubTab(subTab);
    } else if (newTab === 'confirmed_teams') {
      setRegistrationSubTab('confirmed_teams');
    } else if (newTab === 'registrations') {
      setRegistrationSubTab('registrations');
    }
    try {
      const url = new URL(window.location);
      url.searchParams.set('tab', newTab);
      window.history.replaceState({}, '', url);
    } catch (e) {}
  };
  
  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [initialTaskStatus, setInitialTaskStatus] = useState('To Do');
  const [taskViewMode, setTaskViewMode] = useState('board'); // 'board' or 'list'
  
  // Admin Actions State
  const [isAdminCreateTeamOpen, setIsAdminCreateTeamOpen] = useState(false);
  const [isConfirmationEmailModalOpen, setIsConfirmationEmailModalOpen] = useState(false);

  const handleAdminCloseRegistrations = async () => {
    if (!event || !window.confirm(`Manually close registrations for "${event.title}"?`)) {
      return;
    }
    try {
      await axios.post(`/api/events/admin/${eventId}/close-registrations`);
      alert(`Registrations for "${event.title}" have been manually closed by Admin.`);
      fetchWorkspaceData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to close registrations.');
    }
  };

  const handleAdminOpenRegistrations = async () => {
    if (!event || !window.confirm(`Manually open registrations for "${event.title}"?`)) {
      return;
    }
    try {
      await axios.post(`/api/events/admin/${eventId}/open-registrations`);
      alert(`Registrations for "${event.title}" have been manually opened by Admin.`);
      fetchWorkspaceData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to open registrations.');
    }
  };

  // Actions Dropdown State
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsActionsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // QR Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);

  // Edit Event Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    category: '',
    venue: '',
    date: '',
    registrationDeadline: '',
    capacity: '',
    maxTeams: '',
    minTeamSize: '1',
    maxTeamSize: '4',
    imageUrl: '',
    registrationType: 'individual'
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFeedback, setEditFeedback] = useState(null);

  // Feedback Questions Modal State
  const [isFeedbackQuestionsModalOpen, setIsFeedbackQuestionsModalOpen] = useState(false);
  const [feedbackQuestions, setFeedbackQuestions] = useState([]);

  const handleSaveFeedbackQuestions = async () => {
    try {
      await axios.put(`/api/feedbacks/event/${eventId}/questions`, { questions: feedbackQuestions });
      alert('Feedback questions updated successfully!');
      setIsFeedbackQuestionsModalOpen(false);
      fetchWorkspaceData(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update feedback questions.');
    }
  };

  const formatToDatetimeLocal = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const openEditModal = () => {
    if (!event) return;
    setEditFeedback(null);
    setEditFormData({
      title: event.title || '',
      description: event.description || '',
      category: event.category || 'General',
      venue: event.venue || '',
      date: formatToDatetimeLocal(event.date),
      registrationDeadline: formatToDatetimeLocal(event.registration_deadline),
      capacity: event.capacity || '',
      maxTeams: event.max_teams || '',
      minTeamSize: event.min_team_size || 1,
      maxTeamSize: event.max_team_size || 4,
      imageUrl: event.image_url || event.imageUrl || '',
      registrationType: event.registration_type || 'individual',
      has_slots: Boolean(event.has_slots)
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditFeedback(null);
    setEditSubmitting(true);
    try {
      const payload = {
        ...editFormData,
        has_slots: Boolean(editFormData.has_slots),
        date: editFormData.date ? (editFormData.date.includes('Z') || editFormData.date.includes('+') ? editFormData.date : new Date(editFormData.date).toISOString()) : undefined,
        registrationDeadline: editFormData.registrationDeadline ? (editFormData.registrationDeadline.includes('Z') || editFormData.registrationDeadline.includes('+') ? editFormData.registrationDeadline : new Date(editFormData.registrationDeadline).toISOString()) : null,
      };
      const res = await axios.put(`/api/events/${eventId}`, payload);
      setEditFeedback({ type: 'success', message: 'Event details updated successfully!' });
      setEvent(prev => ({ ...prev, ...res.data }));
      fetchWorkspaceData(true);
      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 1200);
    } catch (err) {
      setEditFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to update event details.' });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleScanSuccess = async (registrationId) => {
    if (!registrationId) return;
    setScanFeedback(null);
    try {
      const res = await axios.post('/api/attendance/verify', { registrationId, eventId });
      if (res.data.alreadyMarked) {
        const { name } = res.data.student || {};
        setScanFeedback({
          type: 'warning',
          message: res.data.message || `Attendance already marked for ${name || 'this participant'} during this period.`
        });
      } else if (res.data.success) {
        const { name } = res.data.student || {};
        const progressStr = res.data.progress ? ` [Progress: ${res.data.progress}]` : '';
        setScanFeedback({
          type: 'success',
          message: `${res.data.message || 'Attendance marked successfully'} for ${name || 'participant'}${progressStr}.`
        });
      } else {
        setScanFeedback({ type: 'success', message: res.data.message || 'Attendance recorded.' });
      }
    } catch (err) {
      setScanFeedback({ type: 'error', message: err.response?.data?.message || 'Invalid QR code.' });
    }
  };
  
  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignedTo: '',
    category: '',
    searchQuery: '',
    myTasksOnly: false
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
      
      // 2. Fetch Organizers safely
      let orgData = [];
      try {
        const orgRes = await axios.get(`/api/events/${eventId}/organizers`);
        orgData = Array.isArray(orgRes.data) ? orgRes.data : [];
      } catch (e) {
        console.warn('Organizers fetch warning:', e);
      }
      
      // Access check - Type-safe string comparison and multi-role evaluation
      const userRoles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);
      const isAdmin = userRoles.includes('admin') || userRoles.includes('student_organizer') || userRoles.includes('faculty') || userRoles.includes('faculty_organizer');
      const userIdStr = String(user?.id || '');

      const isFaculty = userIdStr === String(eventData?.faculty_id || '');
      const isEventHead = userIdStr === String(eventData?.student_organizer_id || '') || 
                         userIdStr === String(eventData?.proposed_by || '') ||
                         userIdStr === String(eventData?.organizer_id || '') ||
                         userIdStr === String(eventData?.created_by || '');
      const isOrganizer = orgData.some(org => String(org.userId || org.id) === userIdStr);
      
      setEvent(eventData);
      setOrganizers(orgData);

      // 3. Fetch Tasks safely
      let tasksData = [];
      try {
        const tasksRes = await axios.get(`/api/tasks/event/${eventId}`);
        tasksData = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      } catch (e) {
        console.warn('Tasks fetch warning:', e);
      }
      setTasks(tasksData);
      
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
  }, [eventId, user?.id]);

  const handleCreateTask = (status = 'To Do') => {
    setEditingTask(null);
    setInitialTaskStatus(status);
    setIsTaskModalOpen(true);
  };
  
  const handleEditTask = (task) => {
    setEditingTask(task);
    setInitialTaskStatus(task.status || 'To Do');
    setIsTaskModalOpen(true);
  };
  
  const handleViewTask = (task) => {
    setSelectedTask(task);
    setIsDetailsModalOpen(true);
  };

  const handleQuickStatusChange = async (taskId, newStatus) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, status: newStatus } : t));
    try {
      await axios.put(`/api/tasks/${taskId}`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
      fetchWorkspaceData(true);
    }
  };

  const userRoles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);
  const isAdmin = userRoles.includes('admin') || user?.is_admin === true;
  const isFacultyRole = userRoles.includes('faculty') || userRoles.includes('faculty_organizer');
  const userIdStr = String(user?.id || '');

  const isEventFaculty = userIdStr === String(event?.faculty_id || '');
  const isFacultyOrg = (organizers || []).some(org => 
    String(org.userId || org.student_id || org.user_id || org.id) === userIdStr && 
    (org.category === 'Faculty' || org.category === 'Faculty Coordinator' || org.category === 'Faculty Organizer')
  );
  const isEventHead = Boolean(
    userIdStr === String(event?.student_organizer_id || '') || 
    userIdStr === String(event?.proposed_by || '') ||
    userIdStr === String(event?.organizer_id || '') ||
    userIdStr === String(event?.created_by || '') ||
    (event?.proposer?.id && userIdStr === String(event.proposer.id)) ||
    (event?.proposer?.email && user?.email && String(event.proposer.email).toLowerCase() === String(user.email).toLowerCase())
  );
  const isOrganizer = (organizers || []).some(org => 
    String(org.userId || org.student_id || org.user_id || org.id) === userIdStr ||
    (org.email && user?.email && String(org.email).toLowerCase() === String(user.email).toLowerCase())
  );

  // Faculty Coordinators, Admins, and Event Heads have unrestricted full access over everything
  const isSuperUser = isAdmin || isFacultyRole || isEventFaculty || isFacultyOrg || isEventHead;

  // Task creation is strictly permitted for: Admins, Faculty Coordinators, and the Student Lead (who created the event).
  // For all other student organizers, the Add Task / New Task option is strictly hidden.
  const canAddTask = Boolean(isAdmin || isFacultyRole || isEventFaculty || isFacultyOrg || isEventHead);

  const isModuleAllowed = (moduleId) => {
    if (!event || !user) return false;
    if (isSuperUser) return true;

    // Find current user's organizer/member record
    const myOrg = (organizers || []).find(org => 
      String(org.userId || org.student_id || org.user_id || org.id) === userIdStr ||
      (org.email && user?.email && String(org.email).toLowerCase() === String(user.email).toLowerCase())
    );
    
    // If not found in organizers list, they don't have access to normal organizer modules
    if (!myOrg) return false;

    const allowed = myOrg.allowed_modules || myOrg.allowedModules;
    if (!allowed || (Array.isArray(allowed) && allowed.includes('all'))) {
      return true;
    }

    if (Array.isArray(allowed)) {
      if (moduleId === 'confirmed_teams' && allowed.includes('registrations')) return true;
      if (moduleId === 'slots' && (allowed.includes('registrations') || allowed.includes('slots'))) return true;
      return allowed.includes(moduleId);
    }
    return true;
  };

  const hasFullAccess = () => {
    if (!event || !user) return false;
    return isSuperUser || isOrganizer;
  };

  const canManageTasks = isSuperUser || isModuleAllowed('tasks');

  const canAssignTasks = () => {
    return canManageTasks;
  };

  const ALL_ORDERED_MODULES = [
    'tasks',
    'discussion',
    'team',
    'registrations',
    'slots',
    'allocation',
    'scoring',
    'periodic_attendance',
    'id_cards',
    'certificates',
    'feedback'
  ];

  // Auto-redirect if current activeTab is not permitted for the user
  useEffect(() => {
    if (!loading && event && user) {
      const currentMod = activeTab === 'confirmed_teams' ? 'registrations' : activeTab;
      if (!isModuleAllowed(currentMod)) {
        const firstPermitted = ALL_ORDERED_MODULES.find(m => isModuleAllowed(m));
        if (firstPermitted && firstPermitted !== activeTab) {
          handleTabChange(firstPermitted);
        }
      }
    }
  }, [loading, activeTab, organizers, user?.id]);

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'To Do').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const blockedTasks = tasks.filter(t => t.status === 'Blocked').length;
  const overdueTasksCount = tasks.filter(t => {
    if (t.status === 'Completed' || !t.deadline) return false;
    const d = new Date(t.deadline);
    d.setHours(23, 59, 59, 999);
    return d < new Date();
  }).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matchTitle = (task.title || '').toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      const matchCat = (task.category || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat) return false;
    }
    if (filters.myTasksOnly) {
      const isAssigned = String(task.assigned_to) === String(user?.id) || String(task.assigned_user?.id) === String(user?.id);
      if (!isAssigned) return false;
    }
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.assignedTo && String(task.assigned_to || '') !== String(filters.assignedTo) && String(task.assigned_user?.id || '') !== String(filters.assignedTo)) return false;
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
      <div className="flex justify-center items-center h-screen bg-background transition-colors duration-300">
        <div className="animate-spin w-10 h-10 border-4 border-pastel-lavender border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-pastel-coral text-center p-8 bg-background transition-colors duration-300 min-h-screen">{error}</div>;
  }

  if (!event) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">{event.title} - Workspace</h1>
          <p className="text-text-secondary">Manage tasks and coordinate with your team</p>
        </div>
        <div className="flex items-center gap-3">
          {isModuleAllowed('periodic_attendance') && (
            <button
              type="button"
              onClick={() => {
                setScanFeedback(null);
                setIsScannerOpen(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-heading font-bold text-sm rounded-xl hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center gap-2 border border-white/20 shadow-md cursor-pointer"
            >
              <svg className="h-4 w-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
              </svg>
              <span>Scan QR</span>
            </button>
          )}

          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsActionsDropdownOpen(prev => !prev)}
              className="px-5 py-2.5 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 text-white font-heading font-bold text-sm rounded-xl hover:shadow-lg hover:shadow-fuchsia-500/25 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center gap-2 border border-white/20 shadow-md cursor-pointer"
            >
              <span>Actions</span>
              <svg className={`h-4 w-4 transition-transform duration-200 ${isActionsDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isActionsDropdownOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-60 rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 z-50 p-1.5 space-y-1 animate-fade-in-scale">
                {isModuleAllowed('id_cards') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      setActiveTab('id_cards');
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-fuchsia-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 012-2h2a2 2 0 012 2v2m-4 0h4" />
                    </svg>
                    <span>Import Photos & ID Cards</span>
                  </button>
                )}
                {isSuperUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      setIsConfirmationEmailModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-fuchsia-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Customize Confirmation Email</span>
                  </button>
                )}

                {isSuperUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      setFeedbackQuestions(event.feedback_questions || []);
                      setIsFeedbackQuestionsModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Customize Feedback Questions</span>
                  </button>
                )}

                {isSuperUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      openEditModal();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit Event</span>
                  </button>
                )}

                {isModuleAllowed('periodic_attendance') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      setScanFeedback(null);
                      setIsScannerOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
                    </svg>
                    <span>Scan QR</span>
                  </button>
                )}

                {(isSuperUser || isModuleAllowed('registrations')) && event?.registration_type === 'team' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      setIsAdminCreateTeamOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Team Manually</span>
                  </button>
                )}

                {canManageTasks && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      handleCreateTask();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create Task</span>
                  </button>
                )}

                {isSuperUser && (
                  event.registration_deadline && new Date(event.registration_deadline) <= new Date() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        handleAdminOpenRegistrations();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      <span>Open Registrations</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        handleAdminCloseRegistrations();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Close Registrations</span>
                    </button>
                  )
                )}

                {isSuperUser && event.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      handleMarkCompleted();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Mark as Completed</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Formal Side Navigation Workspace Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-8 mt-6">
        {/* Left Side Navigation Bar */}
        <aside className="w-full lg:w-64 shrink-0 self-start glass-panel p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm sticky top-20">
          <div className="px-3 py-2 mb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Workspace Menu
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
              {event?.status ? event.status.replace(/_/g, ' ') : 'Active'}
            </span>
          </div>

          <nav className="space-y-1">
            {isModuleAllowed('tasks') && (
              <button
                type="button"
                onClick={() => handleTabChange('tasks')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'tasks'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="truncate">Tasks & Progress</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {totalTasks}
                </span>
              </button>
            )}

            {isModuleAllowed('discussion') && (
              <button
                type="button"
                onClick={() => handleTabChange('discussion')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'discussion'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="truncate">Review & Discussion</span>
                </div>
              </button>
            )}

            {isModuleAllowed('team') && (
              <button
                type="button"
                onClick={() => handleTabChange('team')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="truncate">Organizing Team</span>
                </div>
                {organizers.length > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'team' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {organizers.length}
                  </span>
                )}
              </button>
            )}

            {isModuleAllowed('registrations') && (
              <button
                type="button"
                onClick={() => handleTabChange('registrations', 'registrations')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'registrations' || activeTab === 'confirmed_teams'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  <span className="truncate">Registrations</span>
                </div>
              </button>
            )}

            {isModuleAllowed('slots') && (
              <button
                type="button"
                onClick={() => handleTabChange('slots')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'slots'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="truncate">Time Slots & Schedule</span>
                </div>
              </button>
            )}

            {isModuleAllowed('allocation') && (
              <button
                type="button"
                onClick={() => handleTabChange('allocation')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'allocation'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="truncate">Team Allocation</span>
                </div>
              </button>
            )}

            {isModuleAllowed('scoring') && (
              <button
                type="button"
                onClick={() => handleTabChange('scoring')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'scoring'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <span className="truncate">Scoring Board</span>
                </div>
              </button>
            )}

            {isModuleAllowed('periodic_attendance') && (
              <button
                type="button"
                onClick={() => handleTabChange('periodic_attendance')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'periodic_attendance'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span className="truncate">Attendance & QR</span>
                </div>
              </button>
            )}

            {isModuleAllowed('id_cards') && (
              <button
                type="button"
                onClick={() => handleTabChange('id_cards')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'id_cards'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 012-2h2a2 2 0 012 2v2m-4 0h4" />
                  </svg>
                  <span className="truncate">ID Cards</span>
                </div>
              </button>
            )}

            {isModuleAllowed('certificates') && (
              <button
                type="button"
                onClick={() => handleTabChange('certificates')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'certificates'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                  </svg>
                  <span className="truncate">Certificates</span>
                </div>
              </button>
            )}

            {isModuleAllowed('feedback') && (
              <button
                type="button"
                onClick={() => handleTabChange('feedback')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                  activeTab === 'feedback'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-500/25 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="truncate">Feedback Analytics</span>
                </div>
              </button>
            )}
          </nav>
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 min-w-0 w-full">
          {activeTab === 'discussion' && isModuleAllowed('discussion') && (
            <div className="mb-8">
              <ReviewDiscussionTab eventId={eventId} event={event} user={user} hasFullAccess={hasFullAccess()} />
            </div>
          )}

          {activeTab === 'team' && isModuleAllowed('team') && (
            <div className="mb-8">
              <OrganizingTeamTab eventId={eventId} event={event} user={user} hasFullAccess={hasFullAccess()} />
            </div>
          )}

          {activeTab === 'certificates' && isModuleAllowed('certificates') && (
            <div className="mb-8">
              <CertificateManager eventId={eventId} eventStatus={event?.status} />
            </div>
          )}

          {activeTab === 'feedback' && isModuleAllowed('feedback') && (
            <div className="mb-8 glass-panel p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Post-Event Feedback Analytics</h2>
                  <p className="text-xs text-text-secondary">Track student ratings and feedback responses for this event.</p>
                </div>
                {hasFullAccess() && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackQuestions(event.feedback_questions || []);
                      setIsFeedbackQuestionsModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 hover:bg-violet-100 text-xs font-bold rounded-xl transition-all border border-violet-200 dark:border-violet-800 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>Customize Questions</span>
                  </button>
                )}
              </div>
              <FeedbackAnalytics eventId={eventId} />
            </div>
          )}

          {activeTab === 'periodic_attendance' && isModuleAllowed('periodic_attendance') && (
            <div className="mb-8">
              <OrganizerPeriodicAttendance eventId={eventId} onScanClick={() => { setScanFeedback(null); setIsScannerOpen(true); }} />
            </div>
          )}

          {(activeTab === 'registrations' || activeTab === 'confirmed_teams') && isModuleAllowed('registrations') && (
            <div className="mb-8">
              {/* Sub-navigation for Registrations & Confirmed Teams */}
              <div className="mb-6 flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-fit border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationSubTab('registrations');
                    handleTabChange('registrations', 'registrations');
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                    (activeTab === 'registrations' && registrationSubTab === 'registrations') || (activeTab !== 'confirmed_teams' && registrationSubTab === 'registrations')
                      ? 'bg-white dark:bg-slate-900 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Event Registrations</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRegistrationSubTab('confirmed_teams');
                    handleTabChange('confirmed_teams', 'confirmed_teams');
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'confirmed_teams' || (activeTab === 'registrations' && registrationSubTab === 'confirmed_teams')
                      ? 'bg-white dark:bg-slate-900 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Confirmed Teams</span>
                </button>
              </div>

              {activeTab === 'confirmed_teams' || (activeTab === 'registrations' && registrationSubTab === 'confirmed_teams') ? (
                <ConfirmedTeamsOverview eventId={eventId} eventTitle={event?.title} />
              ) : (
                <OrganizerRegistrations eventId={eventId} event={event} />
              )}
            </div>
          )}

          {activeTab === 'slots' && isModuleAllowed('slots') && (
            <div className="mb-8">
              <SlotManagementTab
                eventId={eventId}
                event={event}
                user={user}
                hasFullAccess={hasFullAccess()}
              />
            </div>
          )}

          {activeTab === 'allocation' && isModuleAllowed('allocation') && (
            <div className="mb-8">
              <TeamAllocation eventId={eventId} eventTitle={event?.title} />
            </div>
          )}

          {activeTab === 'scoring' && isModuleAllowed('scoring') && (
            <div className="mb-8">
              <ScoringBoard eventId={eventId} canEdit={hasFullAccess()} />
            </div>
          )}

          {activeTab === 'id_cards' && isModuleAllowed('id_cards') && (
            <div className="mb-8">
              <IDCardManager eventId={eventId} event={event} />
            </div>
          )}

          {activeTab === 'tasks' && isModuleAllowed('tasks') && (
            <>
              {/* Event Progress & Stats Header */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 mb-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <h2 className="text-xl font-black tracking-tight text-white">Tasks & Progress</h2>
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-white/10 text-indigo-200 border border-white/10">
                          {totalTasks} Total Tasks
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Track assignments, update milestones, and collaborate in real-time.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {overdueTasksCount > 0 && (
                        <span className="text-xs font-bold px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full flex items-center gap-1.5 animate-pulse">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {overdueTasksCount} Overdue
                        </span>
                      )}
                      <div className="text-right">
                        <div className="text-2xl font-black text-emerald-400 leading-none">
                          {progressPercent}%
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {completedTasks} of {totalTasks} Completed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-color Segmented Progress Bar */}
                  <div className="w-full bg-slate-800/80 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-700/60 flex gap-0.5">
                    {totalTasks > 0 ? (
                      <>
                        <div 
                          style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                          title={`Completed: ${completedTasks}`}
                        />
                        <div 
                          style={{ width: `${(inProgressTasks / totalTasks) * 100}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full transition-all duration-500" 
                          title={`In Progress: ${inProgressTasks}`}
                        />
                        <div 
                          style={{ width: `${(blockedTasks / totalTasks) * 100}%` }}
                          className="h-full bg-gradient-to-r from-rose-500 to-red-400 rounded-full transition-all duration-500" 
                          title={`Blocked: ${blockedTasks}`}
                        />
                        <div 
                          style={{ width: `${(pendingTasks / totalTasks) * 100}%` }}
                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500" 
                          title={`To Do: ${pendingTasks}`}
                        />
                      </>
                    ) : (
                      <div className="w-full h-full bg-slate-700/50 rounded-full" />
                    )}
                  </div>
                </div>
              </div>

              {/* Task Summary Cards (Interactive Filters) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <button 
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'To Do' ? '' : 'To Do' }))}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                    filters.status === 'To Do'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 ring-2 ring-amber-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${filters.status === 'To Do' ? 'text-amber-100' : 'text-slate-500 dark:text-slate-400'}`}>To Do</span>
                    <span className={`w-2 h-2 rounded-full ${filters.status === 'To Do' ? 'bg-white' : 'bg-amber-500'}`} />
                  </div>
                  <div className={`text-2xl font-black mt-1 ${filters.status === 'To Do' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{pendingTasks}</div>
                </button>

                <button 
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'In Progress' ? '' : 'In Progress' }))}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                    filters.status === 'In Progress'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 ring-2 ring-blue-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${filters.status === 'In Progress' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>In Progress</span>
                    <span className={`w-2 h-2 rounded-full ${filters.status === 'In Progress' ? 'bg-white' : 'bg-blue-500'}`} />
                  </div>
                  <div className={`text-2xl font-black mt-1 ${filters.status === 'In Progress' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{inProgressTasks}</div>
                </button>

                <button 
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'Blocked' ? '' : 'Blocked' }))}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                    filters.status === 'Blocked'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20 ring-2 ring-rose-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${filters.status === 'Blocked' ? 'text-rose-100' : 'text-slate-500 dark:text-slate-400'}`}>Blocked</span>
                    <span className={`w-2 h-2 rounded-full ${filters.status === 'Blocked' ? 'bg-white' : 'bg-rose-500'}`} />
                  </div>
                  <div className={`text-2xl font-black mt-1 ${filters.status === 'Blocked' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{blockedTasks}</div>
                </button>

                <button 
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'Completed' ? '' : 'Completed' }))}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                    filters.status === 'Completed'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${filters.status === 'Completed' ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>Completed</span>
                    <span className={`w-2 h-2 rounded-full ${filters.status === 'Completed' ? 'bg-white' : 'bg-emerald-500'}`} />
                  </div>
                  <div className={`text-2xl font-black mt-1 ${filters.status === 'Completed' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{completedTasks}</div>
                </button>
              </div>

              {/* Toolbar: Search, Filters & View Toggle */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  {/* Search bar */}
                  <div className="relative min-w-[200px] flex-1 max-w-xs">
                    <input 
                      type="text"
                      placeholder="Search tasks..."
                      value={filters.searchQuery}
                      onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                      className="w-full pl-9 pr-7 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                    />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {filters.searchQuery && (
                      <button 
                        type="button" 
                        onClick={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* My tasks toggle */}
                  <button
                    type="button"
                    onClick={() => setFilters(prev => ({ ...prev, myTasksOnly: !prev.myTasksOnly }))}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      filters.myTasksOnly
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>My Tasks</span>
                  </button>

                  {/* Status Filter */}
                  <select 
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                    value={filters.status}
                    onChange={e => setFilters({...filters, status: e.target.value})}
                  >
                    <option value="">All Statuses</option>
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Completed">Completed</option>
                  </select>

                  {/* Priority Filter */}
                  <select 
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                    value={filters.priority}
                    onChange={e => setFilters({...filters, priority: e.target.value})}
                  >
                    <option value="">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>

                  {/* Assignee Filter */}
                  <select 
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer max-w-[140px]"
                    value={filters.assignedTo}
                    onChange={e => setFilters({...filters, assignedTo: e.target.value})}
                  >
                    <option value="">All Assignees</option>
                    {organizers.map(org => {
                      const uid = org.userId || org.id;
                      return (
                        <option key={uid} value={uid}>{org.name}</option>
                      );
                    })}
                  </select>

                  {/* Category Filter */}
                  <select 
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer max-w-[140px]"
                    value={filters.category}
                    onChange={e => setFilters({...filters, category: e.target.value})}
                  >
                    <option value="">All Teams</option>
                    {suggestedCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {(filters.status || filters.priority || filters.assignedTo || filters.category || filters.searchQuery || filters.myTasksOnly) && (
                    <button 
                      onClick={() => setFilters({status: '', priority: '', assignedTo: '', category: '', searchQuery: '', myTasksOnly: false})}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold px-2 py-1 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Right Actions: View Mode + Add Task */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* View Mode Toggle */}
                  <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setTaskViewMode('board')}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        taskViewMode === 'board'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Kanban Board View"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskViewMode('list')}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        taskViewMode === 'list'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Table List View"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </button>
                  </div>

                  {canAddTask && (
                    <button
                      type="button"
                      onClick={() => handleCreateTask('To Do')}
                      className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-extrabold rounded-xl hover:shadow-md hover:shadow-indigo-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>New Task</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Task Content: Board vs List */}
              {taskViewMode === 'board' ? (
                <TaskBoard 
                  tasks={filteredTasks} 
                  organizers={organizers}
                  onViewTask={handleViewTask} 
                  onEditTask={canAddTask ? handleEditTask : undefined}
                  onStatusChange={handleQuickStatusChange}
                  onQuickAddTask={canAddTask ? handleCreateTask : undefined}
                  hasFullAccess={canAddTask}
                />
              ) : (
                <TaskListView 
                  tasks={filteredTasks}
                  organizers={organizers}
                  onViewTask={handleViewTask}
                  onEditTask={canAddTask ? handleEditTask : undefined}
                  onStatusChange={handleQuickStatusChange}
                  hasFullAccess={canAddTask}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <TaskModal 
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={editingTask}
        initialStatus={initialTaskStatus}
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
        hasFullAccess={canAddTask}
        currentUserId={user.id}
        onUpdate={() => fetchWorkspaceData(true)}
      />

      {/* QR Scanner Modal */}
      {isScannerOpen && (
        <Modal
          isOpen={isScannerOpen}
          onClose={() => { setIsScannerOpen(false); window.location.reload(); }}
          title="Scan Participant QR Code"
        >
          <div className="flex flex-col items-center gap-4 py-4">
            {scanFeedback && (
              <div className={`w-full p-3 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                scanFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                <span>{scanFeedback.type === 'success' ? '✓' : '⚠'}</span>
                <span>{scanFeedback.message}</span>
              </div>
            )}

            <div className="w-full max-w-sm rounded-xl overflow-hidden border border-slate-200">
              <QRScanner
                onScanSuccess={handleScanSuccess}
                onScanFailure={() => {}}
              />
            </div>

            <div className="mt-2 flex justify-end w-full">
              <button
                onClick={() => { setIsScannerOpen(false); window.location.reload(); }}
                className="px-5 py-2.5 text-sm font-bold rounded-xl btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Event Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Event Details"
          subtitle="Update event information. Changes persist without altering publication status."
        >
          {editFeedback && (
            <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex gap-2.5 animate-fade-in-up ${
              editFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
            }`}>
              <span>{editFeedback.type === 'success' ? '✓' : '⚠'}</span>
              <span>{editFeedback.message}</span>
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Event Title *</label>
              <input
                type="text"
                required
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/60"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Description *</label>
              <textarea
                rows={3}
                required
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/60 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Category *</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/60"
                >
                  {['General', 'Workshop', 'Cultural', 'Tech', 'Hackathon', 'Sports', 'Seminar', 'Web Development', 'Gaming', 'Competition'].map(cat => (
                    <option key={cat} value={cat} className="dark:bg-slate-900 text-text-primary">{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Venue *</label>
                <input
                  type="text"
                  required
                  value={editFormData.venue}
                  onChange={(e) => setEditFormData({ ...editFormData, venue: e.target.value })}
                  className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Event Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Registration Closing Date</label>
                <input
                  type="datetime-local"
                  value={editFormData.registrationDeadline}
                  onChange={(e) => setEditFormData({ ...editFormData, registrationDeadline: e.target.value })}
                  className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/60"
                />
              </div>
            </div>

            {editFormData.registrationType === 'team' ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Max Teams</label>
                  <input
                    type="number"
                    min="1"
                    value={editFormData.maxTeams}
                    onChange={(e) => setEditFormData({ ...editFormData, maxTeams: e.target.value })}
                    className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Min Team Size</label>
                  <input
                    type="number"
                    min="1"
                    value={editFormData.minTeamSize}
                    onChange={(e) => setEditFormData({ ...editFormData, minTeamSize: e.target.value })}
                    className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Max Team Size</label>
                  <input
                    type="number"
                    min="1"
                    value={editFormData.maxTeamSize}
                    onChange={(e) => setEditFormData({ ...editFormData, maxTeamSize: e.target.value })}
                    className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Number of Slots (Capacity)</label>
                <input
                  type="number"
                  min="1"
                  value={editFormData.capacity}
                  onChange={(e) => setEditFormData({ ...editFormData, capacity: e.target.value })}
                  className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-3.5 bg-violet-500/5 dark:bg-violet-950/20 border border-violet-500/15 rounded-xl">
              <div>
                <h4 className="text-xs font-bold text-text-primary">Enable Slot-Wise Registration</h4>
                <p className="text-[10px] text-text-secondary">Allow students/teams to choose their preferred time slot during registration</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={editFormData.has_slots} 
                  onChange={(e) => setEditFormData({ ...editFormData, has_slots: e.target.checked })}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Event Poster Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={editFormData.imageUrl}
                onChange={(e) => setEditFormData({ ...editFormData, imageUrl: e.target.value })}
                className="w-full bg-white/10 dark:bg-slate-800/40 text-text-primary border border-pastel-lavender/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-pastel-lavender/20">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="btn-primary px-6 py-2.5 text-xs font-bold rounded-xl text-white shadow-lg disabled:opacity-50"
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {event && (
        <AdminCreateTeamModal
          isOpen={isAdminCreateTeamOpen}
          onClose={() => setIsAdminCreateTeamOpen(false)}
          events={[event]}
          preSelectedEventId={eventId}
          onSuccess={fetchWorkspaceData}
        />
      )}

      {event && (
        <ConfirmationEmailModal
          isOpen={isConfirmationEmailModalOpen}
          onClose={() => setIsConfirmationEmailModalOpen(false)}
          eventId={eventId}
          event={event}
          onUpdate={() => fetchWorkspaceData(true)}
        />
      )}

      {event && (
        <Modal
          isOpen={isFeedbackQuestionsModalOpen}
          onClose={() => setIsFeedbackQuestionsModalOpen(false)}
          title={`Customize Feedback Questions — ${event?.title || ''}`}
        >
          <div className="space-y-6">
            <FeedbackQuestionBuilder questions={feedbackQuestions} setQuestions={setFeedbackQuestions} />
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsFeedbackQuestionsModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFeedbackQuestions}
                className="btn-primary px-6 py-2.5 text-xs font-display font-bold rounded-xl text-white shadow-lg shadow-violet-500/20"
              >
                Save Questions
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Workspace;
