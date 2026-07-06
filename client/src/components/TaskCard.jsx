import React from 'react';

const TaskCard = ({ task, onClick, onEdit }) => {
  const priorityColors = {
    'High': 'bg-red-100 text-red-700',
    'Medium': 'bg-amber-100 text-amber-700',
    'Low': 'bg-blue-100 text-blue-700'
  };

  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition cursor-pointer relative group"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${priorityColors[task.priority] || priorityColors['Medium']}`}>
          {task.priority}
        </span>
        {onEdit && (
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit Task"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
      
      <h4 className="font-semibold text-slate-800 text-sm mb-1 leading-tight">{task.title}</h4>
      
      {task.category && (
        <span className="inline-block text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded mt-1 mb-3">
          {task.category}
        </span>
      )}
      
      <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100">
        <div className="flex items-center text-xs text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="truncate max-w-[100px]">{task.assigned_user ? task.assigned_user.name : 'Unassigned'}</span>
        </div>
        
        {task.deadline && (
          <div className={`text-xs ${new Date(task.deadline) < new Date() && task.status !== 'Completed' ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
            {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
