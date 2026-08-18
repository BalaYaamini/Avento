import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const defaultFields = {
  STUDENT_NAME: { x: 421, y: 300, fontSize: 36, fontFamily: 'Helvetica', align: 'center', color: '#000000', label: 'Participant Name' },
  QR_CODE: { x: 692, y: 440, fontSize: 80, fontFamily: 'Helvetica', align: 'left', color: '#000000', label: 'QR Code Verification' }
};

const CertificateManager = ({ eventId, eventStatus }) => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  if (!isAdmin) return null;

  const [templateFile, setTemplateFile] = useState(null);
  const [templateUrl, setTemplateUrl] = useState(null);
  const [config, setConfig] = useState(defaultFields);
  const [certTypeMode, setCertTypeMode] = useState('participant');
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState(null);
  
  // Visual Editor State
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [activeField, setActiveField] = useState(null);
  const [draggingField, setDraggingField] = useState(null);
  const [dragStart, setDragStart] = useState({ clickOffsetX: 0, clickOffsetY: 0 });

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

  const isPdf = templateUrl ? templateUrl.split('?')[0].toLowerCase().endsWith('.pdf') : false;

  const recalculateScale = () => {
    if (canvasRef.current) {
      const clientWidth = canvasRef.current.clientWidth;
      if (clientWidth > 0) {
        if (isPdf) {
          setScale(842 / clientWidth);
        } else if (imgRef.current && imgRef.current.naturalWidth > 0) {
          setScale(imgRef.current.naturalWidth / clientWidth);
        } else {
          setScale(842 / clientWidth);
        }
      }
    }
  };

  useEffect(() => {
    recalculateScale();
    const handleResize = () => recalculateScale();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [templateUrl, isPdf]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`/api/certificates/config/${eventId}`);
        if (res.data.template) {
          setTemplateUrl(res.data.template);
        }
        const merged = { ...defaultFields };
        if (res.data.config && typeof res.data.config === 'object') {
          for (let key in defaultFields) {
            if (res.data.config[key]) {
              merged[key] = {
                ...defaultFields[key],
                ...res.data.config[key]
              };
            }
          }
        }
        setConfig(merged);
      } catch (err) {
        console.error("Failed to fetch certificate config", err);
      }
    };
    if (eventId) fetchConfig();
  }, [eventId]);

  const handleResetLayout = () => {
    setConfig(defaultFields);
    setFeedback({ type: 'success', message: 'Layout reset to default placeholder positions.' });
  };

  // Drag Handlers
  const handleMouseDown = (e, key) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveField(key);
    setDraggingField(key);

    const elem = document.getElementById(`placeholder-${key}`);
    const elemRect = elem ? elem.getBoundingClientRect() : { left: e.clientX, top: e.clientY };

    setDragStart({
      clickOffsetX: e.clientX - elemRect.left,
      clickOffsetY: e.clientY - elemRect.top
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingField || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const currentScale = scale > 0 ? scale : 1;

      const mouseCanvasX = e.clientX - canvasRect.left;
      const mouseCanvasY = e.clientY - canvasRect.top;

      const targetScreenX = mouseCanvasX - (dragStart.clickOffsetX || 0);
      const targetScreenY = mouseCanvasY - (dragStart.clickOffsetY || 0);

      const field = config[draggingField];
      const align = field?.align || 'left';

      const naturalWidth = isPdf ? 842 : (imgRef.current?.naturalWidth || 842);
      const naturalHeight = isPdf ? 595 : (imgRef.current?.naturalHeight || 595);

      let naturalX = Math.round(targetScreenX * currentScale);
      let naturalY = Math.round(targetScreenY * currentScale);

      const elem = document.getElementById(`placeholder-${draggingField}`);
      if (elem && align === 'center') {
        const screenWidth = elem.getBoundingClientRect().width;
        naturalX = Math.round((targetScreenX + (screenWidth / 2)) * currentScale);
      } else if (elem && align === 'right') {
        const screenWidth = elem.getBoundingClientRect().width;
        naturalX = Math.round((targetScreenX + screenWidth) * currentScale);
      }

      naturalX = Math.max(0, Math.min(naturalWidth, naturalX));
      naturalY = Math.max(0, Math.min(naturalHeight, naturalY));

      setConfig(prev => ({
        ...prev,
        [draggingField]: {
          ...prev[draggingField],
          x: naturalX,
          y: naturalY
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
  }, [draggingField, dragStart, scale, isPdf, config]);

  const handleImageLoad = () => {
    recalculateScale();
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

  const handleGenerateAllOrganizer = async () => {
    setGenerating(true);
    setFeedback(null);
    try {
      const res = await axios.post(`/api/certificates/generate-organizers/${eventId}/all`);
      setFeedback({ type: 'success', message: res.data.message });
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Error generating organizer certificates' });
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
        <h3 className="font-medium text-text-primary mb-2">1. Upload Template File</h3>
        <p className="text-xs text-text-secondary mb-4">Provide a high-quality blank certificate template (PNG, JPG, or PDF recommended).</p>
        <div className="flex gap-2">
          <input 
            type="file" 
            accept=".png,.jpg,.jpeg,.pdf"
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-medium text-text-primary">2. Visual Designer</h3>
              <p className="text-xs text-slate-500">Drag placeholders directly on the template canvas to position them. Click a placeholder to customize styling.</p>
            </div>
            <button
              onClick={handleResetLayout}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset to Default Layout
            </button>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Editor Canvas */}
            <div className="flex-1 bg-slate-200/80 rounded-xl border border-slate-300 relative group min-h-[300px]">
              <div 
                ref={canvasRef}
                className="relative shadow-sm w-full select-none"
                style={{ cursor: draggingField ? 'grabbing' : 'auto' }}
              >
                {isPdf ? (
                  <div className="w-full aspect-[842/595] bg-white border border-slate-300 rounded-lg relative overflow-hidden flex flex-col items-center justify-center select-none shadow-inner">
                    <object 
                      data={`${getFullImageUrl(templateUrl)}#toolbar=0&navpanes=0&scrollbar=0`} 
                      type="application/pdf" 
                      className="w-full h-full pointer-events-none absolute inset-0 z-0"
                    >
                      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-100 text-slate-600">
                        <svg className="w-12 h-12 mb-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="font-bold text-sm">PDF Template Active</span>
                        <span className="text-xs text-slate-400 mt-1">A4 Landscape Canvas (842 x 595 pt)</span>
                      </div>
                    </object>
                    <div className="absolute top-3 left-3 z-10 bg-indigo-600/90 text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-md backdrop-blur-sm flex items-center gap-1.5 pointer-events-none">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 00-2-2V5a2 2 0 002-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 00-2 2z" />
                      </svg>
                      PDF Template Active
                    </div>
                  </div>
                ) : (
                  <img 
                    ref={imgRef}
                    src={getFullImageUrl(templateUrl)} 
                    onLoad={handleImageLoad} 
                    className="w-full h-auto pointer-events-none block min-h-[200px]" 
                    alt="Certificate Template"
                    draggable={false}
                  />
                )}
                
                {Object.entries(config).map(([key, field]) => {
                  if (!field) return null;
                  const safeScale = (scale && !isNaN(scale) && isFinite(scale) && scale > 0) ? scale : 1;
                  const screenX = Number(field.x || 0) / safeScale;
                  const screenY = Number(field.y || 0) / safeScale;
                  const screenFontSize = Math.max(10, (Number(field.fontSize) || 14) / safeScale);
                  
                  let transform = '';
                  if (field.align === 'center') transform = 'translateX(-50%)';
                  else if (field.align === 'right') transform = 'translateX(-100%)';
                  
                  if (key === 'QR_CODE') {
                    const qrBoxSize = Math.max(32, (Number(field.fontSize) || 80) / safeScale);
                    return (
                      <div 
                        id={`placeholder-${key}`}
                        key={key}
                        onMouseDown={(e) => handleMouseDown(e, key)}
                        className={`absolute cursor-grab flex flex-col items-center justify-center border-2 transition-all shadow-md rounded select-none ${
                          activeField === key 
                            ? 'border-indigo-600 bg-indigo-500/30 ring-4 ring-indigo-500/30 shadow-xl z-30' 
                            : 'border-slate-800 bg-white/95 hover:border-indigo-500 z-20'
                        }`}
                        style={{
                          left: `${screenX}px`,
                          top: `${screenY}px`,
                          width: `${qrBoxSize}px`,
                          height: `${qrBoxSize}px`,
                          transform
                        }}
                      >
                        <svg className="w-1/2 h-1/2 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        <span className="text-[9px] font-mono font-bold text-slate-800 mt-0.5">QR CODE</span>
                      </div>
                    );
                  }

                  return (
                    <div 
                      id={`placeholder-${key}`}
                      key={key}
                      onMouseDown={(e) => handleMouseDown(e, key)}
                      className={`absolute px-2.5 py-1 cursor-grab transition-all rounded shadow-sm select-none ${
                        activeField === key 
                          ? 'border-2 border-indigo-600 bg-indigo-500/30 ring-4 ring-indigo-500/30 shadow-xl z-30 font-bold text-indigo-950' 
                          : 'border-2 border-indigo-500/80 bg-white/90 hover:border-indigo-600 text-slate-900 z-20 hover:bg-white'
                      }`}
                      style={{
                        left: `${screenX}px`,
                        top: `${screenY}px`,
                        transform,
                        color: field.color || '#000000',
                        fontFamily: field.fontFamily || 'Helvetica',
                        fontSize: `${screenFontSize}px`,
                        lineHeight: 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {'{'}{field.label || key}{'}'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Properties & Selector Panel */}
            <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
              
              {/* Available Placeholders Quick Selector */}
              <div className="glass-panel border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 pb-1 border-b border-slate-200 flex items-center justify-between">
                  <span>Template Placeholders</span>
                  <span className="text-[10px] font-normal text-slate-400">Click to select</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(config).map(([key, field]) => (
                    <button
                      key={key}
                      onClick={() => setActiveField(key)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        activeField === key
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      {field.label || key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Placeholder Styling Box */}
              <div className="glass-panel border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-200 pb-2">Placeholder Styling</h4>
                
                {!activeField || !config[activeField] ? (
                  <p className="text-xs text-slate-500 italic text-center py-6">Click on a placeholder in the canvas or list above to edit its position and styles.</p>
                ) : (
                  <div className="space-y-4 animate-fade-in-up">
                    <div>
                      <p className="text-xs font-bold text-indigo-600 mb-1">{config[activeField].label}</p>
                      <p className="text-[10px] text-slate-400 mb-2">Drag on canvas or type exact coordinates below:</p>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">X Position (px)</label>
                          <input 
                            type="number" 
                            min="0"
                            value={config[activeField].x ?? 0}
                            onChange={(e) => updateFieldProperty(activeField, 'x', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Y Position (px)</label>
                          <input 
                            type="number" 
                            min="0"
                            value={config[activeField].y ?? 0}
                            onChange={(e) => updateFieldProperty(activeField, 'y', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                          />
                        </div>
                      </div>
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
                        value={config[activeField].fontFamily || 'Helvetica'}
                        onChange={(e) => updateFieldProperty(activeField, 'fontFamily', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                      >
                        <option value="Helvetica">Helvetica (Sans-Serif)</option>
                        <option value="Times New Roman">Times New Roman (Serif)</option>
                        <option value="Courier">Courier (Monospace)</option>
                      </select>
                    </div>

                    {activeField !== 'QR_CODE' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Text Color</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={config[activeField].color || '#000000'}
                            onChange={(e) => updateFieldProperty(activeField, 'color', e.target.value)}
                            className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                          />
                          <span className="text-xs text-slate-600 font-mono uppercase">{config[activeField].color || '#000000'}</span>
                        </div>
                      </div>
                    )}

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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-medium text-emerald-500">3. Issue Certificates</h3>
              <p className="text-xs text-text-secondary">Select certificate generation flow below.</p>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setCertTypeMode('participant')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  certTypeMode === 'participant' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Participant Certificates
              </button>
              <button
                type="button"
                onClick={() => setCertTypeMode('organizer')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  certTypeMode === 'organizer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Organizer Certificates
              </button>
            </div>
          </div>

          {certTypeMode === 'participant' ? (
            <div>
              <p className="text-xs text-text-secondary mb-4">
                Generates certificates for all eligible participating students marked <strong>Present</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleGenerateTest}
                  disabled={generating}
                  className="px-6 py-2.5 bg-white border border-emerald-500 text-emerald-600 text-sm font-bold rounded-xl shadow-sm hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  Generate Test (Preview)
                </button>
                <button 
                  onClick={handleGenerateAll}
                  disabled={generating}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate Participant Certificates (Bulk)'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-text-secondary mb-4">
                Generates certificates for all registered <strong>Event Organizers</strong> associated with this event.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleGenerateTest}
                  disabled={generating}
                  className="px-6 py-2.5 bg-white border border-indigo-500 text-indigo-600 text-sm font-bold rounded-xl shadow-sm hover:bg-indigo-50 transition-colors disabled:opacity-50"
                >
                  Generate Test (Preview)
                </button>
                <button 
                  onClick={handleGenerateAllOrganizer}
                  disabled={generating}
                  className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate Organizer Certificates (Bulk)'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CertificateManager;
