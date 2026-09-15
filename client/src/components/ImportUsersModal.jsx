import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

const ImportUsersModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [targetRole, setTargetRole] = useState('faculty'); // 'faculty', 'official', 'student', 'from_file'
  const [rawRows, setRawRows] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [failedRecords, setFailedRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle', 'parsing', 'validating', 'importing', 'success', 'error'
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const getRoleBadge = (role) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
          🏛️ University Admin
        </span>
      );
    }
    if (r === 'faculty' || r === 'faculty_organizer') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
          👨‍🏫 Faculty
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
        🎓 Student
      </span>
    );
  };

  const downloadTemplate = () => {
    let sampleData = [];
    if (targetRole === 'official') {
      sampleData = [
        { fullName: 'Dr. Robert King', email: 'robert.king@example.com', department: 'Dean Academics', employeeId: 'OFF001' },
        { fullName: 'Dr. Sarah Connor', email: 'sarah.connor@example.com', department: 'Registrar Office', employeeId: 'OFF002' }
      ];
    } else if (targetRole === 'faculty') {
      sampleData = [
        { fullName: 'Dr. Jane Smith', email: 'jane.smith@example.com', department: 'CSE', employeeId: 'FAC100' },
        { fullName: 'Prof. Alan Turing', email: 'alan.turing@example.com', department: 'AIML', employeeId: 'FAC101' }
      ];
    } else if (targetRole === 'student') {
      sampleData = [
        { fullName: 'John Doe', email: 'john.doe@example.com', department: 'CSE', rollNumber: '21001' },
        { fullName: 'Alice Johnson', email: 'alice.j@example.com', department: 'CSE', rollNumber: '21002' }
      ];
    } else {
      sampleData = [
        { fullName: 'Dr. Robert King', email: 'robert.king@example.com', role: 'admin', department: 'Administration', employeeId: 'OFF001', rollNumber: '' },
        { fullName: 'Dr. Jane Smith', email: 'jane.smith@example.com', role: 'faculty', department: 'CSE', employeeId: 'FAC100', rollNumber: '' },
        { fullName: 'John Doe', email: 'john.doe@example.com', role: 'student', department: 'CSE', employeeId: '', rollNumber: '21001' }
      ];
    }

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    const label = targetRole === 'official' ? 'Official' : (targetRole === 'faculty' ? 'Faculty' : (targetRole === 'student' ? 'Student' : 'Users'));
    XLSX.writeFile(wb, `Avento_${label}_Import_Template.xlsx`);
  };

  const downloadFailedRecords = () => {
    const ws = XLSX.utils.json_to_sheet(failedRecords.map(r => ({
      'Excel Row Number': r.rowNum || '-',
      'Name': r.fullName || '-',
      'Email': r.email || '-',
      'Roll Number': r.rollNumber || '-',
      'Employee ID': r.employeeId || '-',
      'Department': r.department || '-',
      'Role': r.role || '-',
      'Import Status': r.importStatus || 'Failed',
      'Reason': r.reason || '-'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Failed Records');
    XLSX.writeFile(wb, 'Avento_Failed_Imports.xlsx');
  };

  const handleRoleChange = (newRole) => {
    setTargetRole(newRole);
    if (rawRows.length > 0) {
      validateData(rawRows, newRole);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file) => {
    setStatus('parsing');
    setFailedRecords([]);
    setPreviewData([]);
    setTotalRecords(0);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        setRawRows(json);
        validateData(json, targetRole);
      } catch (err) {
        setStatus('error');
        setMessage('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateData = (data, currentTargetRole = targetRole) => {
    setStatus('validating');
    const invalidData = [];
    const validData = [];

    if (!data || data.length === 0) {
      setStatus('error');
      setMessage('File is empty or incorrectly formatted.');
      return;
    }
    
    setTotalRecords(data.length);

    data.forEach((row, index) => {
      const rowNum = index + 2; // +1 for 0-index, +1 for header
      const email = String(row.email || '').trim().toLowerCase();
      const fullName = String(row.fullName || '').trim();
      let department = row.department ? String(row.department).trim() : '';
      let rollNumber = row.rollNumber ? String(row.rollNumber).trim() : (row.roll_number ? String(row.roll_number).trim() : '');
      let employeeId = row.employeeId ? String(row.employeeId).trim() : (row.employee_id ? String(row.employee_id).trim() : '');

      let resolvedRole = 'student';
      if (currentTargetRole === 'official') {
        resolvedRole = 'admin';
      } else if (currentTargetRole === 'faculty') {
        resolvedRole = 'faculty';
      } else if (currentTargetRole === 'student') {
        resolvedRole = 'student';
      } else {
        const fileRole = row.role ? String(row.role).trim().toLowerCase() : '';
        if (fileRole === 'official' || fileRole === 'university official' || fileRole === 'admin') {
          resolvedRole = 'admin';
        } else if (fileRole === 'faculty') {
          resolvedRole = 'faculty';
        } else {
          resolvedRole = 'student';
        }
      }
      
      let reason = null;
      if (!fullName) reason = 'Missing required field: fullName';
      else if (!email) reason = 'Missing required field: email';
      else if (!email.includes('@')) reason = 'Invalid email format';
      
      const record = { rowNum, fullName, email, department, rollNumber, employeeId, role: resolvedRole };
      
      if (reason) {
        invalidData.push({ ...record, reason, importStatus: 'Failed' });
      } else {
        validData.push(record);
      }
    });

    setPreviewData(validData);
    setFailedRecords(invalidData);
    
    if (validData.length > 0) {
      setStatus('idle');
      setMessage(invalidData.length > 0 ? `Found ${validData.length} valid rows and ${invalidData.length} invalid rows.` : '');
    } else {
      setStatus('error');
      setMessage('No valid rows found in the file.');
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;
    setStatus('importing');
    setMessage('');

    try {
      const defaultRolePayload = targetRole === 'official' ? 'admin' : (targetRole === 'faculty' ? 'faculty' : (targetRole === 'student' ? 'student' : undefined));
      const res = await axios.post('/api/users/import', { 
        users: previewData,
        defaultRole: defaultRolePayload
      });
      
      setStatus('success');
      setMessage('Import Completed');
      
      let backendFailures = [];
      if (res.data.errors && res.data.errors.length > 0) {
        backendFailures = res.data.errors.map(err => {
          const matched = previewData.find(p => p.email === err.email) || {};
          const isSkipped = err.reason && err.reason.toLowerCase().includes('skipped');
          
          return {
            rowNum: matched.rowNum || '-',
            fullName: matched.fullName || '-',
            rollNumber: matched.rollNumber || '-',
            employeeId: matched.employeeId || '-',
            email: err.email,
            department: matched.department || '-',
            role: matched.role || '-',
            importStatus: isSkipped ? 'Skipped' : 'Failed',
            reason: err.reason
          };
        });
      }
      
      const allFailures = [...failedRecords, ...backendFailures];
      setFailedRecords(allFailures);
      
      setSummary({
        total: totalRecords,
        successful: res.data.summary?.successful || 0,
        failed: (res.data.summary?.failed || 0) + failedRecords.length,
        skipped: res.data.summary?.skipped || 0
      });
      
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || err.message || 'Failed to import users.');
    }
  };

  const resetState = () => {
    setFile(null);
    setRawRows([]);
    setPreviewData([]);
    setFailedRecords([]);
    setStatus('idle');
    setMessage('');
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (status === 'success') {
      onImportSuccess();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[90vw] lg:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-pastel-lavender/20 flex justify-between items-center bg-pastel-lavender/5">
          <div>
            <h2 className="font-heading text-xl font-bold text-text-primary">Import Users</h2>
            <p className="text-xs text-text-secondary font-quicksand mt-0.5">
              Choose user specification to import university officials, faculty coordinators, or students from any email domain.
            </p>
          </div>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6">
          
          {/* Target Role / Specification Selector */}
          {status !== 'success' && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                  Select User Specification to Import:
                </label>
                <span className="text-[11px] font-semibold text-slate-500">
                  Choose before or after upload
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => handleRoleChange('faculty')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    targetRole === 'faculty'
                      ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base mb-0.5">👨‍🏫</span>
                  <span className="text-xs font-bold">Faculty Member</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('official')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    targetRole === 'official'
                      ? 'border-purple-500 bg-purple-50 text-purple-800 shadow-sm ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base mb-0.5">🏛️</span>
                  <span className="text-xs font-bold">University Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('student')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    targetRole === 'student'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base mb-0.5">🎓</span>
                  <span className="text-xs font-bold">Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('from_file')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    targetRole === 'from_file'
                      ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base mb-0.5">📄</span>
                  <span className="text-xs font-bold">From File Column</span>
                </button>
              </div>
            </div>
          )}

          {/* Instructions & Template */}
          {status !== 'success' && (
            <div className="bg-pastel-mint/10 border border-pastel-mint/30 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-text-primary mb-1">
                  Download {targetRole === 'official' ? 'University Official' : (targetRole === 'faculty' ? 'Faculty' : (targetRole === 'student' ? 'Student' : 'Users'))} Template
                </h3>
                <p className="text-xs text-text-secondary font-quicksand">
                  Formatted for <strong>{targetRole === 'official' ? 'University Officials' : (targetRole === 'faculty' ? 'Faculty Members' : (targetRole === 'student' ? 'Students' : 'Multi-role import'))}</strong> with any email domain.
                </p>
              </div>
              <button 
                onClick={downloadTemplate}
                className="btn-secondary whitespace-nowrap px-4 py-2 text-xs font-bold rounded-xl"
              >
                Get Template (.xlsx)
              </button>
            </div>
          )}

          {/* Upload Section */}
          {status !== 'success' && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
                Upload Excel / CSV File
              </label>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange}
                ref={fileInputRef}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-xl file:border-0
                  file:text-xs file:font-bold
                  file:bg-pastel-lavender/10 file:text-pastel-lavender
                  hover:file:bg-pastel-lavender/20 transition-all cursor-pointer border-2 border-dashed border-pastel-lavender/30 rounded-2xl p-2"
              />
            </div>
          )}

          {/* Status & Messages */}
          {status === 'error' && (
            <div className="p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span>⚠</span>
                <span>{message}</span>
              </div>
            </div>
          )}

          {status === 'idle' && message && (
            <div className="p-4 bg-pastel-lavender/20 border-2 border-pastel-lavender text-slate-700 rounded-2xl text-sm font-bold font-quicksand flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span>ℹ</span>
                <span>{message}</span>
              </div>
            </div>
          )}

          {status === 'success' && summary && (
            <div className="flex flex-col gap-4">
              <div className="p-6 bg-pastel-mint/10 border-2 border-pastel-mint text-green-700 rounded-3xl text-sm font-bold font-quicksand flex flex-col gap-4 shadow-sm">
                <div className="flex items-center gap-2 text-lg">
                  <span>✓</span>
                  <span>{message}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center bg-white rounded-2xl p-4 shadow-sm border border-pastel-mint/20">
                  <div className="p-2">
                    <div className="text-2xl text-slate-600 font-black">{summary.total}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Total Records</div>
                  </div>
                  <div className="p-2 border-l border-slate-100">
                    <div className="text-2xl text-green-600 font-black">{summary.successful}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Successfully Imported</div>
                  </div>
                  <div className="p-2 border-l border-slate-100">
                    <div className="text-2xl text-yellow-500 font-black">{summary.skipped}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Skipped</div>
                  </div>
                  <div className="p-2 border-l border-slate-100">
                    <div className="text-2xl text-red-500 font-black">{summary.failed}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Failed</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Failed Records Table */}
          {status === 'success' && failedRecords.length > 0 && (
            <div className="flex flex-col gap-3 mt-2 animate-fade-in">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Download unsuccessful records to review and fix.</h3>
                </div>
                <button 
                  onClick={downloadFailedRecords}
                  className="btn-secondary px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border-2 border-pastel-coral text-pastel-coral hover:bg-pastel-coral/10"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Failed Import Records (.xlsx)
                </button>
              </div>
              
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto mt-2 shadow-sm bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Excel Row Number</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Name</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Email</th>
                      <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">ID</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Department</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Role</th>
                      <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Import Status</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {failedRecords.map((row, i) => (
                      <tr key={i} className="hover:bg-red-50/50 transition-colors">
                        <td className="px-4 py-3 text-slate-600 font-mono text-center">{row.rowNum}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{row.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{row.email}</td>
                        <td className="px-4 py-3 text-slate-500">{row.employeeId || row.rollNumber || '-'}</td>
                        <td className="px-4 py-3 text-slate-500">{row.department}</td>
                        <td className="px-4 py-3 text-slate-500">{getRoleBadge(row.role)}</td>
                        <td className={`px-4 py-3 font-bold ${row.importStatus === 'Skipped' ? 'text-yellow-600' : 'text-red-500'}`}>{row.importStatus}</td>
                        <td className="px-4 py-3 text-red-500 font-medium">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && status !== 'success' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">
                    Valid Rows Preview ({previewData.length})
                  </label>
                  <p className="text-xs text-slate-500">
                    Review imported users and their assigned specification before submitting.
                  </p>
                </div>
                {status !== 'importing' && (
                  <button onClick={resetState} className="text-xs text-pastel-coral hover:underline font-bold">Clear All</button>
                )}
              </div>
              <div className="border border-pastel-lavender/20 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b border-pastel-lavender/20">
                      <th className="px-4 py-2 font-bold text-slate-600">Row #</th>
                      <th className="px-4 py-2 font-bold text-slate-600">Full Name</th>
                      <th className="px-4 py-2 font-bold text-slate-600">Email</th>
                      <th className="px-4 py-2 font-bold text-slate-600">Specification / Role</th>
                      <th className="px-4 py-2 font-bold text-slate-600">Department / ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.slice(0, 15).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-500 font-mono">{row.rowNum}</td>
                        <td className="px-4 py-2 text-slate-800 font-medium">{row.fullName}</td>
                        <td className="px-4 py-2 text-slate-600">{row.email}</td>
                        <td className="px-4 py-2">{getRoleBadge(row.role)}</td>
                        <td className="px-4 py-2 text-slate-500">
                          {row.department ? `${row.department}` : ''}
                          {(row.employeeId || row.rollNumber) ? ` (${row.employeeId || row.rollNumber})` : ''}
                        </td>
                      </tr>
                    ))}
                    {previewData.length > 15 && (
                      <tr>
                        <td colSpan="5" className="px-4 py-2 text-center text-slate-400 italic bg-slate-50/50">
                          ...and {previewData.length - 15} more valid rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-pastel-lavender/20 bg-slate-50 flex justify-end gap-3">
          {status === 'success' ? (
            <>
              <button 
                onClick={resetState}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 border-2 border-slate-200 hover:bg-slate-100 transition-colors"
              >
                Start New Import
              </button>
              <button 
                onClick={handleClose}
                className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white shadow-lg shadow-fuchsia-500/15"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleClose}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200/50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleImport}
                disabled={previewData.length === 0 || status === 'importing'}
                className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl text-white shadow-lg shadow-fuchsia-500/15 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {status === 'importing' ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import {previewData.length > 0 ? `${previewData.length} Users` : 'Users'}</span>
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default ImportUsersModal;
