import React, { useState } from 'react';
import TaskCard from './TaskCard';

const TaskBoard = ({ 
  tasks = [], 
  organizers = [], 
  onViewTask, 
  onEditTask, 
  onStatusChange, 
  onQuickAddTask,
  hasFullAccess = false 
}) => {
  const [dragOverCol, setDragOverCol] = useState(null);

  const columns = [
    { 
      id: 'To Do', 
      title: 'To Do', 
      accentBadge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20', 
      headerBg: 'from-amber-500/5 to-transparent',
      borderAccent: 'border-t-amber-500',
      dotColor: 'bg-amber-500',
      emptyText: 'No tasks to do'
    },
    { 
      id: 'In Progress', 
      title: 'In Progress', 
      accentBadge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20', 
      headerBg: 'from-blue-500/5 to-transparent',
      borderAccent: 'border-t-blue-500',
      dotColor: 'bg-blue-500',
      emptyText: 'No tasks in progress'
    },
    { 
      id: 'Blocked', 
      title: 'Blocked', 
      accentBadge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20', 
      headerBg: 'from-rose-500/5 to-transparent',
      borderAccent: 'border-t-rose-500',
      dotColor: 'bg-rose-500',
      emptyText: 'No blocked tasks'
    },
    { 
      id: 'Completed', 
      title: 'Completed', 
      accentBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', 
      headerBg: 'from-emerald-500/5 to-transparent',
      borderAccent: 'border-t-emerald-500',
      dotColor: 'bg-emerald-500',
      emptyText: 'No completed tasks'
    }
  ];

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDragLeave = (e, colId) => {
    e.preventDefault();
    if (dragOverCol === colId) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && onStatusChange) {
      onStatusChange(taskId, colId);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {columns.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        const isTarget = dragOverCol === col.id;

        return (
          <div 
            key={col.id} 
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={(e) => handleDragLeave(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`rounded-3xl border bg-slate-50/70 dark:bg-slate-900/40 p-3.5 flex flex-col min-h-[520px] border-t-4 transition-all duration-200 ${col.borderAccent} ${
              isTarget 
                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-2 ring-indigo-400/40 shadow-md' 
                : 'border-slate-200/80 dark:border-slate-800 shadow-xs'
            }`}
          >
            {/* Column Header */}
            <div className={`flex justify-between items-center px-2 py-2 mb-3 rounded-xl bg-gradient-to-b ${col.headerBg}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{col.title}</h3>
                <span className={`${col.accentBadge} px-2 py-0.5 rounded-full text-xs font-black`}>
                  {columnTasks.length}
                </span>
              </div>

              {hasFullAccess && onQuickAddTask && (
                <button
                  type="button"
                  onClick={() => onQuickAddTask(col.id)}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
                  title={`Add task to ${col.title}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Column Task Cards */}
            <div className="flex-1 overflow-y-auto space-y-3 px-0.5 pb-2">
              {columnTasks.length > 0 ? (
                columnTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    organizers={organizers}
                    onClick={() => onViewTask(task)} 
                    onEdit={onEditTask ? () => onEditTask(task) : undefined}
                    onStatusChange={onStatusChange}
                  />
                ))
              ) : (
                <div className={`h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
                  isTarget 
                    ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' 
                    : 'border-slate-200/80 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                }`}>
                  <p className="text-xs font-medium mb-2">{isTarget ? 'Drop task here' : col.emptyText}</p>
                  {hasFullAccess && onQuickAddTask && !isTarget && (
                    <button
                      type="button"
                      onClick={() => onQuickAddTask(col.id)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>+ Add task</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TaskBoard;
