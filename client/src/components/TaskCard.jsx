import React, { useState } from 'react';

const TaskCard = ({ task, organizers = [], onClick, onEdit, onStatusChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const priorityConfig = {
    'High': { badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', dot: 'bg-red-500' },
    'Medium': { badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-500' },
    'Low': { badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' }
  };

  const assignedOrg = organizers?.find(o => String(o.userId || o.id) === String(task.assigned_to));
  const assigneeName = 
    task.assigned_user?.name || 
    task.assigned_user?.fullName || 
    assignedOrg?.name || 
    (task.assigned_to ? 'Assigned Organizer' : 'Unassigned');

  const assigneeInitial = assigneeName !== 'Unassigned' ? assigneeName.charAt(0).toUpperCase() : '?';

  // Calculate deadline urgency
  const getDeadlineBadge = () => {
    if (!task.deadline) return null;
    const deadlineDate = new Date(task.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dDate = new Date(deadlineDate);
    dDate.setHours(0, 0, 0, 0);
    
    const diffTime = dDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (task.status === 'Completed') {
      return (
        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
          <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {deadlineDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      );
    }

    if (diffDays < 0) {
      return (
        <span className="text-[11px] font-extrabold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800/60 flex items-center gap-1 animate-pulse">
          <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Overdue ({Math.abs(diffDays)}d)
        </span>
      );
    }

    if (diffDays === 0) {
      return (
        <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
          <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Due Today
        </span>
      );
    }

    if (diffDays === 1) {
      return (
        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/60">
          Due Tomorrow
        </span>
      );
    }

    return (
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {deadlineDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
    );
  };

  const currentPriority = priorityConfig[task.priority] || priorityConfig['Medium'];

  const statusOptions = ['To Do', 'In Progress', 'Blocked', 'Completed'];

  return (
    <div 
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.setData('taskId', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-lg hover:border-indigo-400/50 dark:hover:border-indigo-500/40 transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
      }`}
      onClick={onClick}
    >
      {/* Top row: Priority & Edit */}
      <div className="flex justify-between items-center mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${currentPriority.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${currentPriority.dot}`} />
            {task.priority || 'Medium'}
          </span>

          {task.category && (
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60 truncate max-w-[120px]" title={task.category}>
              {task.category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {onStatusChange && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Change status"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </button>

              {showStatusMenu && (
                <div 
                  className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setShowStatusMenu(false)}
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                    Move to
                  </div>
                  {statusOptions.map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={st === task.status}
                      onClick={() => {
                        onStatusChange(task.id, st);
                        setShowStatusMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-semibold flex items-center justify-between transition-colors ${
                        st === task.status 
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{st}</span>
                      {st === task.status && (
                        <svg className="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {onEdit && (
            <button 
              type="button"
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Edit Task"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Title */}
      <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}
      
      {/* Footer: Assignee & Deadline */}
      <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
            assigneeName !== 'Unassigned' 
              ? 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-xs' 
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
          }`}>
            {assigneeInitial}
          </div>
          <span 
            className={`text-xs truncate max-w-[110px] font-semibold ${
              assigneeName !== 'Unassigned' 
                ? 'text-slate-800 dark:text-slate-200' 
                : 'text-slate-400 dark:text-slate-500 italic'
            }`} 
            title={assigneeName}
          >
            {assigneeName}
          </span>
        </div>
        
        <div className="shrink-0">
          {getDeadlineBadge()}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
