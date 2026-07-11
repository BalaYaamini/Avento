import React from 'react';
import TaskCard from './TaskCard';

const TaskBoard = ({ tasks, onViewTask, onEditTask }) => {
  const columns = [
    { id: 'To Do', title: 'To Do', accentBadge: 'bg-amber-100 text-amber-700', borderAccent: 'border-t-amber-400' },
    { id: 'In Progress', title: 'In Progress', accentBadge: 'bg-blue-100 text-blue-700', borderAccent: 'border-t-blue-400' },
    { id: 'Blocked', title: 'Blocked', accentBadge: 'bg-red-100 text-red-700', borderAccent: 'border-t-red-400' },
    { id: 'Completed', title: 'Completed', accentBadge: 'bg-emerald-100 text-emerald-700', borderAccent: 'border-t-emerald-400' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {columns.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        return (
          <div key={col.id} className={`rounded-[2rem] border border-slate-200 scrapbook-panel p-4 flex flex-col min-h-[500px] border-t-4 ${col.borderAccent}`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200/50">
              <h3 className="font-bold text-text-primary">{col.title}</h3>
              <span className={`${col.accentBadge} px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm`}>
                {columnTasks.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pb-2">
              {columnTasks.length > 0 ? (
                columnTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onClick={() => onViewTask(task)} 
                    onEdit={onEditTask ? () => onEditTask(task) : undefined}
                  />
                ))
              ) : (
                <div className="text-center p-4 border-2 border-dashed border-slate-200/60 rounded-lg text-slate-400 text-sm">
                  No tasks
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
