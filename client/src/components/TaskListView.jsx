import React, { useState } from 'react';

const TaskListView = ({ 
  tasks = [], 
  organizers = [], 
  onViewTask, 
  onEditTask, 
  onStatusChange,
  hasFullAccess = false 
}) => {
  const [sortField, setSortField] = useState('deadline');
  const [sortAsc, setSortAsc] = useState(true);

  const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
  const statusOrder = { 'To Do': 1, 'In Progress': 2, 'Blocked': 3, 'Completed': 4 };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let comp = 0;
    if (sortField === 'title') {
      comp = (a.title || '').localeCompare(b.title || '');
    } else if (sortField === 'priority') {
      comp = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    } else if (sortField === 'status') {
      comp = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    } else if (sortField === 'deadline') {
      const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      comp = dateA - dateB;
    }
    return sortAsc ? comp : -comp;
  });

  const priorityStyles = {
    'High': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    'Medium': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    'Low': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
  };

  const statusStyles = {
    'To Do': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    'In Progress': 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    'Blocked': 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    'Completed': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
  };

  const getDeadlineDisplay = (task) => {
    if (!task.deadline) return <span className="text-slate-400 text-xs italic">No deadline</span>;
    const deadlineDate = new Date(task.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dDate = new Date(deadlineDate);
    dDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (task.status === 'Completed') {
      return (
        <span className="text-xs text-slate-400 font-medium">
          {deadlineDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      );
    }

    if (diffDays < 0) {
      return (
        <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-800/60">
          Overdue ({Math.abs(diffDays)}d)
        </span>
      );
    }
    if (diffDays === 0) {
      return (
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
          Due Today
        </span>
      );
    }
    if (diffDays === 1) {
      return (
        <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800/60">
          Due Tomorrow
        </span>
      );
    }
    return (
      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
        {deadlineDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-sm font-semibold text-slate-400">No tasks found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              <th className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('title')}>
                <div className="flex items-center gap-1">
                  <span>Task Title</span>
                  {sortField === 'title' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {sortField === 'status' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('priority')}>
                <div className="flex items-center gap-1">
                  <span>Priority</span>
                  {sortField === 'priority' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th className="py-3.5 px-4">Assignee</th>
              <th className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('deadline')}>
                <div className="flex items-center gap-1">
                  <span>Deadline</span>
                  {sortField === 'deadline' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
            {sortedTasks.map(task => {
              const assignedOrg = organizers?.find(o => String(o.userId || o.id) === String(task.assigned_to));
              const assigneeName = 
                task.assigned_user?.name || 
                task.assigned_user?.fullName || 
                assignedOrg?.name || 
                (task.assigned_to ? 'Assigned Organizer' : 'Unassigned');
              const initial = assigneeName !== 'Unassigned' ? assigneeName.charAt(0).toUpperCase() : '?';

              return (
                <tr 
                  key={task.id} 
                  onClick={() => onViewTask(task)}
                  className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  {/* Title & Category */}
                  <td className="py-3.5 px-4 min-w-[220px]">
                    <div className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {task.title}
                    </div>
                    {task.category && (
                      <span className="inline-block text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mt-1 border border-slate-200/60 dark:border-slate-700/60">
                        {task.category}
                      </span>
                    )}
                  </td>

                  {/* Status Dropdown */}
                  <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                    {onStatusChange ? (
                      <select
                        value={task.status}
                        onChange={(e) => onStatusChange(task.id, e.target.value)}
                        className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${statusStyles[task.status] || 'bg-slate-100'}`}
                      >
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Blocked">Blocked</option>
                        <option value="Completed">Completed</option>
                      </select>
                    ) : (
                      <span className={`text-xs font-bold rounded-lg px-2.5 py-1 border inline-block ${statusStyles[task.status] || 'bg-slate-100'}`}>
                        {task.status}
                      </span>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="py-3.5 px-4">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border inline-block ${priorityStyles[task.priority] || priorityStyles['Medium']}`}>
                      {task.priority || 'Medium'}
                    </span>
                  </td>

                  {/* Assignee */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        assigneeName !== 'Unassigned' 
                          ? 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {initial}
                      </div>
                      <span className={`text-xs truncate max-w-[130px] font-semibold ${
                        assigneeName !== 'Unassigned' ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic'
                      }`}>
                        {assigneeName}
                      </span>
                    </div>
                  </td>

                  {/* Deadline */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getDeadlineDisplay(task)}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewTask(task)}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                      >
                        Details
                      </button>

                      {hasFullAccess && onEditTask && (
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Task"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskListView;
