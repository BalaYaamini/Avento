import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

const ImportUsersModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle', 'parsing', 'validating', 'importing', 'success', 'error'
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { fullName: 'John Doe', email: 'john.doe@cse.suh.edu.in' },
      { fullName: 'Jane Smith', email: 'jane.smith@suh.edu.in' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'Avento_User_Import_Template.xlsx');
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
    setErrors([]);
    setPreviewData([]);
    
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
    const newErrors = [];
    const validData = [];

    if (!data || data.length === 0) {
      newErrors.push('File is empty or incorrectly formatted.');
    } else {
      data.forEach((row, index) => {
        const rowNum = index + 2; // +1 for 0-index, +1 for header
        if (!row.fullName) newErrors.push(`Row ${rowNum}: Missing 'fullName'`);
        if (!row.email) newErrors.push(`Row ${rowNum}: Missing 'email'`);
        else if (!row.email.includes('@')) newErrors.push(`Row ${rowNum}: Invalid email format`);
        else {
          validData.push({
            fullName: String(row.fullName).trim(),
            email: String(row.email).trim().toLowerCase(),
          });
        }
      });
    }

    setPreviewData(validData);
    if (newErrors.length > 0) {
      setErrors(newErrors.slice(0, 5)); // Show max 5 errors
      if (newErrors.length > 5) newErrors.push(`...and ${newErrors.length - 5} more errors.`);
      setStatus('error');
      setMessage('Validation failed. Please correct the errors in the file.');
    } else {
      setStatus('idle');
      setMessage('');
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;
    setStatus('importing');
    setMessage('');
    setErrors([]);

    try {
      const res = await axios.post('/api/users/import', { users: previewData });
      
      setStatus('success');
      setMessage('Import completed.');
      setSummary(res.data.summary || {
        successful: previewData.length,
        skipped: 0,
        failed: 0
      });
      
      if (res.data.errors && res.data.errors.length > 0) {
        const errorList = res.data.errors;
        setErrors(errorList.slice(0, 5).concat(errorList.length > 5 ? [`...and ${errorList.length - 5} more errors.`] : []));
      } else {
        setErrors([]);
      }
      
      // Delay closing to show success state, but give more time if there are errors
      setTimeout(() => {
        onImportSuccess();
      }, (res.data.errors && res.data.errors.length > 0) ? 6000 : 3000);
      
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || err.message || 'Failed to import users.');
    }
  };

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setStatus('idle');
    setMessage('');
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-pastel-lavender/20 flex justify-between items-center bg-pastel-lavender/5">
          <h2 className="font-heading text-xl font-bold text-text-primary">Import Users</h2>
          <button 
            onClick={onClose}
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

          {/* Upload Section */}
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

          {/* Status & Messages */}
          {status === 'error' && (
            <div className="p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span>⚠</span>
                <span>{message}</span>
              </div>
              {errors.length > 0 && (
                <ul className="list-disc pl-6 text-xs mt-2 space-y-1">
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          )}

          {status === 'success' && summary && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-pastel-mint/30 border-2 border-pastel-mint text-green-700 rounded-2xl text-sm font-bold font-quicksand flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>{message}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center bg-white/50 rounded-xl p-3 border border-pastel-mint/30">
                  <div>
                    <div className="text-xl text-green-600">{summary.successful}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Imported</div>
                  </div>
                  <div>
                    <div className="text-xl text-yellow-600">{summary.skipped}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Skipped</div>
                  </div>
                  <div>
                    <div className="text-xl text-red-500">{summary.failed}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Failed</div>
                  </div>
                </div>
              </div>
              {errors.length > 0 && (
                <div className="p-4 bg-pastel-coral/20 border-2 border-pastel-coral text-red-500 rounded-2xl text-sm font-bold font-quicksand flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span>⚠</span>
                    <span>Some records failed to import:</span>
                  </div>
                  <ul className="list-disc pl-6 text-xs mt-2 space-y-1">
                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && status !== 'success' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Preview ({previewData.length} users)</label>
                {status !== 'importing' && (
                  <button onClick={resetState} className="text-xs text-pastel-coral hover:underline font-bold">Clear</button>
                )}
              </div>
              <div className="border border-pastel-lavender/20 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b border-pastel-lavender/20">
                      <th className="px-4 py-2 font-bold text-slate-600">Full Name</th>
                      <th className="px-4 py-2 font-bold text-slate-600">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700">{row.fullName}</td>
                        <td className="px-4 py-2 text-slate-600">{row.email}</td>
                      </tr>
                    ))}
                    {previewData.length > 10 && (
                      <tr>
                        <td colSpan="2" className="px-4 py-2 text-center text-slate-400 italic bg-slate-50/50">
                          ...and {previewData.length - 10} more rows
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
          <button 
            onClick={onClose}
            disabled={status === 'importing'}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleImport}
            disabled={status === 'importing' || status === 'error' || previewData.length === 0 || status === 'success'}
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
              'Import Users'
            )}
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default ImportUsersModal;
