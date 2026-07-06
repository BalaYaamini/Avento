import React from 'react';
import TaskCard from './TaskCard';

const TaskBoard = ({ tasks, onViewTask, onEditTask }) => {
  const columns = [
    { id: 'To Do', title: 'To Do', bgColor: 'bg-slate-100', borderColor: 'border-slate-200' },
    { id: 'In Progress', title: 'In Progress', bgColor: 'bg-blue-50', borderColor: 'border-blue-100' },
    { id: 'Blocked', title: 'Blocked', bgColor: 'bg-red-50', borderColor: 'border-red-100' },
    { id: 'Completed', title: 'Completed', bgColor: 'bg-green-50', borderColor: 'border-green-100' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {columns.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        return (
          <div key={col.id} className={`rounded-xl border ${col.borderColor} ${col.bgColor} p-4 flex flex-col min-h-[500px]`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200/50">
              <h3 className="font-bold text-slate-700">{col.title}</h3>
              <span className="bg-white px-2 py-0.5 rounded-full text-xs font-semibold text-slate-500 shadow-sm">
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
