import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

const defaultIDConfig = {
  STUDENT_PHOTO: { x: 130, y: 55, size: 100, label: 'Student Photo Box' },
  STUDENT_NAME: { x: 180, y: 175, fontSize: 18, color: '#ffffff', align: 'center', label: 'Student Full Name' },
  COLLEGE_NAME: { x: 180, y: 210, fontSize: 14, color: '#f0abfc', align: 'center', label: 'College Name' },
  TEAM_NAME: { x: 180, y: 240, fontSize: 13, color: '#e2e8f0', align: 'center', label: 'Team Name' },
  DEPARTMENT: { x: 180, y: 270, fontSize: 12, color: '#cbd5e1', align: 'center', label: 'Department' },
  DEGREE_PROGRAM: { x: 180, y: 295, fontSize: 12, color: '#94a3b8', align: 'center', label: 'Degree / Program' }
};

const resolveStudentAvatarUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const str = url.trim();

  if (str.startsWith('data:') || str.startsWith('blob:')) {
    return str;
  }

  const driveMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                     str.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
                     str.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }

  // Support raw Google Drive File IDs (25+ characters without slashes or spaces)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(str) && !str.startsWith('http')) {
    return `https://lh3.googleusercontent.com/d/${str}`;
  }

  return str;
};

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
  
  // ID Card Generation & Visual Template Editor state
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [isSingleCardModalOpen, setIsSingleCardModalOpen] = useState(false);
  const [isBatchViewOpen, setIsBatchViewOpen] = useState(false);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [batchPage, setBatchPage] = useState(1);
  const [batchPageSize, setBatchPageSize] = useState(50); // 50 participants per batch (100 cards = 25 A4 pages) for 100% reliable printing without dropouts
  const [showAllForPrint, setShowAllForPrint] = useState(false);
  const [printTarget, setPrintTarget] = useState(null); // 'batch' | 'single' | null
  const [showFormatGuide, setShowFormatGuide] = useState(true);
  const [idTemplateUrl, setIdTemplateUrl] = useState(null);

  // Interactive Drag-and-Drop ID Card Layout Configuration
  const [idConfig, setIdConfig] = useState(defaultIDConfig);
  const [activePlaceholder, setActivePlaceholder] = useState('STUDENT_NAME');
  const [draggingPlaceholder, setDraggingPlaceholder] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ clickOffsetX: 0, clickOffsetY: 0 });
  const editorCanvasRef = useRef(null);

  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const templateInputRef = useRef(null);

  useEffect(() => {
    try {
      const savedTemplate = localStorage.getItem(`id_template_${eventId}`);
      if (savedTemplate) setIdTemplateUrl(savedTemplate);

      const savedConfig = localStorage.getItem(`id_config_${eventId}`);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setIdConfig({
          STUDENT_PHOTO: { ...defaultIDConfig.STUDENT_PHOTO, ...(parsed?.STUDENT_PHOTO || {}) },
          STUDENT_NAME: { ...defaultIDConfig.STUDENT_NAME, ...(parsed?.STUDENT_NAME || {}) },
          COLLEGE_NAME: { ...defaultIDConfig.COLLEGE_NAME, ...(parsed?.COLLEGE_NAME || parsed?.ROLL_NUMBER || {}) },
          TEAM_NAME: { ...defaultIDConfig.TEAM_NAME, ...(parsed?.TEAM_NAME || {}) },
          DEPARTMENT: { ...defaultIDConfig.DEPARTMENT, ...(parsed?.DEPARTMENT || {}) },
          DEGREE_PROGRAM: { ...defaultIDConfig.DEGREE_PROGRAM, ...(parsed?.DEGREE_PROGRAM || {}) }
        });
      }
    } catch (e) {
      console.warn('ID config parse warning:', e);
    }
  }, [eventId]);

  const handleTemplateUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return alert('Please select a valid PNG or JPG image file for the ID card template.');
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      setIdTemplateUrl(dataUrl);
      try {
        localStorage.setItem(`id_template_${eventId}`, dataUrl);
      } catch (err) {}
    };
    reader.readAsDataURL(file);
  };

  const handleResetTemplate = () => {
    setIdTemplateUrl(null);
    setIdConfig(defaultIDConfig);
    try {
      localStorage.removeItem(`id_template_${eventId}`);
      localStorage.removeItem(`id_config_${eventId}`);
    } catch (e) {}
  };

  // Drag and Drop Placeholder movement inside the Visual Canvas Editor
  const handlePlaceholderMouseDown = (e, key) => {
    e.stopPropagation();
    e.preventDefault();
    setActivePlaceholder(key);
    setDraggingPlaceholder(key);

    const canvasRect = editorCanvasRef.current ? editorCanvasRef.current.getBoundingClientRect() : { left: 0, top: 0 };
    const mouseCanvasX = e.clientX - canvasRect.left;
    const mouseCanvasY = e.clientY - canvasRect.top;

    const currentX = idConfig[key]?.x || 180;
    const currentY = idConfig[key]?.y || 200;

    setDragStartPos({
      clickOffsetX: mouseCanvasX - currentX,
      clickOffsetY: mouseCanvasY - currentY
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingPlaceholder || !editorCanvasRef.current) return;

      const canvasRect = editorCanvasRef.current.getBoundingClientRect();
      const mouseCanvasX = e.clientX - canvasRect.left;
      const mouseCanvasY = e.clientY - canvasRect.top;

      let targetX = Math.round(mouseCanvasX - (dragStartPos.clickOffsetX || 0));
      let targetY = Math.round(mouseCanvasY - (dragStartPos.clickOffsetY || 0));

      targetX = Math.max(0, Math.min(360, targetX));
      targetY = Math.max(0, Math.min(500, targetY));

      setIdConfig(prev => ({
        ...prev,
        [draggingPlaceholder]: {
          ...prev[draggingPlaceholder],
          x: targetX,
          y: targetY
        }
      }));
    };

    const handleMouseUp = () => {
      if (draggingPlaceholder) setDraggingPlaceholder(null);
    };

    if (draggingPlaceholder) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingPlaceholder, dragStartPos]);

  const updatePlaceholderProp = (key, prop, val) => {
    setIdConfig(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [prop]: val
      }
    }));
  };

  const handleDeletePlaceholder = (key) => {
    if (!key || !idConfig[key]) return;
    const updated = { ...idConfig };
    delete updated[key];
    setIdConfig(updated);
    const remainingKeys = Object.keys(updated);
    setActivePlaceholder(remainingKeys.length > 0 ? remainingKeys[0] : null);
  };

  const saveIDConfig = () => {
    try {
      localStorage.setItem(`id_config_${eventId}`, JSON.stringify(idConfig));
      alert('ID Card placeholder positions saved successfully!');
    } catch (e) {
      alert('Error saving placeholder positions.');
    }
  };

  const resetIDConfig = () => {
    setIdConfig(defaultIDConfig);
    try {
      localStorage.removeItem(`id_config_${eventId}`);
      alert('Reset ID Card placeholder positions to default!');
    } catch (e) {}
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError('');

      // Merge with client-side localStorage backup for 100% photo persistence
      let cachedAvatars = {};
      try {
        const rawCache = localStorage.getItem(`event_photos_${eventId}`);
        if (rawCache) cachedAvatars = JSON.parse(rawCache);
      } catch (e) {}

      const res = await axios.get(`/api/registrations/event/${eventId}`);
      let rawList = res.data || [];

      // Fallback: If rawList is empty, try confirmed-teams endpoint
      if (!Array.isArray(rawList) || rawList.length === 0) {
        try {
          const teamRes = await axios.get(`/api/registrations/event/${eventId}/confirmed-teams`);
          if (teamRes.data && Array.isArray(teamRes.data)) {
            teamRes.data.forEach(t => {
              (t.members || []).forEach(m => {
                rawList.push({
                  id: m.registrationId || `team_${t.id}_${m.userId}`,
                  registrationId: m.registrationId || null,
                  userId: {
                    id: m.userId,
                    name: m.name,
                    email: m.email,
                    roll_number: m.rollNumber,
                    department: m.department,
                    college_name: m.collegeName,
                    degree_program: m.degreeProgram,
                    year_of_study: m.yearOfStudy,
                    gender: m.gender,
                    phone: m.phone,
                    avatar_url: m.avatarUrl
                  },
                  teamId: { name: t.name }
                });
              });
            });
          }
        } catch (tErr) {}
      }

      // Extract unique student profiles directly with updated registration & profile details
      const studentList = rawList.map(reg => {
        const user = reg.userId || reg.profiles || reg.user || {};
        const email = user.email || reg.user_email || reg.email || '';
        const derivedRoll = email ? email.split('@')[0].trim().toLowerCase() : '';
        const rollNumber = user.roll_number || user.rollNumber || user.roll_no || user.rollNo || reg.roll_number || reg.rollNo || derivedRoll || '';
        const name = user.name || user.fullName || reg.user_name || reg.name || (email ? email.split('@')[0] : 'Student');
        const department = user.department || user.dept || user.branch || reg.department || '';
        const collegeName = user.college_name || user.collegeName || user.college || user.institution || reg.college_name || reg.collegeName || '';
        const degreeProgram = user.degree_program || user.degreeProgram || user.program || user.degree || reg.degree_program || reg.degreeProgram || '';
        const yearOfStudy = user.year_of_study || user.yearOfStudy || user.year || reg.year_of_study || reg.yearOfStudy || '';
        const gender = user.gender || reg.gender || '';
        const phone = user.phone || user.phoneNumber || user.phone_number || reg.phone || '';

        const rawRoll = String(rollNumber).toLowerCase().trim();
        const cleanRoll = rawRoll.replace(/[^a-z0-9]/g, '');
        const cleanEmailRoll = derivedRoll.replace(/[^a-z0-9]/g, '');

        const cachedPhoto = cachedAvatars[user.id || reg.user_id] ||
                            cachedAvatars[rawRoll] ||
                            cachedAvatars[cleanRoll] ||
                            cachedAvatars[derivedRoll] ||
                            cachedAvatars[cleanEmailRoll];

        const finalPhoto = user.avatar_url || user.avatarUrl || reg.avatar_url || reg.avatarUrl || cachedPhoto || null;
        
        return {
          registrationId: reg.registrationId || reg.id || user.id || reg.user_id,
          userId: user.id || reg.user_id,
          name: name,
          email: email,
          rollNumber: rollNumber,
          department: department,
          collegeName: collegeName,
          degreeProgram: degreeProgram,
          yearOfStudy: yearOfStudy,
          gender: gender,
          phone: phone,
          avatarUrl: resolveStudentAvatarUrl(finalPhoto),
          teamName: reg.teamId?.name || reg.team_name || reg.teamName || null,
          attendanceStatus: reg.attendance_status || 'Absent',
          registeredAt: reg.created_at || reg.registrationDate
        };
      });

      setStudents(studentList);
    } catch (err) {
      console.warn('Note: Registration fetch info for event:', err);
      setStudents(prev => prev || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchStudents();
    }
  }, [eventId]);

  const selectedStudentForCard = (students || []).find(s => String(s.registrationId || s.userId || s.id || s.studentId) === String(selectedStudentId)) || (students || [])[0] || {
    name: 'Student Name',
    rollNumber: '2401100cse0001',
    department: 'CSE',
    teamName: 'Team Alpha',
    avatarUrl: null
  };

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
      const files = Array.from(e.dataTransfer.files);
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
    if (excelInputRef.current) excelInputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
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
          const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellStyles: true });
          const firstSheetName = workbook.SheetNames[0];
          const firstSheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });

          const urlMappings = [];
          const localMapping = new Map();

          // Extract embedded cell hyperlinks if SheetJS detected cell.l.Target
          const cellKeys = Object.keys(firstSheet).filter(k => !k.startsWith('!'));
          const hyperlinkMap = new Map();
          cellKeys.forEach(cellRef => {
            const cell = firstSheet[cellRef];
            if (cell && cell.l && cell.l.Target) {
              const rowNum = cellRef.replace(/[^0-9]/g, '');
              hyperlinkMap.set(Number(rowNum), cell.l.Target);
            }
          });

          rows.forEach((row, rowIndex) => {
            let nameVal = null;
            let rollNumber = null;
            let teamNameVal = null;
            let photoVal = null;

            // Check if hyperlink was embedded in row (SheetJS 1-indexed row)
            const embeddedHyperlink = hyperlinkMap.get(rowIndex + 2);
            if (embeddedHyperlink) photoVal = embeddedHyperlink;

            // Search all keys in the Excel row case-insensitively
            Object.keys(row).forEach(key => {
              const k = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              const val = row[key];
              if (val === undefined || val === null || String(val).trim() === '') return;
              const strVal = String(val).trim();

              // Auto-detect drive/HTTP link values regardless of column key
              if (strVal.startsWith('http://') || strVal.startsWith('https://') || strVal.includes('drive.google.com')) {
                if (!photoVal) photoVal = strVal;
                return;
              }

              if (k.includes('drivelink') || k.includes('photo') || k.includes('image') || k.includes('url') || k.includes('pic') || k === 'link' || k === 'drive') {
                if (!photoVal) photoVal = strVal;
              } else if (k.includes('roll') || k.includes('regno') || k.includes('htno') || k === 'id' || k === 'rollnumber' || k === 'roll_number' || k === 'reg_no') {
                if (!rollNumber) rollNumber = strVal;
              } else if (k === 'name' || k.includes('studentname') || k.includes('fullname') || k === 'full_name') {
                if (!nameVal) nameVal = strVal;
              } else if (k.includes('team') || k.includes('group')) {
                if (!teamNameVal) teamNameVal = strVal;
              }
            });

            // Fallback scan: if keys unlabelled or key matching missed roll/photo
            const values = Object.values(row).map(v => String(v || '').trim()).filter(Boolean);
            if (!photoVal) {
              const urlVal = values.find(v => v.startsWith('http://') || v.startsWith('https://') || v.includes('drive.google.com'));
              if (urlVal) photoVal = urlVal;
            }

            if (!rollNumber) {
              // Roll numbers contain digits or alphanumeric ID patterns (e.g., 2401100cse0001, 2401100)
              const rollCandidate = values.find(v => 
                !v.startsWith('http://') && 
                !v.startsWith('https://') && 
                !v.includes('drive.google') &&
                (/\d/.test(v) || /^[a-zA-Z0-9_-]{4,25}$/.test(v))
              );
              if (rollCandidate) rollNumber = rollCandidate;
            }

            if (rollNumber && photoVal) {
              const strVal = String(photoVal).trim();
              const cleanRoll = String(rollNumber).trim().toLowerCase();

              if (strVal.startsWith('http://') || strVal.startsWith('https://') || strVal.includes('drive.google.com') || strVal.length >= 25) {
                urlMappings.push({
                  rollNumber: cleanRoll,
                  name: nameVal ? String(nameVal).trim() : null,
                  teamName: teamNameVal ? String(teamNameVal).trim() : null,
                  photoUrl: strVal
                });
              } else {
                localMapping.set(strVal.toLowerCase(), cleanRoll);
              }
            }
          });

          // Method 2 Scanner: 2D Cell Array Row Scanner to catch any unlabelled or offset rows
          if (urlMappings.length === 0) {
            const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
            rawRows.forEach(rowArr => {
              if (!Array.isArray(rowArr) || rowArr.length < 2) return;
              const cells = rowArr.map(c => String(c || '').trim()).filter(Boolean);

              const linkCell = cells.find(c => 
                c.startsWith('http://') || 
                c.startsWith('https://') || 
                c.includes('drive.google.com') || 
                c.includes('drive.google') ||
                c.includes('docs.google') ||
                /^[a-zA-Z0-9_-]{25,}$/.test(c)
              );

              const rollCell = cells.find(c => 
                c !== linkCell && 
                !c.startsWith('http://') && 
                !c.startsWith('https://') && 
                !c.includes('drive.google') &&
                (/\d/.test(c) || /^[a-zA-Z0-9_-]{4,25}$/.test(c))
              );

              if (linkCell && rollCell) {
                const cleanRoll = rollCell.toLowerCase().trim();
                urlMappings.push({
                  rollNumber: cleanRoll,
                  photoUrl: linkCell
                });
              }
            });
          }

          // If Excel contains Google Drive links or image URLs, import via API endpoint!
          if (urlMappings.length > 0) {
            const linkRes = await axios.post(`/api/registrations/event/${eventId}/import-drive-links`, {
              mappings: urlMappings
            });

            setImportResult(linkRes.data);
            clearFiles();
            setIsBatchViewOpen(true); // Automatically open Batch ID Cards Preview!

            // Fetch latest registered students directory first
            await fetchStudents();

            // THEN apply mapped photo URLs over the fetched student directory so they are 100% active
            if (linkRes.data?.mappedStudents) {
              applyMappedPhotosToStudents(linkRes.data.mappedStudents);
            }

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
        alert('Could not find photo URLs or student roll numbers in the uploaded Excel file. Please ensure the Excel file contains Roll Numbers and Google Drive photo links.');
      }
    } catch (err) {
      console.error('Error uploading student photos:', err);
      alert(err.response?.data?.message || 'Failed to process student photo import.');
    } finally {
      setUploading(false);
    }
  };

  /* resolveStudentAvatarUrl is defined above */

  const applyMappedPhotosToStudents = (mappedList) => {
    if (!mappedList || !Array.isArray(mappedList) || mappedList.length === 0) return;

    let cachedAvatars = {};
    try {
      const rawCache = localStorage.getItem(`event_photos_${eventId}`);
      if (rawCache) cachedAvatars = JSON.parse(rawCache);
    } catch (e) {}

    const normalizeKey = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const digitsOnly = (str) => String(str || '').replace(/\D/g, '');

    mappedList.forEach(m => {
      const resolved = resolveStudentAvatarUrl(m.avatarUrl);
      if (!resolved) return;

      const rawRoll = String(m.rollNumber || '').toLowerCase().trim();
      const cleanRoll = normalizeKey(m.rollNumber);
      const digits = digitsOnly(m.rollNumber);
      const emailPrefix = m.email ? String(m.email).split('@')[0].toLowerCase().trim() : '';

      if (m.studentId) cachedAvatars[String(m.studentId)] = resolved;
      if (rawRoll) cachedAvatars[rawRoll] = resolved;
      if (cleanRoll) cachedAvatars[cleanRoll] = resolved;
      if (digits && digits.length >= 4) cachedAvatars[digits] = resolved;
      if (emailPrefix) {
        cachedAvatars[emailPrefix] = resolved;
        cachedAvatars[normalizeKey(emailPrefix)] = resolved;
      }
    });

    try {
      localStorage.setItem(`event_photos_${eventId}`, JSON.stringify(cachedAvatars));
    } catch (e) {}

    setStudents(prevStudents => {
      const updatedMap = new Map(Object.entries(cachedAvatars));

      return prevStudents.map(student => {
        const rawRoll = String(student.rollNumber || '').toLowerCase().trim();
        const cleanRoll = normalizeKey(student.rollNumber);
        const digits = digitsOnly(student.rollNumber);
        const emailRoll = student.email ? student.email.split('@')[0].toLowerCase().trim() : '';
        const cleanEmailRoll = normalizeKey(emailRoll);

        const mappedUrl = updatedMap.get(String(student.userId)) ||
                          updatedMap.get(rawRoll) ||
                          updatedMap.get(cleanRoll) ||
                          updatedMap.get(emailRoll) ||
                          updatedMap.get(cleanEmailRoll) ||
                          (digits.length >= 4 ? updatedMap.get(digits) : null);

        // ALWAYS REWRITE / OVERWRITE student photo image when mappedUrl exists!
        if (mappedUrl) {
          return { ...student, avatarUrl: mappedUrl };
        }
        return student;
      });
    });
  };

  // Filtering - 100% fail-safe against null values
  const filteredStudents = (students || []).filter(student => {
    if (!student) return false;
    const nameStr = String(student.name || '').toLowerCase();
    const rollStr = String(student.rollNumber || '').toLowerCase();
    const emailStr = String(student.email || '').toLowerCase();
    const term = String(searchTerm || '').toLowerCase();

    const matchesSearch = 
      nameStr.includes(term) ||
      rollStr.includes(term) ||
      emailStr.includes(term);

    if (statusFilter === 'mapped') return matchesSearch && !!student.avatarUrl;
    if (statusFilter === 'missing') return matchesSearch && !student.avatarUrl;
    return matchesSearch;
  });

  const totalRegistered = students.length;
  const mappedCount = students.filter(s => !!s.avatarUrl).length;
  const missingCount = totalRegistered - mappedCount;

  const chunkArray = (arr, size) => {
    const chunks = [];
    if (!arr) return chunks;
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const exportStudentPhotoFormatTemplate = () => {
    // Template with Placeholders: Name, Roll Number, Team Name, Photo Drive Link
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Roll Number', 'Team Name', 'Photo Drive Link']
    ]);

    worksheet['!cols'] = [
      { wch: 25 }, // Name
      { wch: 20 }, // Roll Number
      { wch: 25 }, // Team Name
      { wch: 60 }  // Photo Drive Link
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ID Card Format');

    const fileName = `student-id-card-upload-template.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleImageError = (e, url) => {
    const target = e.target;
    if (!target) return;
    const str = url || '';
    const match = str.match(/id=([a-zA-Z0-9_-]+)/) || str.match(/\/d\/([a-zA-Z0-9_-]+)/) || str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);

    if (match && match[1]) {
      const fileId = match[1];
      if (!target.dataset.tried1) {
        target.dataset.tried1 = 'true';
        target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
        return;
      }
      if (!target.dataset.tried2) {
        target.dataset.tried2 = 'true';
        target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
        return;
      }
      if (!target.dataset.tried3) {
        target.dataset.tried3 = 'true';
        target.src = `/api/registrations/drive-proxy?id=${fileId}`;
        return;
      }
    }

    target.style.display = 'none';
    if (target.nextSibling) {
      target.nextSibling.style.display = 'flex';
    }
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintTarget(null);
      setIsBatchPrinting(false);
      setShowAllForPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handlePrintSingleCard = () => {
    setPrintTarget('single');
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handlePrintBatch = () => {
    if (isBatchPrinting) return;
    setIsBatchPrinting(true);
    setPrintTarget('batch');
    setShowAllForPrint(false);
    setTimeout(() => {
      window.print();
      setIsBatchPrinting(false);
    }, 400);
  };

  const handlePrintAllCards = () => {
    if (isBatchPrinting) return;
    setIsBatchPrinting(true);
    setShowAllForPrint(true);
    setIsBatchViewOpen(true);
    setPrintTarget('batch');
    setTimeout(() => {
      window.print();
      setIsBatchPrinting(false);
      setShowAllForPrint(false);
    }, 600);
  };

  const handlePrintCard = () => {
    if (isSingleCardModalOpen) {
      handlePrintSingleCard();
    } else {
      handlePrintBatch();
    }
  };

  const downloadCardAsImage = async (studentOrElemId, filename, format = 'png') => {
    let elementId = studentOrElemId;
    if (typeof studentOrElemId === 'object' && studentOrElemId !== null) {
      setSelectedStudentForCard(studentOrElemId);
      await new Promise(r => setTimeout(r, 80));
      elementId = 'shared-download-card';
      filename = `ID-Card-${studentOrElemId.rollNumber || studentOrElemId.name || 'student'}`;
    }

    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#0f172a'
      });

      const mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
      const image = canvas.toDataURL(mimeType, 0.95);
      
      const link = document.createElement('a');
      link.href = image;
      link.download = `${filename}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download card image error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-16 gap-3">
        <div className="animate-spin w-10 h-10 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
        <span className="text-sm font-medium text-slate-500">Loading student registration data...</span>
      </div>
    );
  }



  return (
    <div className={`space-y-8 animate-fade-in ${printTarget === 'single' ? 'print-target-single' : ''} ${printTarget === 'batch' ? 'print-target-batch' : ''}`}>
      {/* CSS for print mode */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 4mm;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Reset all React layout ancestors to allow unclipped multi-page flow */
          #root,
          #root > div,
          main,
          .container,
          .animate-fade-in,
          .space-y-8 {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            border: none !important;
            background: transparent !important;
          }

          /* Hide all non-printable chrome */
          nav,
          footer,
          .no-print,
          .fixed.inset-0:not(.single-card-modal-overlay),
          [aria-hidden="true"],
          .glass-panel:not(#printable-id-cards) {
            display: none !important;
          }

          /* ── Batch Printing Mode ── */
          #printable-id-cards {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          .id-card-print-pages-container {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }

          .id-card-print-page {
            width: 100% !important;
            max-width: 202mm !important;
            min-height: 275mm !important;
            max-height: 284mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            padding: 4mm 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .id-card-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .id-card-grid-4 {
            display: grid !important;
            grid-template-columns: 360px 360px !important;
            grid-template-rows: 500px 500px !important;
            gap: 12px 16px !important;
            justify-content: center !important;
            align-items: center !important;
            margin: 0 auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            zoom: 0.72 !important;
            transform-origin: top center !important;
          }

          @supports not (zoom: 1) {
            .id-card-grid-4 {
              transform: scale(0.72) !important;
              margin-bottom: -280px !important;
            }
          }

          .id-card-item {
            width: 360px !important;
            height: 500px !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .id-card-item svg, .id-card-item canvas, .id-card-item img {
            visibility: visible !important;
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* ── Single Card Print Mode ── */
          .print-target-single #printable-id-cards {
            display: none !important;
          }

          .single-card-modal-overlay.print-single-only {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }

          .single-card-modal-content {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 202mm !important;
          }

          .single-card-print-grid {
            display: flex !important;
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 20px !important;
            zoom: 0.76 !important;
            padding-top: 10mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          @supports not (zoom: 1) {
            .single-card-print-grid {
              transform: scale(0.76) !important;
              transform-origin: top center !important;
            }
          }
        }
      `}</style>

      {/* Non-Printable Management Chrome & Student Table */}
      <div className="no-print space-y-8">
        {/* Header & Stats Banner */}
        <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-fuchsia-300 border border-white/15 mb-3">
                <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
                Admin ID Card Workspace
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Student ID Cards Generator</h2>
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

              <button
                onClick={handlePrintAllCards}
                disabled={isBatchPrinting}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {isBatchPrinting && showAllForPrint ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Preparing All {totalRegistered} ID Cards...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Print All Registered Cards ({totalRegistered})</span>
                  </>
                )}
              </button>
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
        {/* Hidden File Input for ID Card Template Image */}
        <input
          type="file"
          ref={templateInputRef}
          onChange={handleTemplateUpload}
          accept="image/png, image/jpeg, image/jpg"
          className="hidden"
        />

        {/* Upload Custom ID Card Background Template Box (PNG or JPG) */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border-2 border-indigo-500/40 text-white space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                Upload ID Card Template Image (.png, .jpg)
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                Upload your custom background ID template design image (PNG or JPG format). Student <strong>Photo</strong>, <strong>Name</strong>, <strong>Roll Number</strong>, and <strong>Team Name</strong> placeholders will overlay on top.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => templateInputRef.current?.click()}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-fuchsia-600 hover:from-indigo-600 hover:to-fuchsia-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <span>🖼️</span> {idTemplateUrl ? 'Change Template (PNG/JPG)' : 'Upload ID Template (PNG/JPG)'}
              </button>

              {idTemplateUrl && (
                <button
                  onClick={handleResetTemplate}
                  className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold text-xs rounded-xl border border-red-500/20 transition-all cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {idTemplateUrl && (
            <div className="flex items-center gap-3 pt-2 text-xs text-emerald-400 font-bold border-t border-white/10">
              <span>✓ Active Background Template Image:</span>
              <img src={idTemplateUrl} alt="ID Template Preview" className="w-14 h-9 rounded-lg border border-emerald-500/40 object-cover shadow-sm" />
            </div>
          )}
        </div>

        {/* Interactive Visual Canvas Drag-and-Drop Editor for Placeholder Placement */}
        {idTemplateUrl && (
          <div className="p-6 rounded-3xl bg-slate-900 border-2 border-fuchsia-500/40 text-white space-y-6 shadow-xl animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h4 className="text-base font-black text-fuchsia-400 flex items-center gap-2">
                  Interactive Visual ID Layout Editor
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Drag & position the 4 placeholders directly on the template canvas below. All student ID cards will generate using this template!
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={saveIDConfig}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <span>💾</span> Save Layout Positions
                </button>
                <button
                  onClick={resetIDConfig}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-white/10 cursor-pointer transition-all"
                >
                  Reset Positions
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Interactive Visual Canvas (Left Column) */}
              <div className="lg:col-span-7 flex justify-center">
                <div
                  ref={editorCanvasRef}
                  className="relative rounded-3xl border-4 border-fuchsia-500/50 shadow-2xl overflow-hidden select-none bg-cover bg-center"
                  style={{
                    width: '360px',
                    height: '500px',
                    backgroundImage: `url(${idTemplateUrl})`,
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundColor: '#0f172a'
                  }}
                >
                  {/* Draggable Placeholder 1: STUDENT_PHOTO */}
                  {idConfig.STUDENT_PHOTO && (
                    <div
                      id="editor-placeholder-STUDENT_PHOTO"
                      onMouseDown={(e) => handlePlaceholderMouseDown(e, 'STUDENT_PHOTO')}
                      onClick={() => setActivePlaceholder('STUDENT_PHOTO')}
                      className={`absolute cursor-move border-2 transition-all flex items-center justify-center ${
                        activePlaceholder === 'STUDENT_PHOTO' ? 'border-fuchsia-400 ring-4 ring-fuchsia-400/40 z-30' : 'border-dashed border-white/60 z-20'
                      } rounded-2xl bg-black/30 backdrop-blur-xs overflow-hidden`}
                      style={{
                        left: `${idConfig.STUDENT_PHOTO.x}px`,
                        top: `${idConfig.STUDENT_PHOTO.y}px`,
                        width: `${idConfig.STUDENT_PHOTO.size || 100}px`,
                        height: `${idConfig.STUDENT_PHOTO.size || 100}px`
                      }}
                    >
                      {selectedStudentForCard?.avatarUrl ? (
                        <img
                          src={resolveStudentAvatarUrl(selectedStudentForCard.avatarUrl)}
                          alt="Photo Preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pointer-events-none"
                          onError={(e) => handleImageError(e, selectedStudentForCard.avatarUrl)}
                        />
                      ) : (
                        <div className="text-center p-1 pointer-events-none">
                          <span className="text-xl block">🖼️</span>
                          <span className="text-[9px] font-black text-white uppercase tracking-wider block">Photo Box</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Draggable Placeholder 2: STUDENT_NAME */}
                  {idConfig.STUDENT_NAME && (
                    <div
                      id="editor-placeholder-STUDENT_NAME"
                      onMouseDown={(e) => handlePlaceholderMouseDown(e, 'STUDENT_NAME')}
                      onClick={() => setActivePlaceholder('STUDENT_NAME')}
                      className={`absolute cursor-move border transition-all px-3 py-1 rounded-lg ${
                        activePlaceholder === 'STUDENT_NAME' ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40 z-30 bg-fuchsia-950/80' : 'border-dashed border-white/40 z-20 bg-black/50'
                      }`}
                      style={{
                        left: `${idConfig.STUDENT_NAME.x}px`,
                        top: `${idConfig.STUDENT_NAME.y}px`,
                        fontSize: `${idConfig.STUDENT_NAME.fontSize || 18}px`,
                        color: idConfig.STUDENT_NAME.color || '#ffffff',
                        textAlign: idConfig.STUDENT_NAME.align || 'center',
                        transform: idConfig.STUDENT_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: '900'
                      }}
                    >
                      [Student Full Name]
                    </div>
                  )}

                  {/* Draggable Placeholder 3: COLLEGE_NAME */}
                  {idConfig.COLLEGE_NAME && (
                    <div
                      id="editor-placeholder-COLLEGE_NAME"
                      onMouseDown={(e) => handlePlaceholderMouseDown(e, 'COLLEGE_NAME')}
                      onClick={() => setActivePlaceholder('COLLEGE_NAME')}
                      className={`absolute cursor-move border transition-all px-2.5 py-1 rounded-lg ${
                        activePlaceholder === 'COLLEGE_NAME' ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40 z-30 bg-fuchsia-950/80' : 'border-dashed border-white/40 z-20 bg-black/50'
                      }`}
                      style={{
                        left: `${idConfig.COLLEGE_NAME.x}px`,
                        top: `${idConfig.COLLEGE_NAME.y}px`,
                        fontSize: `${idConfig.COLLEGE_NAME.fontSize || 14}px`,
                        color: idConfig.COLLEGE_NAME.color || '#f0abfc',
                        textAlign: idConfig.COLLEGE_NAME.align || 'center',
                        transform: idConfig.COLLEGE_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: 'bold'
                      }}
                    >
                      [College Name]
                    </div>
                  )}

                  {/* Draggable Placeholder 4: TEAM_NAME */}
                  {idConfig.TEAM_NAME && (
                    <div
                      id="editor-placeholder-TEAM_NAME"
                      onMouseDown={(e) => handlePlaceholderMouseDown(e, 'TEAM_NAME')}
                      onClick={() => setActivePlaceholder('TEAM_NAME')}
                      className={`absolute cursor-move border transition-all px-2.5 py-1 rounded-lg ${
                        activePlaceholder === 'TEAM_NAME' ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40 z-30 bg-fuchsia-950/80' : 'border-dashed border-white/40 z-20 bg-black/50'
                      }`}
                      style={{
                        left: `${idConfig.TEAM_NAME.x}px`,
                        top: `${idConfig.TEAM_NAME.y}px`,
                        fontSize: `${idConfig.TEAM_NAME.fontSize || 13}px`,
                        color: idConfig.TEAM_NAME.color || '#e2e8f0',
                        textAlign: idConfig.TEAM_NAME.align || 'center',
                        transform: idConfig.TEAM_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: '600'
                      }}
                    >
                      [Team Name]
                    </div>
                  )}

                  {/* Draggable Placeholder 5: DEPARTMENT */}
                  {idConfig.DEPARTMENT && (
                    <div
                      id="editor-placeholder-DEPARTMENT"
                      onMouseDown={(e) => handlePlaceholderMouseDown(e, 'DEPARTMENT')}
                      onClick={() => setActivePlaceholder('DEPARTMENT')}
                      className={`absolute cursor-move border transition-all px-2.5 py-1 rounded-lg ${
                        activePlaceholder === 'DEPARTMENT' ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40 z-30 bg-fuchsia-950/80' : 'border-dashed border-white/40 z-20 bg-black/50'
                      }`}
                      style={{
                        left: `${idConfig.DEPARTMENT.x}px`,
                        top: `${idConfig.DEPARTMENT.y}px`,
                        fontSize: `${idConfig.DEPARTMENT.fontSize || 12}px`,
                        color: idConfig.DEPARTMENT.color || '#cbd5e1',
                        textAlign: idConfig.DEPARTMENT.align || 'center',
                        transform: idConfig.DEPARTMENT.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: '600'
                      }}
                    >
                      [Department]
                    </div>
                  )}

                  {/* Draggable Placeholder 6: DEGREE_PROGRAM */}
                  {idConfig.DEGREE_PROGRAM && (
                    <div
                      id="editor-placeholder-DEGREE_PROGRAM"
                      onMouseDown={(e) => handlePlaceholderMouseDown(e, 'DEGREE_PROGRAM')}
                      onClick={() => setActivePlaceholder('DEGREE_PROGRAM')}
                      className={`absolute cursor-move border transition-all px-2.5 py-1 rounded-lg ${
                        activePlaceholder === 'DEGREE_PROGRAM' ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40 z-30 bg-fuchsia-950/80' : 'border-dashed border-white/40 z-20 bg-black/50'
                      }`}
                      style={{
                        left: `${idConfig.DEGREE_PROGRAM.x}px`,
                        top: `${idConfig.DEGREE_PROGRAM.y}px`,
                        fontSize: `${idConfig.DEGREE_PROGRAM.fontSize || 12}px`,
                        color: idConfig.DEGREE_PROGRAM.color || '#94a3b8',
                        textAlign: idConfig.DEGREE_PROGRAM.align || 'center',
                        transform: idConfig.DEGREE_PROGRAM.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: '500'
                      }}
                    >
                      [Degree / Program]
                    </div>
                  )}
                </div>
              </div>

              {/* Placeholder Controls Panel (Right Column) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Active Placeholder Controls
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(idConfig).map(key => (
                      <button
                        key={key}
                        onClick={() => setActivePlaceholder(key)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          activePlaceholder === key
                            ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-md'
                            : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                        }`}
                      >
                        {idConfig[key].label}
                      </button>
                    ))}
                  </div>
                </div>

                {activePlaceholder && idConfig[activePlaceholder] && (
                  <div className="bg-slate-950 p-5 rounded-2xl border border-fuchsia-500/30 space-y-4 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="font-black text-fuchsia-400 text-sm">
                        Editing: {idConfig[activePlaceholder].label}
                      </h5>

                      <button
                        onClick={() => handleDeletePlaceholder(activePlaceholder)}
                        className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold text-[11px] rounded-lg border border-red-500/20 transition-all cursor-pointer flex items-center gap-1"
                        title="Delete this placeholder from template"
                      >
                        <span>🗑️</span> Delete
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Position X (px)</label>
                        <input
                          type="number"
                          value={idConfig[activePlaceholder].x}
                          onChange={(e) => updatePlaceholderProp(activePlaceholder, 'x', Number(e.target.value))}
                          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                          className="w-full border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Position Y (px)</label>
                        <input
                          type="number"
                          value={idConfig[activePlaceholder].y}
                          onChange={(e) => updatePlaceholderProp(activePlaceholder, 'y', Number(e.target.value))}
                          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                          className="w-full border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {activePlaceholder === 'STUDENT_PHOTO' ? (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Photo Box Size (px)</label>
                        <input
                          type="number"
                          value={idConfig.STUDENT_PHOTO.size || 100}
                          onChange={(e) => updatePlaceholderProp('STUDENT_PHOTO', 'size', Number(e.target.value))}
                          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                          className="w-full border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Font Size (px)</label>
                            <input
                              type="number"
                              value={idConfig[activePlaceholder].fontSize || 14}
                              onChange={(e) => updatePlaceholderProp(activePlaceholder, 'fontSize', Number(e.target.value))}
                              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                              className="w-full border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-sm font-bold focus:ring-2 focus:ring-fuchsia-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Text Color</label>
                            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-700">
                              <input
                                type="color"
                                value={idConfig[activePlaceholder].color || '#ffffff'}
                                onChange={(e) => updatePlaceholderProp(activePlaceholder, 'color', e.target.value)}
                                className="h-7 w-8 rounded cursor-pointer border-0 p-0"
                              />
                              <span className="font-mono text-xs uppercase text-slate-300">{idConfig[activePlaceholder].color || '#ffffff'}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Text Alignment</label>
                          <div className="flex gap-2">
                            {['left', 'center', 'right'].map(align => (
                              <button
                                key={align}
                                onClick={() => updatePlaceholderProp(activePlaceholder, 'align', align)}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-xl capitalize border cursor-pointer ${
                                  idConfig[activePlaceholder].align === align
                                    ? 'bg-fuchsia-600 text-white border-fuchsia-400'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                {align}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                <th className="py-3 px-4">College Name</th>
                <th className="py-3 px-4">Team Name</th>
                <th className="py-3 px-4 text-right">Pass & QR Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400 font-medium">
                    No matching student registrations found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.registrationId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      {student.avatarUrl ? (
                        <div className="relative w-11 h-11">
                          <img
                            src={resolveStudentAvatarUrl(student.avatarUrl)}
                            alt={student.name}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-full object-cover border-2 border-fuchsia-500 shadow-sm"
                            onError={(e) => handleImageError(e, student.avatarUrl)}
                          />
                          <div className="hidden w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold items-center justify-center text-sm shadow-sm">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
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
                      <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-xs">
                        {student.collegeName || ''}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {student.teamName ? (
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {student.teamName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Individual Registration</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedStudentId(student.registrationId || student.id || student.userId || student.studentId);
                            setIsSingleCardModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-fuchsia-500/10 to-indigo-500/10 hover:from-fuchsia-500 hover:to-indigo-600 text-fuchsia-600 hover:text-white dark:text-fuchsia-400 font-bold text-xs rounded-xl border border-fuchsia-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>📱</span> View ID & QR Pass
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Single ID Card Modal (Two-Sided Front & Back Pass) */}
      {isSingleCardModalOpen && selectedStudentForCard && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto single-card-modal-overlay ${printTarget === 'single' ? 'print-single-only' : 'no-print'}`}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 my-auto single-card-modal-content">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 no-print">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📇</span> Two-Sided Student ID Pass & Scannable QR Code
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Front side contains student profile details. Back side contains the unique scannable QR pass for event entry verification.
                </p>
              </div>
              <button
                onClick={() => setIsSingleCardModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Front & Back Cards Display Container */}
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-center gap-8 py-2 single-card-print-grid">
              {/* Side 1: Front ID Card */}
              <div className="space-y-2 text-center">
                <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider block">
                  Front Side (ID Details)
                </span>
                <div
                  id="single-card-front"
                  className="id-card-item rounded-3xl border border-white/20 shadow-2xl relative overflow-hidden text-center bg-cover bg-center select-none"
                  style={{
                    width: '360px',
                    height: '500px',
                    margin: '0 auto',
                    backgroundImage: idTemplateUrl ? `url(${idTemplateUrl})` : 'linear-gradient(to bottom, #0f172a, #1e1b4b, #090d16)',
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundColor: '#0f172a'
                  }}
                >
                  {/* 1. Student Photo Placeholder */}
                  {idConfig.STUDENT_PHOTO && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${idConfig.STUDENT_PHOTO.x}px`,
                        top: `${idConfig.STUDENT_PHOTO.y}px`,
                        width: `${idConfig.STUDENT_PHOTO.size || 100}px`,
                        height: `${idConfig.STUDENT_PHOTO.size || 100}px`
                      }}
                    >
                      {selectedStudentForCard.avatarUrl ? (
                        <img
                          src={resolveStudentAvatarUrl(selectedStudentForCard.avatarUrl)}
                          alt={selectedStudentForCard.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-2xl object-cover border-2 border-fuchsia-400 shadow-xl"
                          onError={(e) => handleImageError(e, selectedStudentForCard.avatarUrl)}
                        />
                      ) : (
                        <div className="w-full h-full rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-black text-3xl flex items-center justify-center border-2 border-white/20 shadow-xl">
                          {selectedStudentForCard.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Student Name Placeholder */}
                  {idConfig.STUDENT_NAME && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${idConfig.STUDENT_NAME.x}px`,
                        top: `${idConfig.STUDENT_NAME.y}px`,
                        fontSize: `${idConfig.STUDENT_NAME.fontSize || 18}px`,
                        color: idConfig.STUDENT_NAME.color || '#ffffff',
                        textAlign: idConfig.STUDENT_NAME.align || 'center',
                        transform: idConfig.STUDENT_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: '900'
                      }}
                    >
                      {selectedStudentForCard.name}
                    </div>
                  )}

                  {/* 3. College Name Placeholder */}
                  {idConfig.COLLEGE_NAME && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${idConfig.COLLEGE_NAME.x}px`,
                        top: `${idConfig.COLLEGE_NAME.y}px`,
                        fontSize: `${idConfig.COLLEGE_NAME.fontSize || 14}px`,
                        color: idConfig.COLLEGE_NAME.color || '#f0abfc',
                        textAlign: idConfig.COLLEGE_NAME.align || 'center',
                        transform: idConfig.COLLEGE_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: 'bold'
                      }}
                    >
                      {selectedStudentForCard.collegeName || ''}
                    </div>
                  )}

                  {/* 4. Team Name Placeholder */}
                  {idConfig.TEAM_NAME && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${idConfig.TEAM_NAME.x}px`,
                        top: `${idConfig.TEAM_NAME.y}px`,
                        fontSize: `${idConfig.TEAM_NAME.fontSize || 13}px`,
                        color: idConfig.TEAM_NAME.color || '#e2e8f0',
                        textAlign: idConfig.TEAM_NAME.align || 'center',
                        transform: idConfig.TEAM_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: '600'
                      }}
                    >
                      {selectedStudentForCard.teamName || ''}
                    </div>
                  )}

                  {/* 5. Department Placeholder */}
                  {idConfig.DEPARTMENT && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${idConfig.DEPARTMENT.x}px`,
                        top: `${idConfig.DEPARTMENT.y}px`,
                        fontSize: `${idConfig.DEPARTMENT.fontSize || 12}px`,
                        color: idConfig.DEPARTMENT.color || '#cbd5e1',
                        textAlign: idConfig.DEPARTMENT.align || 'center',
                        transform: idConfig.DEPARTMENT.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: '600'
                      }}
                    >
                      {selectedStudentForCard.department || ''}
                    </div>
                  )}

                  {/* 6. Degree Program Placeholder */}
                  {idConfig.DEGREE_PROGRAM && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${idConfig.DEGREE_PROGRAM.x}px`,
                        top: `${idConfig.DEGREE_PROGRAM.y}px`,
                        fontSize: `${idConfig.DEGREE_PROGRAM.fontSize || 12}px`,
                        color: idConfig.DEGREE_PROGRAM.color || '#94a3b8',
                        textAlign: idConfig.DEGREE_PROGRAM.align || 'center',
                        transform: idConfig.DEGREE_PROGRAM.align === 'center' ? 'translateX(-50%)' : 'none',
                        whiteSpace: 'nowrap',
                        fontWeight: '500'
                      }}
                    >
                      {selectedStudentForCard.degreeProgram || ''}
                    </div>
                  )}

                  {/* 7. QR Code Placeholder */}
                  {idConfig.QR_CODE && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${idConfig.QR_CODE.x}px`,
                        top: `${idConfig.QR_CODE.y}px`,
                        width: `${idConfig.QR_CODE.size || 90}px`,
                        height: `${idConfig.QR_CODE.size || 90}px`
                      }}
                      className="bg-white p-1 rounded-xl shadow-md border border-slate-200 flex items-center justify-center"
                    >
                      <QRCodeSVG
                        value={String(selectedStudentForCard.registrationId || selectedStudentForCard.id || selectedStudentForCard.userId || selectedStudentForCard.email || 'EVENT_PASS')}
                        size={(idConfig.QR_CODE.size || 90) - 8}
                        level="H"
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                        includeMargin={false}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Dedicated Attached QR Pass Card (Only QR Code on Card) */}
              <div className="space-y-2 text-center">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  Attached Dedicated QR Card
                </span>
                <div
                  id="single-card-back"
                  className="id-card-item rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden text-center select-none p-6 flex flex-col items-center justify-between bg-white"
                  style={{
                    width: '360px',
                    height: '500px',
                    margin: '0 auto',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {/* Pass Header */}
                  <div className="w-full space-y-1 pt-2 z-10">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <img src="/logo.png?v=3" alt="Avento Logo" className="h-6 w-auto object-contain" />
                      <span className="text-xs font-black tracking-wider uppercase text-slate-900">AVENTO</span>
                    </div>
                    <span className="inline-block px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                      OFFICIAL EVENT ENTRY PASS
                    </span>
                    <h4 className="text-sm font-black text-slate-900 line-clamp-1 pt-0.5">
                      {selectedStudentForCard.name}
                    </h4>
                  </div>

                  {/* Centered Large QR Code Box */}
                  <div className="p-3.5 bg-white rounded-3xl shadow-xl border-4 border-slate-900 my-auto flex items-center justify-center relative z-10">
                    <QRCodeSVG
                      value={String(selectedStudentForCard.registrationId || selectedStudentForCard.id || selectedStudentForCard.userId || selectedStudentForCard.email || 'EVENT_PASS')}
                      size={230}
                      level="H"
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      includeMargin={false}
                    />
                  </div>

                  {/* Pass Details */}
                  <div className="w-full space-y-1 pb-1 z-10">
                    <div className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                      VENUE ENTRY PASS
                    </div>
                    {selectedStudentForCard.collegeName && (
                      <div className="text-[11px] font-bold text-slate-700 line-clamp-1">{selectedStudentForCard.collegeName}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 no-print">
              <button
                onClick={() => setIsSingleCardModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl btn-secondary"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => downloadCardAsImage('single-card-front', `ID-Front-${selectedStudentForCard.name.replace(/\s+/g, '_')}`, 'png')}
                  className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Download Front ID Card as PNG Image"
                >
                  <span>🖼️</span> Download Front (PNG)
                </button>

                <button
                  onClick={() => downloadCardAsImage('single-card-back', `ID-Back-QR-${selectedStudentForCard.name.replace(/\s+/g, '_')}`, 'png')}
                  className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 hover:text-white dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Download Back QR Pass as PNG Image"
                >
                  <span>📱</span> Download Back QR Pass (PNG)
                </button>

                <button
                  onClick={handlePrintSingleCard}
                  className="px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                  title="Print or Save Two-Sided Pass as PDF Document"
                >
                  <span>🖨️</span> Print Two-Sided Pass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch ID Cards View / Printable Grid */}
      {isBatchViewOpen && (() => {
        const displayList = (showAllForPrint || batchPageSize === 'all') 
          ? students 
          : students.slice((batchPage - 1) * Number(batchPageSize), batchPage * Number(batchPageSize));

        const totalBatchPages = batchPageSize === 'all' ? 1 : Math.ceil(students.length / Number(batchPageSize));

        return (
          <div id="printable-id-cards" className={`glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 ${printTarget === 'single' ? 'no-print' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 no-print">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Batch ID Cards Preview</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Print or export ID cards for all registered students ({students.length} Total).</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Scalability Pagination & Batch Selection Bar for 500+ ID Cards */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    disabled={batchPage <= 1 || batchPageSize === 'all'}
                    onClick={() => setBatchPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm disabled:opacity-40 cursor-pointer"
                  >
                    ← Prev Batch
                  </button>

                  <select
                    value={batchPage}
                    onChange={e => setBatchPage(Number(e.target.value))}
                    disabled={batchPageSize === 'all'}
                    className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer"
                  >
                    {Array.from({ length: totalBatchPages }, (_, i) => {
                      const pSize = Number(batchPageSize) || 50;
                      const bStart = i * pSize + 1;
                      const bEnd = Math.min((i + 1) * pSize, students.length);
                      return (
                        <option key={i + 1} value={i + 1}>
                          Batch {i + 1}: Students {bStart}–{bEnd} ({bEnd - bStart + 1} Participants • {Math.ceil((bEnd - bStart + 1) / 2)} A4 Pages)
                        </option>
                      );
                    })}
                  </select>

                  <button
                    disabled={batchPage >= totalBatchPages || batchPageSize === 'all'}
                    onClick={() => setBatchPage(p => Math.min(totalBatchPages, p + 1))}
                    className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm disabled:opacity-40 cursor-pointer"
                  >
                    Next Batch →
                  </button>

                  <select
                    value={batchPageSize}
                    onChange={e => {
                      setBatchPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setBatchPage(1);
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer"
                    title="Batch Size Selection"
                  >
                    <option value={50}>50 Students / Batch (Recommended)</option>
                    <option value={100}>100 Students / Batch</option>
                    <option value={20}>20 Students / Batch</option>
                    <option value="all">Show All ({students.length} Students)</option>
                  </select>
                </div>

                <button
                  onClick={handlePrintBatch}
                  disabled={isBatchPrinting}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-xl shadow-md hover:from-emerald-700 hover:to-teal-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isBatchPrinting && printTarget === 'batch' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Preparing Batch {batchPageSize === 'all' ? 'All' : batchPage}...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      <span>🖨️ Print Batch {batchPageSize === 'all' ? 'All' : batchPage} ({displayList.length} Students • {Math.ceil(displayList.length / 2)} A4 Pages)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-8 id-card-print-pages-container">
              {chunkArray(displayList, 2).map((pageStudents, pageIdx) => (
                <div key={pageIdx} className="id-card-print-page space-y-3">
                  <div className="no-print flex items-center justify-between text-xs font-bold text-fuchsia-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2 w-full max-w-3xl">
                    <span>📄 Printed Page {pageIdx + 1} (2 Participants • 4 Cards per Page)</span>
                    <span className="text-slate-400 font-mono font-normal">({pageStudents.length} Participants • {pageStudents.length * 2} Cards)</span>
                  </div>

                  <div className="id-card-grid-4 grid grid-cols-2 gap-6 items-center justify-center">
                    {pageStudents.map((student) => (
                      <React.Fragment key={student.registrationId}>
                        {/* Front Side ID Card */}
                        <div
                          className="id-card-item rounded-3xl border border-white/20 shadow-lg relative overflow-hidden text-center bg-cover bg-center select-none"
                          style={{
                            width: '360px',
                            height: '500px',
                            margin: '0 auto',
                            backgroundImage: idTemplateUrl ? `url(${idTemplateUrl})` : 'linear-gradient(to bottom, #0f172a, #1e1b4b, #090d16)',
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundColor: '#0f172a'
                          }}
                        >
                          {/* 1. Student Photo Placeholder */}
                          {idConfig.STUDENT_PHOTO && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${idConfig.STUDENT_PHOTO.x}px`,
                                top: `${idConfig.STUDENT_PHOTO.y}px`,
                                width: `${idConfig.STUDENT_PHOTO.size || 100}px`,
                                height: `${idConfig.STUDENT_PHOTO.size || 100}px`
                              }}
                            >
                              {student.avatarUrl ? (
                                <img
                                  src={resolveStudentAvatarUrl(student.avatarUrl)}
                                  alt={student.name}
                                  loading="eager"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full rounded-2xl object-cover border-2 border-fuchsia-400 shadow-md"
                                  onError={(e) => handleImageError(e, student.avatarUrl)}
                                />
                              ) : (
                                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-black text-3xl flex items-center justify-center border-2 border-white/20">
                                  {student.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2. Student Name Placeholder */}
                          {idConfig.STUDENT_NAME && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${idConfig.STUDENT_NAME.x}px`,
                                top: `${idConfig.STUDENT_NAME.y}px`,
                                fontSize: `${idConfig.STUDENT_NAME.fontSize || 18}px`,
                                color: idConfig.STUDENT_NAME.color || '#ffffff',
                                textAlign: idConfig.STUDENT_NAME.align || 'center',
                                transform: idConfig.STUDENT_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                                whiteSpace: 'nowrap',
                                fontWeight: '900'
                              }}
                            >
                              {student.name}
                            </div>
                          )}

                          {/* 3. College Name Placeholder */}
                          {idConfig.COLLEGE_NAME && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${idConfig.COLLEGE_NAME.x}px`,
                                top: `${idConfig.COLLEGE_NAME.y}px`,
                                fontSize: `${idConfig.COLLEGE_NAME.fontSize || 14}px`,
                                color: idConfig.COLLEGE_NAME.color || '#f0abfc',
                                textAlign: idConfig.COLLEGE_NAME.align || 'center',
                                transform: idConfig.COLLEGE_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                                whiteSpace: 'nowrap',
                                fontWeight: 'bold'
                              }}
                            >
                              {student.collegeName || ''}
                            </div>
                          )}

                          {/* 4. Team Name Placeholder */}
                          {idConfig.TEAM_NAME && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${idConfig.TEAM_NAME.x}px`,
                                top: `${idConfig.TEAM_NAME.y}px`,
                                fontSize: `${idConfig.TEAM_NAME.fontSize || 13}px`,
                                color: idConfig.TEAM_NAME.color || '#e2e8f0',
                                textAlign: idConfig.TEAM_NAME.align || 'center',
                                transform: idConfig.TEAM_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                                whiteSpace: 'nowrap',
                                fontWeight: '600'
                              }}
                            >
                              {student.teamName || ''}
                            </div>
                          )}

                          {/* 5. Department Placeholder */}
                          {idConfig.DEPARTMENT && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${idConfig.DEPARTMENT.x}px`,
                                top: `${idConfig.DEPARTMENT.y}px`,
                                fontSize: `${idConfig.DEPARTMENT.fontSize || 12}px`,
                                color: idConfig.DEPARTMENT.color || '#cbd5e1',
                                textAlign: idConfig.DEPARTMENT.align || 'center',
                                transform: idConfig.DEPARTMENT.align === 'center' ? 'translateX(-50%)' : 'none',
                                whiteSpace: 'nowrap',
                                fontWeight: '600'
                              }}
                            >
                              {student.department || ''}
                            </div>
                          )}

                          {/* 6. Degree Program Placeholder */}
                          {idConfig.DEGREE_PROGRAM && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${idConfig.DEGREE_PROGRAM.x}px`,
                                top: `${idConfig.DEGREE_PROGRAM.y}px`,
                                fontSize: `${idConfig.DEGREE_PROGRAM.fontSize || 12}px`,
                                color: idConfig.DEGREE_PROGRAM.color || '#94a3b8',
                                textAlign: idConfig.DEGREE_PROGRAM.align || 'center',
                                transform: idConfig.DEGREE_PROGRAM.align === 'center' ? 'translateX(-50%)' : 'none',
                                whiteSpace: 'nowrap',
                                fontWeight: '500'
                              }}
                            >
                              {student.degreeProgram || ''}
                            </div>
                          )}

                        </div>

                        {/* Attached Dedicated QR Pass Card (Only QR Code on Card) */}
                        <div
                          className="id-card-item rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg relative overflow-hidden text-center select-none p-6 flex flex-col items-center justify-between bg-white"
                          style={{
                            width: '360px',
                            height: '500px',
                            margin: '0 auto',
                            backgroundColor: '#ffffff'
                          }}
                        >
                          {/* Header */}
                          <div className="w-full space-y-1 pt-2 z-10">
                            <div className="flex items-center justify-center gap-1.5 mb-1">
                              <img src="/logo.png?v=3" alt="Avento Logo" className="h-6 w-auto object-contain" />
                              <span className="text-xs font-black tracking-wider uppercase text-slate-900">AVENTO</span>
                            </div>
                            <span className="inline-block px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                              OFFICIAL EVENT ENTRY PASS
                            </span>
                            <h4 className="text-sm font-black text-slate-900 line-clamp-1 pt-0.5">
                              {student.name}
                            </h4>
                          </div>

                          {/* Centered Large QR Code Box */}
                          <div className="p-3.5 bg-white rounded-3xl shadow-xl border-4 border-slate-900 my-auto flex items-center justify-center relative z-10">
                            <QRCodeSVG
                              value={String(student.registrationId || student.id || student.userId || student.rollNumber || student.email || 'EVENT_PASS')}
                              size={230}
                              level="H"
                              bgColor="#FFFFFF"
                              fgColor="#000000"
                              includeMargin={false}
                            />
                          </div>

                          {/* Pass Details */}
                          <div className="w-full space-y-1 pb-1 z-10">
                            <div className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                              VENUE ENTRY PASS
                            </div>
                            {student.collegeName && (
                              <div className="text-[11px] font-bold text-slate-700 line-clamp-1">{student.collegeName}</div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Shared Off-Screen Target for Single-Click Scalable Card Downloads (1000+ Students) */}
      {selectedStudentForCard && (
        <div
          id="shared-download-card"
          className="fixed -left-[9999px] -top-[9999px] rounded-3xl border border-white/20 text-center bg-cover bg-center select-none pointer-events-none no-print"
          style={{
            width: '360px',
            height: '500px',
            backgroundImage: idTemplateUrl ? `url(${idTemplateUrl})` : 'linear-gradient(to bottom, #0f172a, #1e1b4b, #090d16)',
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundColor: '#0f172a'
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${idConfig.STUDENT_PHOTO.x}px`,
              top: `${idConfig.STUDENT_PHOTO.y}px`,
              width: `${idConfig.STUDENT_PHOTO.size || 100}px`,
              height: `${idConfig.STUDENT_PHOTO.size || 100}px`
            }}
          >
            {selectedStudentForCard.avatarUrl ? (
              <img
                src={resolveStudentAvatarUrl(selectedStudentForCard.avatarUrl)}
                alt={selectedStudentForCard.name}
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-2xl object-cover border-2 border-fuchsia-400 shadow-md"
                onError={(e) => handleImageError(e, selectedStudentForCard.avatarUrl)}
              />
            ) : (
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-black text-3xl flex items-center justify-center border-2 border-white/20">
                {(selectedStudentForCard.name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div
            style={{
              position: 'absolute',
              left: `${idConfig.STUDENT_NAME.x}px`,
              top: `${idConfig.STUDENT_NAME.y}px`,
              fontSize: `${idConfig.STUDENT_NAME.fontSize || 18}px`,
              color: idConfig.STUDENT_NAME.color || '#ffffff',
              textAlign: idConfig.STUDENT_NAME.align || 'center',
              transform: idConfig.STUDENT_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
              whiteSpace: 'nowrap',
              fontWeight: '900'
            }}
          >
            {selectedStudentForCard.name}
          </div>

          {idConfig.COLLEGE_NAME && (
            <div
              style={{
                position: 'absolute',
                left: `${idConfig.COLLEGE_NAME.x}px`,
                top: `${idConfig.COLLEGE_NAME.y}px`,
                fontSize: `${idConfig.COLLEGE_NAME.fontSize || 14}px`,
                color: idConfig.COLLEGE_NAME.color || '#f0abfc',
                textAlign: idConfig.COLLEGE_NAME.align || 'center',
                transform: idConfig.COLLEGE_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                whiteSpace: 'nowrap',
                fontWeight: 'bold'
              }}
            >
              {selectedStudentForCard.collegeName || 'N/A'}
            </div>
          )}

          {idConfig.TEAM_NAME && (
            <div
              style={{
                position: 'absolute',
                left: `${idConfig.TEAM_NAME.x}px`,
                top: `${idConfig.TEAM_NAME.y}px`,
                fontSize: `${idConfig.TEAM_NAME.fontSize || 13}px`,
                color: idConfig.TEAM_NAME.color || '#e2e8f0',
                textAlign: idConfig.TEAM_NAME.align || 'center',
                transform: idConfig.TEAM_NAME.align === 'center' ? 'translateX(-50%)' : 'none',
                whiteSpace: 'nowrap',
                fontWeight: '600'
              }}
            >
              {selectedStudentForCard.teamName || 'N/A'}
            </div>
          )}

          {idConfig.DEPARTMENT && (
            <div
              style={{
                position: 'absolute',
                left: `${idConfig.DEPARTMENT.x}px`,
                top: `${idConfig.DEPARTMENT.y}px`,
                fontSize: `${idConfig.DEPARTMENT.fontSize || 12}px`,
                color: idConfig.DEPARTMENT.color || '#cbd5e1',
                textAlign: idConfig.DEPARTMENT.align || 'center',
                transform: idConfig.DEPARTMENT.align === 'center' ? 'translateX(-50%)' : 'none',
                whiteSpace: 'nowrap',
                fontWeight: '600'
              }}
            >
              {selectedStudentForCard.department || 'N/A'}
            </div>
          )}

          {idConfig.DEGREE_PROGRAM && (
            <div
              style={{
                position: 'absolute',
                left: `${idConfig.DEGREE_PROGRAM.x}px`,
                top: `${idConfig.DEGREE_PROGRAM.y}px`,
                fontSize: `${idConfig.DEGREE_PROGRAM.fontSize || 12}px`,
                color: idConfig.DEGREE_PROGRAM.color || '#94a3b8',
                textAlign: idConfig.DEGREE_PROGRAM.align || 'center',
                transform: idConfig.DEGREE_PROGRAM.align === 'center' ? 'translateX(-50%)' : 'none',
                whiteSpace: 'nowrap',
                fontWeight: '500'
              }}
            >
              {selectedStudentForCard.degreeProgram || 'N/A'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

class IDCardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('IDCardManager Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 max-w-xl mx-auto my-8 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-xl font-black">
            📇
          </div>
          <h3 className="text-lg font-bold text-white">ID Card Workspace</h3>
          <div className="text-xs text-red-400 font-mono bg-red-950/40 p-3 rounded-xl border border-red-500/20 text-left overflow-x-auto">
            <strong>Error:</strong> {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-fuchsia-500/25 transition-all cursor-pointer"
          >
            Reload ID Cards Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const SafeIDCardManager = (props) => (
  <IDCardErrorBoundary>
    <IDCardManager {...props} />
  </IDCardErrorBoundary>
);

export default SafeIDCardManager;
