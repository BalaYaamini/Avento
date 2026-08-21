import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';

const IDCardManager = ({ eventId, event }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Photo Import state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, mapped, missing
  
  // ID Card Generation modal state
  const [selectedStudentForCard, setSelectedStudentForCard] = useState(null);
  const [isSingleCardModalOpen, setIsSingleCardModalOpen] = useState(false);
  const [isBatchViewOpen, setIsBatchViewOpen] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  const fileInputRef = useRef(null);

  const fetchStudents = async () => {
    try {
      // Merge with client-side localStorage backup for 100% photo persistence
      let cachedAvatars = {};
      try {
        const rawCache = localStorage.getItem(`event_photos_${eventId}`);
        if (rawCache) cachedAvatars = JSON.parse(rawCache);
      } catch (e) {}

      // Extract unique student profiles with registration details
      const studentList = (res.data || []).map(reg => {
        const user = reg.userId || {};
        const email = user.email || '';
        const derivedRoll = email ? email.split('@')[0].trim().toLowerCase() : '';
        const rollNumber = user.roll_number || derivedRoll || 'N/A';
        const cachedPhoto = cachedAvatars[user.id] || cachedAvatars[rollNumber.toLowerCase()] || cachedAvatars[derivedRoll];
        const finalPhoto = user.avatar_url || cachedPhoto || null;
        
        return {
          registrationId: reg.id,
          userId: user.id || reg.user_id,
          name: user.name || user.fullName || 'Student',
          email: email,
          rollNumber: rollNumber,
          department: user.department || 'General',
          avatarUrl: resolveStudentAvatarUrl(finalPhoto),
          teamName: reg.teamId?.name || null,
          attendanceStatus: reg.attendance_status || 'Absent',
          registeredAt: reg.created_at || reg.registrationDate
        };
      });

      setStudents(studentList);
    } catch (err) {
      console.error('Error loading students for ID cards:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load registered students for this event.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchStudents();
    }
  }, [eventId]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadPhotos = async () => {
    if (selectedFiles.length === 0) {
      return alert('Please select an Excel file (.xlsx, .csv) with Drive links or student photo image files.');
    }

    setUploading(true);
    setImportResult(null);

    try {
      // Check if an Excel sheet format was uploaded (.xlsx, .xls, .csv)
      const excelFile = selectedFiles.find(f => 
        f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')
      );

      const photoFiles = selectedFiles.filter(f => f.type.startsWith('image/'));

      // Case A: Excel file with Google Drive links / image URLs uploaded!
      if (excelFile) {
        try {
          const buffer = await excelFile.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet);

          const urlMappings = [];
          const localMapping = new Map();

          rows.forEach(row => {
            const rollNumber = row['Roll Number'] || row['roll_number'] || row['Roll'] || row['RollNo'];
            const photoVal = row['Photo Drive Link'] || row['Drive Link'] || row['Photo Upload File'] || row['Photo File'] || row['Image Filename'] || row['Photo'] || row['URL'] || row['Link'];

            if (rollNumber && photoVal) {
              const strVal = String(photoVal).trim();
              const cleanRoll = String(rollNumber).trim().toLowerCase();

              // Check if value is a Drive link / URL
              if (strVal.startsWith('http://') || strVal.startsWith('https://') || strVal.includes('drive.google.com')) {
                urlMappings.push({
                  rollNumber: cleanRoll,
                  photoUrl: strVal
                });
              } else {
                localMapping.set(strVal.toLowerCase(), cleanRoll);
              }
            }
          });

          // If Excel contains Google Drive links or image URLs, import via API endpoint!
          if (urlMappings.length > 0) {
            const linkRes = await axios.post(`/api/registrations/event/${eventId}/import-drive-links`, {
              mappings: urlMappings
            });

            setImportResult(linkRes.data);
            if (linkRes.data?.mappedStudents) {
              applyMappedPhotosToStudents(linkRes.data.mappedStudents);
            }
            clearFiles();
            setIsBatchViewOpen(true); // Automatically open Batch ID Cards Preview!
            await fetchStudents();
            setUploading(false);
            return;
          }

          // Otherwise if Excel maps local image filenames
          if (localMapping.size > 0 && photoFiles.length > 0) {
            const formData = new FormData();
            photoFiles.forEach(file => {
              const cleanName = file.name.trim().toLowerCase();
              const mappedRoll = localMapping.get(cleanName);

              if (mappedRoll) {
                const extIndex = file.name.lastIndexOf('.');
                const fileExt = extIndex !== -1 ? file.name.substring(extIndex + 1) : 'jpg';
                const renamedFile = new File([file], `${mappedRoll}.${fileExt}`, { type: file.type });
                formData.append('photos', renamedFile);
              } else {
                formData.append('photos', file);
              }
            });

            const res = await axios.post(`/api/registrations/event/${eventId}/import-photos`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });

            setImportResult(res.data);
            if (res.data?.mappedStudents) {
              applyMappedPhotosToStudents(res.data.mappedStudents);
            }
            clearFiles();
            setIsBatchViewOpen(true); // Automatically open Batch ID Cards Preview!
            await fetchStudents();
            setUploading(false);
            return;
          }
        } catch (excelErr) {
          console.warn('Could not parse Excel file:', excelErr);
        }
      }

      // Case B: Direct Photo files upload (named by Roll Number)
      if (photoFiles.length > 0) {
        const formData = new FormData();
        photoFiles.forEach(file => {
          formData.append('photos', file);
        });

        const res = await axios.post(`/api/registrations/event/${eventId}/import-photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setImportResult(res.data);
        if (res.data?.mappedStudents) {
          applyMappedPhotosToStudents(res.data.mappedStudents);
        }
        clearFiles();
        setIsBatchViewOpen(true); // Automatically open Batch ID Cards Preview!
        await fetchStudents();
      } else {
        alert('Please select an Excel sheet (.xlsx, .csv) with Drive links or image files.');
      }
    } catch (err) {
      console.error('Error uploading student photos:', err);
      alert(err.response?.data?.message || 'Failed to process student photo import.');
    } finally {
      setUploading(false);
    }
  };

  const resolveStudentAvatarUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    const str = url.trim();

    if (str.startsWith('/api/registrations/drive-proxy') || str.startsWith('data:') || str.startsWith('blob:')) {
      return str;
    }

    const driveMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                       str.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
                       str.match(/\/d\/([a-zA-Z0-9_-]+)/);

    if (driveMatch && driveMatch[1]) {
      return `/api/registrations/drive-proxy?id=${driveMatch[1]}`;
    }

    return str;
  };

  const applyMappedPhotosToStudents = (mappedList) => {
    if (!mappedList || !Array.isArray(mappedList) || mappedList.length === 0) return;

    let cachedAvatars = {};
    try {
      const rawCache = localStorage.getItem(`event_photos_${eventId}`);
      if (rawCache) cachedAvatars = JSON.parse(rawCache);
    } catch (e) {}

    mappedList.forEach(m => {
      const resolved = resolveStudentAvatarUrl(m.avatarUrl);
      if (m.studentId && resolved) cachedAvatars[String(m.studentId)] = resolved;
      if (m.rollNumber && resolved) cachedAvatars[String(m.rollNumber).toLowerCase()] = resolved;
    });

    try {
      localStorage.setItem(`event_photos_${eventId}`, JSON.stringify(cachedAvatars));
    } catch (e) {}

    setStudents(prevStudents => {
      const updatedMap = new Map(Object.entries(cachedAvatars));

      return prevStudents.map(student => {
        const mappedUrl = updatedMap.get(String(student.userId)) || updatedMap.get(String(student.rollNumber).toLowerCase());
        if (mappedUrl) {
          return { ...student, avatarUrl: mappedUrl };
        }
        return student;
      });
    });
  };

  // Filtering
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'mapped') return matchesSearch && !!student.avatarUrl;
    if (statusFilter === 'missing') return matchesSearch && !student.avatarUrl;
    return matchesSearch;
  });

  const totalRegistered = students.length;
  const mappedCount = students.filter(s => !!s.avatarUrl).length;
  const missingCount = totalRegistered - mappedCount;

  const exportStudentPhotoFormatTemplate = () => {
    // Clean 2-Column Template: Headings 'Roll Number' and 'Photo Drive Link' with NO pre-filled data rows
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Roll Number', 'Photo Drive Link']
    ]);

    worksheet['!cols'] = [
      { wch: 24 }, // Roll Number
      { wch: 60 }  // Photo Drive Link
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Drive Links Format');

    const fileName = `student-photo-drive-links-format.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handlePrintCard = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-16 gap-3">
        <div className="animate-spin w-10 h-10 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
        <span className="text-sm font-medium text-slate-500">Loading student registration data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/20 text-red-500 rounded-3xl text-center space-y-4 max-w-lg mx-auto my-8 shadow-lg">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto text-xl font-black">
          ⚠
        </div>
        <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{error}</div>
        <button
          onClick={fetchStudents}
          className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-fuchsia-500/25 transition-all cursor-pointer"
        >
          Retry Loading Students
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* CSS for print mode */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-id-cards, #printable-id-cards * {
            visibility: visible;
          }
          #printable-id-cards {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header & Stats Banner */}
      <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-fuchsia-300 border border-white/15 mb-3">
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
              Admin ID Card Workspace
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Student Image Import & ID Cards</h2>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Map student photos by roll number (e.g. <code className="text-amber-300 bg-white/10 px-1.5 py-0.5 rounded">2401100cse0006</code> from <code className="text-amber-300 bg-white/10 px-1.5 py-0.5 rounded">2401100cse0006@cse.suh.edu.in</code>) and generate ID cards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsBatchViewOpen(!isBatchViewOpen)}
              className="px-5 py-2.5 bg-gradient-to-r from-fuchsia-500 to-indigo-600 hover:from-fuchsia-600 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-fuchsia-500/25 transition-all duration-300 flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{isBatchViewOpen ? 'Hide Batch Preview' : 'Preview All ID Cards'}</span>
            </button>

            {isBatchViewOpen && (
              <button
                onClick={handlePrintCard}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print All Cards</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <span className="text-xs text-slate-400 font-medium">Total Registered Students</span>
            <div className="text-2xl font-black text-white mt-1">{totalRegistered}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-emerald-500/30">
            <span className="text-xs text-emerald-400 font-medium">Photos Mapped</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {mappedCount} <span className="text-xs font-normal text-slate-300">({totalRegistered > 0 ? Math.round((mappedCount / totalRegistered) * 100) : 0}%)</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-amber-500/30">
            <span className="text-xs text-amber-400 font-medium">Missing Photos</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{missingCount}</div>
          </div>
        </div>
      </div>

      {/* Student Photo Import Dropzone & Form */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-fuchsia-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Import Student Photos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select multiple image files named with student roll numbers (e.g. <code className="text-fuchsia-600 dark:text-fuchsia-400 font-mono">2401100cse0006.png</code>). Only matching registered roll numbers will be accepted.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportStudentPhotoFormatTemplate}
              className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white dark:text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Download Excel format template containing all registered student roll numbers and expected filenames"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Format (.xlsx)</span>
            </button>

            <button
              onClick={() => setShowFormatGuide(!showFormatGuide)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4 text-fuchsia-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{showFormatGuide ? 'Hide Guide' : 'Format Rules'}</span>
            </button>

            {selectedFiles.length > 0 && (
              <button
                onClick={clearFiles}
                className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors ml-2"
              >
                Clear ({selectedFiles.length})
              </button>
            )}
          </div>
        </div>

        {/* Format Guidelines & 2-Column Upload Headings Box */}
        {showFormatGuide && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 border border-fuchsia-500/30 text-xs space-y-4 shadow-lg animate-fade-in text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <span className="font-black text-fuchsia-400 text-sm flex items-center gap-2">
                <span>⚡</span> 100% Automated Image Upload Format
              </span>
              <button
                onClick={exportStudentPhotoFormatTemplate}
                className="text-emerald-400 hover:text-emerald-300 font-bold text-xs underline flex items-center gap-1 cursor-pointer"
              >
                <span>📥</span> Download 2-Column Template (.xlsx)
              </button>
            </div>

            {/* Visual Headings Table */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300">Required Upload Columns / Headings:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900 p-3 rounded-xl border border-amber-500/30">
                  <span className="text-[10px] uppercase font-mono text-amber-400 block font-black tracking-wider">HEADING 1</span>
                  <span className="font-mono font-black text-amber-300 text-sm">Roll Number</span>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Student roll number derived from email prefix (e.g. <code className="text-amber-200">2401100cse0006</code>).
                  </p>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-fuchsia-500/30">
                  <span className="text-[10px] uppercase font-mono text-fuchsia-400 block font-black tracking-wider">HEADING 2</span>
                  <span className="font-mono font-black text-fuchsia-300 text-sm">Photo Drive Link</span>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Google Drive link or URL (e.g. <code className="text-fuchsia-200">https://drive.google.com/file/d/1ABC.../view</code>).
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-300 text-[11px] font-medium leading-relaxed">
              ✨ <strong>Google Drive Links Supported:</strong> Upload an Excel file with <strong>Roll Number</strong> and <strong>Photo Drive Link</strong>. The platform automatically converts Drive sharing links to direct images, maps them to student roll numbers, fetches <strong>Names</strong>, <strong>Emails</strong>, <strong>Departments</strong>, and generates all <strong>Student ID Cards</strong> automatically!
            </div>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-fuchsia-500 dark:hover:border-fuchsia-400 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-fuchsia-50/30 dark:hover:bg-fuchsia-950/20 group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*"
            className="hidden"
          />

          <div className="w-14 h-14 mx-auto rounded-2xl bg-fuchsia-500/10 text-fuchsia-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Click to upload or drag & drop student photos here
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supports PNG, JPG, JPEG, WEBP. File names must be student roll numbers (e.g. <span className="font-mono text-slate-700 dark:text-slate-300">2401100cse0006.jpg</span>)
          </p>
        </div>

        {/* Selected Files List Preview */}
        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Ready for import ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''})</span>
              <span>Matched Roll Numbers will be assigned</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
              {selectedFiles.map((file, idx) => {
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                const fileRoll = baseName.trim().toLowerCase();
                const matched = students.some(s => s.rollNumber.toLowerCase() === fileRoll);

                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-6 h-6 rounded-lg bg-fuchsia-500/10 text-fuchsia-500 font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 font-mono text-slate-600 dark:text-slate-400">
                        Roll: {fileRoll}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {matched ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          ✓ Match Found
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          ⚠ Not Registered
                        </span>
                      )}

                      <button
                        onClick={() => removeFile(idx)}
                        className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleUploadPhotos}
                disabled={uploading}
                className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-fuchsia-500/25 disabled:opacity-50 transition-all duration-300 flex items-center gap-2 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Mapping & Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Upload & Map Student Photos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Import Results Banner */}
        {importResult && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-2 text-emerald-400">
                <span>✓</span> Import Complete
              </h4>
              <span className="text-xs text-slate-400 font-mono">{importResult.message}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="font-bold text-lg">{importResult.successCount}</span>
                <p className="text-[11px] text-emerald-300/80">Successfully mapped to registered students</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <span className="font-bold text-lg">{importResult.rejectedCount}</span>
                <p className="text-[11px] text-amber-300/80">Rejected (Roll number not registered)</p>
              </div>
            </div>

            {/* Rejected Files Report if any */}
            {importResult.rejectedFiles && importResult.rejectedFiles.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-xs font-bold text-amber-400 mb-2">Unmatched / Rejected Files Details:</p>
                <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                  {importResult.rejectedFiles.map((rej, i) => (
                    <div key={i} className="flex justify-between items-center text-slate-400 bg-slate-950 p-2 rounded-lg">
                      <span className="font-mono">{rej.filename}</span>
                      <span className="text-amber-400 text-[11px]">{rej.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student List & ID Generation Table */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registered Students Directory</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Generate ID card or preview for individual registered students.</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search name, roll no, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-fuchsia-500 w-48 sm:w-64"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-fuchsia-500"
            >
              <option value="all">All Students ({totalRegistered})</option>
              <option value="mapped">Mapped Photos ({mappedCount})</option>
              <option value="missing">Missing Photos ({missingCount})</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Student Photo</th>
                <th className="py-3 px-4">Name & Email</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Photo Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400 font-medium">
                    No matching student registrations found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.registrationId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      {student.avatarUrl ? (
                        <img
                          src={resolveStudentAvatarUrl(student.avatarUrl)}
                          alt={student.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border-2 border-fuchsia-500 shadow-sm"
                          onError={(e) => {
                            const str = student.avatarUrl || '';
                            const match = str.match(/id=([a-zA-Z0-9_-]+)/) || str.match(/\/d\/([a-zA-Z0-9_-]+)/);
                            if (match && match[1]) {
                              const fileId = match[1];
                              if (!e.target.dataset.tried1) {
                                e.target.dataset.tried1 = 'true';
                                e.target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                              } else if (!e.target.dataset.tried2) {
                                e.target.dataset.tried2 = 'true';
                                e.target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{student.name}</div>
                      <div className="text-[11px] text-slate-400">{student.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {student.rollNumber}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {student.department}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {student.avatarUrl ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Photo Uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Missing Photo
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedStudentForCard(student);
                          setIsSingleCardModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-fuchsia-500/10 hover:bg-fuchsia-500 text-fuchsia-600 hover:text-white dark:text-fuchsia-400 font-bold text-xs rounded-xl border border-fuchsia-500/20 transition-all cursor-pointer"
                      >
                        Generate ID
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single ID Card Modal */}
      {isSingleCardModalOpen && selectedStudentForCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student ID Card</h3>
              <button
                onClick={() => setIsSingleCardModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* ID Card Display - Clean Layout (Image, Name, Department, Roll Number ONLY) */}
            <div id="single-card-render" className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 border border-white/20 shadow-2xl relative overflow-hidden text-center space-y-4">
              {/* Top Banner */}
              <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] uppercase tracking-widest font-black text-fuchsia-400">STUDENT ID CARD</span>
                  <div className="text-xs font-extrabold text-white truncate max-w-[200px]">{event?.title || 'Avento Event'}</div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-fuchsia-500 to-indigo-500 text-white font-black text-xs flex items-center justify-center shadow-md">
                  A
                </div>
              </div>

              {/* Photo Frame */}
              <div className="my-2">
                {selectedStudentForCard.avatarUrl ? (
                  <img
                    src={resolveStudentAvatarUrl(selectedStudentForCard.avatarUrl)}
                    alt={selectedStudentForCard.name}
                    referrerPolicy="no-referrer"
                    className="w-28 h-28 rounded-2xl object-cover mx-auto border-4 border-fuchsia-400 shadow-xl shadow-fuchsia-500/20"
                    onError={(e) => {
                      const str = selectedStudentForCard.avatarUrl || '';
                      const match = str.match(/id=([a-zA-Z0-9_-]+)/) || str.match(/\/d\/([a-zA-Z0-9_-]+)/);
                      if (match && match[1]) {
                        const fileId = match[1];
                        if (!e.target.dataset.tried1) {
                          e.target.dataset.tried1 = 'true';
                          e.target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                        } else if (!e.target.dataset.tried2) {
                          e.target.dataset.tried2 = 'true';
                          e.target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-black text-4xl flex items-center justify-center mx-auto border-4 border-white/20 shadow-xl">
                    {selectedStudentForCard.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Student Details: Name, Department, Roll Number ONLY */}
              <div className="space-y-2 pt-1 pb-2">
                <h4 className="text-xl font-black text-white tracking-wide">{selectedStudentForCard.name}</h4>
                <div className="text-xs text-slate-300 font-semibold">
                  Department: <span className="text-white font-bold">{selectedStudentForCard.department}</span>
                </div>
                <div className="inline-block px-4 py-1.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-300 font-mono font-bold text-sm mt-1">
                  Roll No: {selectedStudentForCard.rollNumber}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setIsSingleCardModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold rounded-xl btn-secondary"
              >
                Close
              </button>
              <button
                onClick={handlePrintCard}
                className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-fuchsia-500/25 cursor-pointer"
              >
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch ID Cards View / Printable Grid */}
      {isBatchViewOpen && (
        <div id="printable-id-cards" className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 no-print">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Batch ID Cards Preview</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Print or export ID cards for all registered students ({filteredStudents.length}).</p>
            </div>

            <button
              onClick={handlePrintCard}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-emerald-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print All Cards</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student) => (
              <div
                key={student.registrationId}
                className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 text-white rounded-2xl p-6 border border-white/20 shadow-lg relative overflow-hidden text-center space-y-4"
              >
                {/* Header */}
                <div className="border-b border-white/10 pb-2 flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[9px] uppercase tracking-widest font-black text-fuchsia-400">STUDENT ID CARD</span>
                    <div className="text-[11px] font-bold text-white truncate max-w-[150px]">{event?.title || 'Avento Event'}</div>
                  </div>
                  <div className="w-6 h-6 rounded-md bg-fuchsia-500 text-white font-black text-[10px] flex items-center justify-center">
                    A
                  </div>
                </div>

                {/* Avatar */}
                <div className="my-1">
                  {student.avatarUrl ? (
                    <img
                      src={resolveStudentAvatarUrl(student.avatarUrl)}
                      alt={student.name}
                      referrerPolicy="no-referrer"
                      className="w-24 h-24 rounded-2xl object-cover mx-auto border-2 border-fuchsia-400 shadow-md"
                      onError={(e) => {
                        const str = student.avatarUrl || '';
                        const match = str.match(/id=([a-zA-Z0-9_-]+)/) || str.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        if (match && match[1]) {
                          const fileId = match[1];
                          if (!e.target.dataset.tried1) {
                            e.target.dataset.tried1 = 'true';
                            e.target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                          } else if (!e.target.dataset.tried2) {
                            e.target.dataset.tried2 = 'true';
                            e.target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-black text-3xl flex items-center justify-center mx-auto border-2 border-white/20">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Details: Name, Department, Roll Number ONLY */}
                <div className="space-y-1.5 pb-1">
                  <h4 className="text-base font-black text-white truncate">{student.name}</h4>
                  <div className="text-xs text-slate-300 font-semibold">
                    Dept: <span className="text-white font-bold">{student.department}</span>
                  </div>
                  <div className="inline-block px-3 py-1 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/30 text-fuchsia-300 font-mono font-bold text-xs">
                    Roll No: {student.rollNumber}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IDCardManager;
