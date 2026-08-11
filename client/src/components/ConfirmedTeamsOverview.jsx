import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

const ConfirmedTeamsOverview = ({ eventId, eventTitle }) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConfirmedTeams = async () => {
      try {
        const response = await axios.get(`/api/registrations/event/${eventId}/confirmed-teams`);
        setTeams(response.data);
      } catch (err) {
        console.error('Error fetching confirmed teams:', err);
        setError(err.response?.data?.message || 'Failed to fetch confirmed teams.');
      } finally {
        setLoading(false);
      }
    };

    if (eventId && user) {
      fetchConfirmedTeams();
    }
  }, [eventId, user]);

  const formatAttendanceTimestamp = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';

    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
  };

  const handleExportExcel = () => {
    if (!teams || teams.length === 0) return;

    // Flatten data for Excel
    const exportData = [];
    
    teams.forEach((team) => {
      const leader = team.members.find(m => m.userId === team.leaderId);
      const leaderName = leader ? leader.name : 'Unknown';

      team.members.forEach((member) => {
        const isPresent = member.attendanceStatus === 'Present';

        exportData.push({
          'Team Name': team.name,
          'Team Leader': leaderName,
          'Team Leader Contact Number': team.leaderContactNumber || 'N/A',
          'Member Name': member.name,
          'Roll Number': member.rollNumber,
          'Email ID': member.email,
          'Department': member.department,
          'Attendance Status': isPresent ? 'Present' : 'Not Present',
          'Attendance Marked At': isPresent ? formatAttendanceTimestamp(member.attendanceTimestamp) : '—'
        });
      });
    });

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Confirmed Teams');

    // Auto-size columns for better readability
    const colWidths = [
      { wch: 20 }, // Team Name
      { wch: 20 }, // Team Leader
      { wch: 25 }, // Team Leader Contact Number
      { wch: 25 }, // Member Name
      { wch: 20 }, // Roll Number
      { wch: 30 }, // Email ID
      { wch: 30 }, // Department
      { wch: 20 }, // Attendance Status
      { wch: 25 }, // Attendance Marked At
    ];
    worksheet['!cols'] = colWidths;

    // Generate filename
    const sanitizedTitle = (eventTitle || 'Event').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedTitle}_confirmed_teams.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#ff3e6c]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <p>{error}</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Confirmed Teams Yet</h3>
        <p className="text-gray-500 max-w-sm mx-auto">
          There are currently no fully confirmed teams for this event. Teams will appear here once the team leader confirms the registration.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section with Stats and Export Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Confirmed Teams Overview</h2>
          <p className="text-sm text-gray-500 mt-1">
            Total Confirmed Teams: <span className="font-semibold text-gray-900">{teams.length}</span>
          </p>
        </div>
        
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-[#ff3e6c] hover:bg-[#e0355f] text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#ff3e6c]/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export to Excel
        </button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teams.map((team) => (
          <div 
            key={team.id} 
            className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow duration-200"
          >
            {/* Team Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff3e6c] to-[#ff7e95] flex items-center justify-center text-white font-bold shadow-sm">
                  {team.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{team.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold text-gray-700">Team Leader:</span> {team.members.find(m => m.userId === team.leaderId)?.name || 'Unknown'}
                    </p>
                    <span className="text-gray-300">•</span>
                    <p className="text-xs text-gray-600 font-medium">Total Members: {team.members.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Members List */}
            <div className="divide-y divide-gray-50">
              {team.members.map((member) => (
                <div key={member.userId} className="p-4 sm:px-6 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{member.name}</span>
                      {member.userId === team.leaderId && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                          Team Leader
                        </span>
                      )}
                    </div>
                    <div>
                      {member.attendanceStatus === 'Present' ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                          <span>✓</span> Attendance Marked
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full border border-gray-200">
                          Not Marked
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 mt-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                      <span className="truncate">{member.department}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>
                      <span className="truncate">{member.rollNumber}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConfirmedTeamsOverview;
