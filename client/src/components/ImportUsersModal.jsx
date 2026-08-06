import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

const ImportUsersModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [failedRecords, setFailedRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle', 'parsing', 'validating', 'importing', 'success', 'error'
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { fullName: 'John Doe', email: 'john.doe@cse.suh.edu.in', department: 'CSE', rollNumber: '21001' },
      { fullName: 'Jane Smith', email: 'jane.smith@suh.edu.in', department: 'CSE', employeeId: 'F100' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'Avento_User_Import_Template.xlsx');
  };

  const downloadFailedRecords = () => {
    const ws = XLSX.utils.json_to_sheet(failedRecords.map(r => ({
      'Row Number': r.rowNum || '-',
      'Name': r.fullName || '-',
      'Roll Number': r.rollNumber || '-',
      'Email': r.email || '-',
      'Department': r.department || '-',
      'Reason': r.reason || '-'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Failed Records');
    XLSX.writeFile(wb, 'Avento_Failed_Imports.xlsx');
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
        
        validateData(json);
      } catch (err) {
        setStatus('error');
        setMessage('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateData = (data) => {
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
      const department = row.department ? String(row.department).trim() : '';
      const rollNumber = row.rollNumber ? String(row.rollNumber).trim() : '';
      
      const record = { rowNum, fullName, email, department, rollNumber };
      
      let reason = null;
      if (!fullName) reason = 'Missing required field: fullName';
      else if (!email) reason = 'Missing required field: email';
      else if (!email.includes('@')) reason = 'Invalid email format';
      
      if (reason) {
        invalidData.push({ ...record, reason });
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
      const res = await axios.post('/api/users/import', { users: previewData });
      
      setStatus('success');
      setMessage('Import Completed');
      
      let backendFailures = [];
      if (res.data.errors && res.data.errors.length > 0) {
        backendFailures = res.data.errors.map(err => {
          const matched = previewData.find(p => p.email === err.email) || {};
          return {
            rowNum: matched.rowNum || '-',
            fullName: matched.fullName || '-',
            rollNumber: matched.rollNumber || '-',
            email: err.email,
            department: matched.department || '-',
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-pastel-lavender/20 flex justify-between items-center bg-pastel-lavender/5">
          <h2 className="font-heading text-xl font-bold text-text-primary">Import Users</h2>
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
          
          {/* Instructions & Template */}
          {status !== 'success' && (
            <div className="bg-pastel-mint/10 border border-pastel-mint/30 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-text-primary mb-1">Download Template</h3>
                <p className="text-xs text-text-secondary font-quicksand">
                  Use the standard Excel template to format your user data correctly. 
                  Requires <strong>fullName</strong> and <strong>email</strong> columns.
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
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Upload File</label>
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
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Imported</div>
                  </div>
                  <div className="p-2 border-l border-slate-100">
                    <div className="text-2xl text-yellow-500 font-black">{summary.skipped}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Skipped (Dup)</div>
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
                  <h3 className="text-sm font-bold text-slate-700">The failed records are listed below.</h3>
                  <p className="text-xs text-slate-500 mt-1">Please correct them and import them again.</p>
                </div>
                <button 
                  onClick={downloadFailedRecords}
                  className="btn-secondary px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border-2 border-pastel-coral text-pastel-coral hover:bg-pastel-coral/10"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Failed Records (.xlsx)
                </button>
              </div>
              
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto mt-2 shadow-sm bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">Row #</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Name</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Roll No</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Email</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Department</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Reason for failure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {failedRecords.map((row, i) => (
                      <tr key={i} className="hover:bg-red-50/50 transition-colors">
                        <td className="px-4 py-3 text-slate-600 font-mono text-center">{row.rowNum}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{row.fullName}</td>
                        <td className="px-4 py-3 text-slate-500">{row.rollNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{row.email}</td>
                        <td className="px-4 py-3 text-slate-500">{row.department}</td>
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
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Valid Rows Preview ({previewData.length})</label>
                {status !== 'importing' && (
                  <button onClick={resetState} className="text-xs text-pastel-coral hover:underline font-bold">Clear All</button>
                )}
              </div>
              <div className="border border-pastel-lavender/20 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b border-pastel-lavender/20">
                      <th className="px-4 py-2 font-bold text-slate-600">Row #</th>
                      <th className="px-4 py-2 font-bold text-slate-600">Full Name</th>
                      <th className="px-4 py-2 font-bold text-slate-600">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-500 font-mono">{row.rowNum}</td>
                        <td className="px-4 py-2 text-slate-700">{row.fullName}</td>
                        <td className="px-4 py-2 text-slate-600">{row.email}</td>
                      </tr>
                    ))}
                    {previewData.length > 10 && (
                      <tr>
                        <td colSpan="3" className="px-4 py-2 text-center text-slate-400 italic bg-slate-50/50">
                          ...and {previewData.length - 10} more valid rows
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
            <button 
              onClick={handleClose}
              className="px-6 py-2.5 rounded-xl text-sm font-bold btn-primary text-white shadow-pastel-glow transition-colors"
            >
              Close
            </button>
          ) : (
            <>
              <button 
                onClick={handleClose}
                disabled={status === 'importing'}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleImport}
                disabled={status === 'importing' || status === 'error' || previewData.length === 0}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold shadow-pastel-glow disabled:opacity-50 flex items-center gap-2"
              >
                {status === 'importing' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  `Import ${previewData.length} Users`
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
