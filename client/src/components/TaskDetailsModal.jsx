import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';

const TaskDetailsModal = ({ isOpen, onClose, task, organizers, hasFullAccess, currentUserId, onUpdate }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      fetchComments();
    }
  }, [isOpen, task]);

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      const res = await axios.get(`/api/tasks/${task.id}/comments`);
      setComments(res.data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await axios.post(`/api/tasks/${task.id}/comments`, {
        message: newComment.trim()
      });
      
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setIsUpdatingStatus(true);
      await axios.put(`/api/tasks/${task.id}`, { status: newStatus });
      
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      setIsDeleting(true);
      await axios.delete(`/api/tasks/${task.id}`);
      
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error deleting task:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!task) return null;

  const canUpdateStatus = true;
  const isAssignedToMe = task.assigned_to === currentUserId;

  const priorityColors = {
    'High': 'bg-red-100 text-red-700',
    'Medium': 'bg-amber-100 text-amber-700',
    'Low': 'bg-blue-100 text-blue-700'
  };

  const statusColors = {
    'To Do': 'bg-slate-100 text-slate-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Completed': 'bg-green-100 text-green-700',
    'Blocked': 'bg-red-100 text-red-700'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Details" maxWidth="max-w-2xl">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Left Col: Details */}
        <div className="flex-1 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${priorityColors[task.priority] || priorityColors['Medium']}`}>
                {task.priority}
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${statusColors[task.status] || statusColors['To Do']}`}>
                {task.status}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{task.title}</h3>
            {task.category && (
              <div className="mt-1 text-sm font-medium text-slate-500">{task.category}</div>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
            {task.description || <span className="text-slate-400 italic">No description provided.</span>}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="block text-slate-500 mb-1 text-xs uppercase font-semibold">Assigned To</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                  {task.assigned_user ? task.assigned_user.name.charAt(0).toUpperCase() : '?'}
                </div>
                <span className="font-medium">{task.assigned_user ? task.assigned_user.name : 'Unassigned'}</span>
                {isAssignedToMe && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1">You</span>}
              </div>
            </div>
            <div>
              <span className="block text-slate-500 mb-1 text-xs uppercase font-semibold">Deadline</span>
              <span className={`font-medium ${task.deadline && new Date(task.deadline) < new Date() && task.status !== 'Completed' ? 'text-red-600' : 'text-slate-700'}`}>
                {task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t flex items-center justify-between">
            {canUpdateStatus ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Change Status:</span>
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isUpdatingStatus}
                  className="text-sm border-slate-300 rounded-md shadow-sm focus:border-slate-500 focus:ring-slate-500 py-1.5 px-3 bg-white"
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">Only assignees or admins can change status.</div>
            )}

            {hasFullAccess && (
              <button
                onClick={handleDeleteTask}
                disabled={isDeleting}
                className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded hover:bg-red-50 transition"
              >
                {isDeleting ? 'Deleting...' : 'Delete Task'}
              </button>
            )}
          </div>
        </div>

        {/* Right Col: Discussion */}
        <div className="w-full md:w-72 flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden h-[500px]">
          <div className="p-3 border-b bg-white">
            <h4 className="font-semibold text-slate-800 text-sm">Discussion</h4>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto space-y-4">
            {loadingComments ? (
              <div className="flex justify-center p-4">
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : comments.length > 0 ? (
              comments.map(comment => (
                <div key={comment.id} className="text-sm">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-bold text-slate-800 text-xs">
                      {comment.profiles?.name || 'User'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(comment.created_at).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className={`p-2 rounded-lg inline-block w-full ${comment.user_id === currentUserId ? 'bg-slate-200 text-slate-800' : 'bg-white border text-slate-700'}`}>
                    {comment.message}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 text-sm py-8 italic">No comments yet.</div>
            )}
          </div>

          <form onSubmit={handleAddComment} className="p-3 bg-white border-t mt-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 text-sm border-slate-300 rounded focus:ring-slate-500 focus:border-slate-500 py-1.5 px-3"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="bg-slate-900 text-white p-1.5 rounded disabled:opacity-50 hover:bg-slate-800 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </form>
        </div>

      </div>
    </Modal>
  );
};

export default TaskDetailsModal;
