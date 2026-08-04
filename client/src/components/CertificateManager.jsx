import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const defaultFields = {
  STUDENT_NAME: { x: 421, y: 300, fontSize: 36, fontFamily: 'Helvetica', align: 'center', color: '#000000', label: 'Student Name' },
  EVENT_NAME: { x: 421, y: 380, fontSize: 24, fontFamily: 'Helvetica', align: 'center', color: '#000000', label: 'Event Name' },
  EVENT_DATE: { x: 421, y: 420, fontSize: 18, fontFamily: 'Helvetica', align: 'center', color: '#000000', label: 'Event Date' },
  EVENT_VENUE: { x: 421, y: 460, fontSize: 18, fontFamily: 'Helvetica', align: 'center', color: '#000000', label: 'Event Venue' },
  ISSUE_DATE: { x: 150, y: 500, fontSize: 16, fontFamily: 'Helvetica', align: 'left', color: '#000000', label: 'Issue Date' },
  CERTIFICATE_ID: { x: 150, y: 530, fontSize: 12, fontFamily: 'Helvetica', align: 'left', color: '#000000', label: 'Certificate ID' },
  ORGANIZER_NAME: { x: 150, y: 560, fontSize: 16, fontFamily: 'Helvetica', align: 'left', color: '#000000', label: 'Organizer Name' },
  FACULTY_COORDINATOR: { x: 692, y: 560, fontSize: 16, fontFamily: 'Helvetica', align: 'right', color: '#000000', label: 'Faculty Coordinator' }
};

const CertificateManager = ({ eventId, eventStatus }) => {
  const { user } = useAuth();
  const [templateFile, setTemplateFile] = useState(null);
  const [templateUrl, setTemplateUrl] = useState(null);
  
  const getFullImageUrl = (urlPath) => {
    if (!urlPath) return '';
    if (urlPath.startsWith('http')) return urlPath;
    if (axios.defaults.baseURL) {
      const base = axios.defaults.baseURL.replace(/\/$/, '');
      const path = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
      return `${base}${path}`;
    }
    return urlPath;
  };
  const [config, setConfig] = useState(defaultFields);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState(null);
  
  // Visual Editor State
  const [scale, setScale] = useState(1);
  const [activeField, setActiveField] = useState(null);
  const [draggingField, setDraggingField] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startX: 0, startY: 0 });

  useEffect(() => {
    // Fetch initial config
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`/api/certificates/config/${eventId}`);
        if (res.data.template) {
          setTemplateUrl(res.data.template);
        }
        if (res.data.config) {
          // Merge with default to ensure label/structure is correct
          const merged = { ...defaultFields };
          for (let key in res.data.config) {
            if (merged[key]) {
              merged[key] = { ...merged[key], ...res.data.config[key] };
            }
          }
          setConfig(merged);
        }
      } catch (err) {
        console.error("Failed to fetch certificate config", err);
      }
    };
    if (eventId) fetchConfig();
  }, [eventId]);

  // Drag Handlers
  const handleMouseDown = (e, key) => {
    e.stopPropagation();
    setActiveField(key);
    setDraggingField(key);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startX: Number(config[key].x) || 0,
      startY: Number(config[key].y) || 0
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingField) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      
      const naturalDx = dx * scale;
      const naturalDy = dy * scale;
      
      setConfig(prev => ({
        ...prev,
        [draggingField]: {
          ...prev[draggingField],
          x: dragStart.startX + naturalDx,
          y: dragStart.startY + naturalDy
        }
      }));
    };

    const handleMouseUp = () => {
      if (draggingField) setDraggingField(null);
    };

    if (draggingField) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingField, dragStart, scale]);

  const handleImageLoad = (e) => {
    const { naturalWidth, clientWidth } = e.target;
    setScale(naturalWidth / clientWidth);
  };

  const updateFieldProperty = (key, property, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [property]: value
      }
    }));
  };

  if (eventStatus !== 'completed') {
    return (
      <div className="glass-panel p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Certificate Management</h2>
        <p className="text-sm text-text-secondary">Certificates can only be managed once the event is marked as Completed.</p>
      </div>
    );
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setTemplateFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!templateFile) return;
    setUploading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('template', templateFile);
      
      const res = await axios.post(`/api/certificates/template/${eventId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTemplateUrl(res.data.templatePath);
      setFeedback({ type: 'success', message: 'Template uploaded successfully!' });
      setTemplateFile(null);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Error uploading template' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await axios.put(`/api/certificates/config/${eventId}`, { config });
      setFeedback({ type: 'success', message: 'Layout configuration saved!' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Error saving layout' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTest = async () => {
    setGenerating(true);
    setFeedback(null);
    try {
      const res = await axios.post(`/api/certificates/generate/${eventId}/test`);
      
      // Open the preview certificate in a new tab using the fully qualified backend URL
      const pdfUrl = getFullImageUrl(res.data.certificate_url);
      window.open(pdfUrl, '_blank');

      setFeedback({ type: 'success', message: 'Test certificate opened in a new tab!' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Error generating test certificate' });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    setFeedback(null);
    try {
      const res = await axios.post(`/api/certificates/generate/${eventId}/all`);
      setFeedback({ type: 'success', message: res.data.message });
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Error generating certificates' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-[2rem] shadow-sm border border-slate-200 mb-8 animate-fade-in-up">
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
        </svg>
        Certificate Editor
      </h2>
      
      {feedback && (
        <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex items-center gap-2.5 ${
          feedback.type === 'success' ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-600' : 'bg-red-500/8 border-red-500/15 text-red-600'
        }`}>
          <span>{feedback.type === 'success' ? '✓' : '⚠'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* STEP 1: Upload Template */}
      <div className="mb-8 border border-slate-200 p-5 rounded-xl glass-panel">
        <h3 className="font-medium text-text-primary mb-2">1. Upload Template Image</h3>
        <p className="text-xs text-text-secondary mb-4">Provide a high-quality blank certificate (PNG or JPG recommended).</p>
        <div className="flex gap-2">
          <input 
            type="file" 
            accept=".png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors"
          />
          <button 
            onClick={handleUpload}
            disabled={!templateFile || uploading}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-indigo-700 transition-colors"
          >
            {uploading ? 'Uploading...' : (templateUrl ? 'Replace Template' : 'Upload Template')}
          </button>
        </div>
      </div>

      {/* STEP 2: Visual Editor */}
      {templateUrl && (
        <div className="mb-8">
          <h3 className="font-medium text-text-primary mb-4">2. Visual Designer</h3>
          
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Editor Canvas */}
            <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden relative group">
              <div 
                className="relative shadow-sm w-full select-none"
                style={{ cursor: draggingField ? 'grabbing' : 'auto' }}
              >
                <img 
                  src={getFullImageUrl(templateUrl)} 
                  onLoad={handleImageLoad} 
                  className="w-full h-auto pointer-events-none block" 
                  alt="Certificate Template"
                  draggable={false}
                />
                
                {Object.entries(config).map(([key, field]) => {
                  const safeScale = scale || 1;
                  const screenX = Number(field.x) / safeScale;
                  const screenY = Number(field.y) / safeScale;
                  const screenFontSize = Math.max(8, (Number(field.fontSize) || 12) / safeScale); // don't let it get too small visually
                  
                  let transform = '';
                  if (field.align === 'center') transform = 'translateX(-50%)';
                  else if (field.align === 'right') transform = 'translateX(-100%)';
                  
                  return (
                    <div 
                      key={key}
                      onMouseDown={(e) => handleMouseDown(e, key)}
                      className={`absolute px-1 py-0.5 cursor-grab transition-colors duration-100 ${
                        activeField === key 
                          ? 'border-2 border-indigo-500 bg-indigo-500/20 shadow-lg' 
                          : 'border-2 border-dashed border-slate-400/70 hover:border-indigo-400 bg-white/20'
                      }`}
                      style={{
                        left: screenX,
                        top: screenY,
                        transform,
                        color: field.color,
                        fontFamily: field.fontFamily,
                        fontSize: `${screenFontSize}px`,
                        lineHeight: 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {'{'}{key}{'}'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Properties Panel */}
            <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
              <div className="glass-panel border border-slate-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-text-primary mb-4 border-b border-slate-200/50 pb-2">Placeholder Styling</h4>
                
                {!activeField ? (
                  <p className="text-xs text-slate-500 italic text-center py-8">Click on a placeholder in the template to edit its styles.</p>
                ) : (
                  <div className="space-y-4 animate-fade-in-up">
                    <div>
                      <p className="text-xs font-bold text-indigo-600 mb-1">{config[activeField].label}</p>
                      <p className="text-[10px] text-slate-400 mb-3">Drag on image to reposition</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Font Size (px)</label>
                      <input 
                        type="number" 
                        value={config[activeField].fontSize}
                        onChange={(e) => updateFieldProperty(activeField, 'fontSize', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Font Family</label>
                      <select 
                        value={config[activeField].fontFamily}
                        onChange={(e) => updateFieldProperty(activeField, 'fontFamily', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      >
                        <option value="Helvetica">Helvetica (Sans-Serif)</option>
                        <option value="Times New Roman">Times New Roman (Serif)</option>
                        <option value="Courier">Courier (Monospace)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Text Color</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={config[activeField].color}
                          onChange={(e) => updateFieldProperty(activeField, 'color', e.target.value)}
                          className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs text-slate-600 font-mono uppercase">{config[activeField].color}</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Alignment</label>
                      <div className="flex gap-2">
                        {['left', 'center', 'right'].map(align => (
                          <button
                            key={align}
                            onClick={() => updateFieldProperty(activeField, 'align', align)}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize border ${
                              config[activeField].align === align 
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full py-3 bg-slate-800 text-white text-sm font-bold rounded-xl shadow-lg shadow-slate-800/20 hover:bg-slate-900 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Template Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Generate */}
      {templateUrl && (
        <div className="border border-slate-200 border-t-4 border-t-emerald-400 p-5 rounded-xl scrapbook-panel">
          <h3 className="font-medium text-emerald-500 mb-2">3. Issue Certificates</h3>
          <p className="text-xs text-text-secondary mb-4">Ensure you have saved your layout configuration before generating. This will generate personalized PDFs for all registered/attended participants.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleGenerateTest}
              disabled={generating}
              className="px-6 py-2.5 bg-white border border-emerald-500 text-emerald-600 text-sm font-bold rounded-xl shadow-sm hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              Generate Test (For Me)
            </button>
            <button 
              onClick={handleGenerateAll}
              disabled={generating}
              className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate All Certificates'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateManager;
