import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, supabase } from '../context/AuthContext';
import axios from 'axios';
import TaskBoard from '../components/TaskBoard';
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
      registrationType: event.registration_type || 'individual'
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
        date: editFormData.date ? (editFormData.date.includes('Z') || editFormData.date.includes('+') ? editFormData.date : new Date(editFormData.date).toISOString()) : undefined,
        registrationDeadline: editFormData.registrationDeadline ? (editFormData.registrationDeadline.includes('Z') || editFormData.registrationDeadline.includes('+') ? editFormData.registrationDeadline : new Date(editFormData.registrationDeadline).toISOString()) : null,
      };
      const res = await axios.put(`/api/events/${eventId}`, payload);
      setEditFeedback({ type: 'success', message: 'Event details updated successfully!' });
      setEvent(prev => ({ ...prev, ...res.data }));
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

  const canAssignTasks = () => {
    if (!event || !user) return false;
    const isAdmin = user.roles?.includes('admin') || user.role === 'admin';
    const isFacultyRole = user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer') || user.role === 'faculty' || user.role === 'faculty_organizer';
    const isEventFaculty = String(user.id) === String(event.faculty_id);
    const isFacultyOrg = (organizers || []).some(org => String(org.userId) === String(user.id) && (org.category === 'Faculty' || org.category === 'Faculty Organizer'));
    return isAdmin || (isFacultyRole && (isEventFaculty || isFacultyOrg));
  };

  const hasFullAccess = () => {
    if (!event || !user) return false;
    const isAdmin = user.roles?.includes('admin') || user.role === 'admin';
    const isFacultyRole = user.roles?.includes('faculty') || user.roles?.includes('faculty_organizer') || user.role === 'faculty' || user.role === 'faculty_organizer';
    const isEventFaculty = String(user.id) === String(event.faculty_id);
    const isEventHead = String(user.id) === String(event.student_organizer_id) || String(user.id) === String(event.proposed_by) || String(user.id) === String(event.organizer_id) || String(user.id) === String(event.created_by);
    const isOrganizer = (organizers || []).some(org => String(org.userId) === String(user.id));

    return isAdmin || isFacultyRole || isEventFaculty || isEventHead || isOrganizer;
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
                {hasFullAccess() && (
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
                {hasFullAccess() && (
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

                {hasFullAccess() && (
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

                {hasFullAccess() && (
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

                {user && (user.roles?.includes('admin') || user.role === 'admin') && event?.registration_type === 'team' && (
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

                {hasFullAccess() && (
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

                {user && (user.roles?.includes('admin') || user.role === 'admin') && (
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

                {hasFullAccess() && event.status !== 'completed' && (
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
          </nav>
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 min-w-0 w-full">
          {activeTab === 'discussion' && (
            <div className="mb-8">
              <ReviewDiscussionTab eventId={eventId} event={event} user={user} hasFullAccess={hasFullAccess()} />
            </div>
          )}

          {activeTab === 'team' && (
            <div className="mb-8">
              <OrganizingTeamTab eventId={eventId} event={event} user={user} hasFullAccess={hasFullAccess()} />
            </div>
          )}

          {activeTab === 'certificates' && (
            <div className="mb-8">
              <CertificateManager eventId={eventId} eventStatus={event?.status} />
            </div>
          )}

          {activeTab === 'feedback' && (
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

          {activeTab === 'periodic_attendance' && (
            <div className="mb-8">
              <OrganizerPeriodicAttendance eventId={eventId} onScanClick={() => { setScanFeedback(null); setIsScannerOpen(true); }} />
            </div>
          )}

          {(activeTab === 'registrations' || activeTab === 'confirmed_teams') && (
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

          {activeTab === 'allocation' && (
            <div className="mb-8">
              <TeamAllocation eventId={eventId} eventTitle={event?.title} />
            </div>
          )}

          {activeTab === 'scoring' && (
            <div className="mb-8">
              <ScoringBoard eventId={eventId} canEdit={hasFullAccess()} />
            </div>
          )}

          {activeTab === 'id_cards' && (
            <div className="mb-8">
              <IDCardManager eventId={eventId} event={event} />
            </div>
          )}

          {activeTab === 'tasks' && (
            <>
              {/* Event Progress */}
              <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-text-primary">Event Progress</h2>
                    <span className="text-xs font-bold px-2.5 py-1 bg-pastel-lavender/10 text-pastel-lavender rounded-lg border border-pastel-lavender/20">
                      {totalTasks} Total Tasks
                    </span>
                  </div>
                  <span className="text-lg font-bold text-text-primary">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-[#0F172A] rounded-full h-5 overflow-hidden border border-slate-200">
                  <div className="bg-pastel-lavender h-5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>

              {/* Filters */}
              <div className="glass-panel p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
                <span className="font-medium text-text-secondary mr-2">Filters:</span>
                <select 
                  className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-pastel-lavender bg-white dark:bg-[#1E293B] text-text-primary"
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
                  className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-pastel-lavender bg-white dark:bg-[#1E293B] text-text-primary"
                  value={filters.priority}
                  onChange={e => setFilters({...filters, priority: e.target.value})}
                >
                  <option value="">All Priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>

                <select 
                  className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-pastel-lavender bg-white dark:bg-[#1E293B] text-text-primary"
                  value={filters.assignedTo}
                  onChange={e => setFilters({...filters, assignedTo: e.target.value})}
                >
                  <option value="">All Assignees</option>
                  {organizers.map(org => (
                    <option key={org.userId} value={org.userId}>{org.name}</option>
                  ))}
                </select>

                <select 
                  className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-pastel-lavender bg-white dark:bg-[#1E293B] text-text-primary"
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
                    className="text-sm text-pastel-coral hover:text-red-700 font-bold"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Task Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="scrapbook-panel p-4 rounded-[1.5rem] text-center border-slate-200 border-t-4 border-t-amber-400 shadow-sm transition-transform hover:-translate-y-1">
                  <div className="text-3xl font-black text-amber-500">{pendingTasks}</div>
                  <div className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-1">To Do</div>
                </div>
                <div className="scrapbook-panel p-4 rounded-[1.5rem] text-center border-slate-200 border-t-4 border-t-blue-400 shadow-sm transition-transform hover:-translate-y-1">
                  <div className="text-3xl font-black text-blue-500">{inProgressTasks}</div>
                  <div className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-1">In Progress</div>
                </div>
                <div className="scrapbook-panel p-4 rounded-[1.5rem] text-center border-slate-200 border-t-4 border-t-pastel-coral shadow-sm transition-transform hover:-translate-y-1">
                  <div className="text-3xl font-black text-pastel-coral">{blockedTasks}</div>
                  <div className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-1">Blocked</div>
                </div>
                <div className="scrapbook-panel p-4 rounded-[1.5rem] text-center border-slate-200 border-t-4 border-t-pastel-mint shadow-sm transition-transform hover:-translate-y-1">
                  <div className="text-3xl font-black text-pastel-mint">{completedTasks}</div>
                  <div className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-1">Completed</div>
                </div>
              </div>

              {/* Task Board */}
              <TaskBoard 
                tasks={filteredTasks} 
                onViewTask={handleViewTask} 
                onEditTask={hasFullAccess() ? handleEditTask : undefined}
              />
            </>
          )}
        </main>
      </div>

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
