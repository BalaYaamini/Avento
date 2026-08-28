import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

const ImportScoresModal = ({ isOpen, onClose, eventId, rounds, teams, scores, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [failedRecords, setFailedRecords] = useState([]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  const subroundMeta = useMemo(() => {
    const meta = [];
    const nameCount = {};
    (rounds || []).forEach(round => {
      (round.subrounds || []).forEach(sub => {
        const baseName = sub.name || 'Criteria';
        nameCount[baseName] = (nameCount[baseName] || 0) + 1;
        meta.push({
          subroundId: sub.id,
          subroundName: baseName,
          roundName: round.name,
          maxScore: Number(sub.max_score),
          displayName: nameCount[baseName] > 1 ? `${round.name} - ${baseName}` : baseName
        });
      });
    });
    return meta;
  }, [rounds]);

  const teamMap = useMemo(() => {
    const map = {};
    (teams || []).forEach(t => { map[t.name.toLowerCase().trim()] = t.id; });
    return map;
  }, [teams]);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    const headers = ['Team Name', ...subroundMeta.map(s => s.displayName)];
    const rows = (teams || []).map(team => {
      const row = { 'Team Name': team.name };
      subroundMeta.forEach(s => { row[s.displayName] = ''; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const colWidths = headers.map((h, i) => ({ wch: i === 0 ? Math.max(20, teamMap.length > 0 ? 20 : 15) : Math.max(h.length + 2, 14) }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scores');
    XLSX.writeFile(wb, 'Avento_Scores_Import_Template.xlsx');
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
    setMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet);
        validateData(json);
      } catch (err) {
        setStatus('error');
        setMessage('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateData = (rows) => {
    setStatus('validating');

    if (!rows || rows.length === 0) {
      setStatus('error');
      setMessage('File is empty or has no data rows.');
      return;
    }

    const allColumns = Object.keys(rows[0] || {});
    const teamCol = allColumns.find(c => c.toLowerCase().trim() === 'team name')
      || allColumns.find(c => c.toLowerCase().trim() === 'team')
      || allColumns.find(c => c.toLowerCase().includes('team'))
      || allColumns[0];
    const scoreColumns = allColumns.filter(c => c !== teamCol);

    const valid = [];
    const failed = [];

    const matchedSubrounds = [];
    scoreColumns.forEach(col => {
      const trimmed = col.trim().toLowerCase();
      const match = subroundMeta.find(s =>
        s.displayName.toLowerCase() === trimmed ||
        s.subroundName.toLowerCase() === trimmed
      );
      if (match) {
        matchedSubrounds.push({ ...match, excelColumn: col });
      }
    });

    if (matchedSubrounds.length === 0) {
      setStatus('error');
      setMessage('No matching scoring criteria found. Download the template to see the correct column headers.');
      return;
    }

    const unmatchedColumns = scoreColumns.filter(c => !matchedSubrounds.find(m => m.excelColumn === c));

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      const teamName = String(row[teamCol] || '').trim();
      let teamId = teamMap[teamName.toLowerCase()];
      if (!teamId) {
        const partial = teams.find(t => t.name.toLowerCase().includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(t.name.toLowerCase()));
        if (partial) teamId = partial.id;
      }

      if (!teamId) {
        failed.push({ rowNum, teamName, reason: `Team "${teamName}" not found in this event`, scores: {} });
        return;
      }

      const scores = {};
      let hasError = false;
      let errorMsg = '';

      matchedSubrounds.forEach(sub => {
        const rawVal = row[sub.excelColumn];
        if (rawVal === '' || rawVal === null || rawVal === undefined) return;

        const num = Number(rawVal);
        if (!Number.isFinite(num) || num < 0) {
          hasError = true;
          errorMsg = `Invalid score "${rawVal}" for ${sub.subroundName}`;
          return;
        }
        if (num > sub.maxScore) {
          hasError = true;
          errorMsg = `Score ${num} exceeds max ${sub.maxScore} for ${sub.subroundName}`;
          return;
        }
        scores[sub.subroundId] = num;
      });

      if (hasError) {
        failed.push({ rowNum, teamName, reason: errorMsg, scores });
      } else if (Object.keys(scores).length > 0) {
        valid.push({ rowNum, teamName, teamId, scores });
      }
    });

    setPreviewData(valid);
    setFailedRecords(failed);

    if (unmatchedColumns.length > 0) {
      setMessage(`Skipped columns (no matching criteria): ${unmatchedColumns.join(', ')}. ${valid.length} valid rows, ${failed.length} errors.`);
    } else {
      setMessage(valid.length > 0 ? `${valid.length} valid rows, ${failed.length} errors.` : 'No valid rows found.');
    }

    setStatus(valid.length > 0 ? 'idle' : 'error');
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;
    setStatus('importing');
    setMessage('');

    const allScores = [];
    previewData.forEach(row => {
      Object.entries(row.scores).forEach(([subroundId, score]) => {
        allScores.push({ teamId: row.teamId, subroundId, score });
      });
    });

    try {
      const res = await axios.put(`/api/events/${eventId}/scoring/bulk`, { scores: allScores });
      setStatus('success');
      const serverErrors = res.data.errors || [];
      const allFailed = [...failedRecords, ...serverErrors.map(e => ({ rowNum: '-', teamName: e.teamId, reason: e.error }))];
      setFailedRecords(allFailed);
      setSummary({
        total: allScores.length,
        saved: res.data.saved || 0,
        failed: allFailed.length
      });
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Failed to import scores.');
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[90vw] lg:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Import Scores from Excel</h2>
            <p className="text-xs text-slate-500 mt-1">{subroundMeta.length} scoring criteria across {rounds.length} round(s) for {teams.length} team(s)</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-red-500 transition-colors p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6">

          {status !== 'success' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-slate-800 mb-1">Download Template</h3>
                <p className="text-xs text-slate-600">Excel with your team names as rows and scoring criteria as columns. Fill in the scores and re-upload.</p>
              </div>
              <button onClick={downloadTemplate} className="whitespace-nowrap px-4 py-2 text-xs font-bold rounded-xl border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition-colors">
                Get Template (.xlsx)
              </button>
            </div>
          )}

          {status !== 'success' && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Upload Filled Scores File</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 transition-all cursor-pointer border-2 border-dashed border-violet-200 rounded-2xl p-2"
              />
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 bg-red-50 border-2 border-red-200 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
              <span>{message}</span>
            </div>
          )}

          {status === 'idle' && message && (
            <div className="p-4 bg-violet-50 border-2 border-violet-200 text-slate-700 rounded-2xl text-sm font-bold flex items-center gap-2">
              <span>{message}</span>
            </div>
          )}

          {status === 'success' && summary && (
            <div className="p-6 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 rounded-3xl text-sm font-bold flex flex-col gap-4">
              <div className="flex items-center gap-2 text-lg"><span>✓</span><span>Import Complete</span></div>
              <div className="grid grid-cols-3 gap-3 text-center bg-white rounded-2xl p-4 shadow-sm border border-emerald-100">
                <div><div className="text-2xl font-black text-slate-600">{summary.total}</div><div className="text-[10px] font-bold uppercase text-slate-400 mt-1">Total Scores</div></div>
                <div><div className="text-2xl font-black text-emerald-600">{summary.saved}</div><div className="text-[10px] font-bold uppercase text-slate-400 mt-1">Saved</div></div>
                <div><div className="text-2xl font-black text-red-500">{summary.failed}</div><div className="text-[10px] font-bold uppercase text-slate-400 mt-1">Failed</div></div>
              </div>
            </div>
          )}

          {status === 'success' && failedRecords.length > 0 && (
            <div className="border border-red-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-red-50 sticky top-0"><tr className="border-b border-red-200">
                  <th className="px-4 py-2 font-bold text-red-600">Row</th>
                  <th className="px-4 py-2 font-bold text-red-600">Team</th>
                  <th className="px-4 py-2 font-bold text-red-600">Reason</th>
                </tr></thead>
                <tbody className="divide-y divide-red-100">
                  {failedRecords.map((r, i) => (
                    <tr key={i} className="hover:bg-red-50/50"><td className="px-4 py-2 font-mono">{r.rowNum}</td><td className="px-4 py-2">{r.teamName}</td><td className="px-4 py-2 text-red-500">{r.reason}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewData.length > 0 && status !== 'success' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Preview ({previewData.length} rows, {previewData.reduce((sum, r) => sum + Object.keys(r.scores).length, 0)} scores)</label>
                {status !== 'importing' && <button onClick={resetState} className="text-xs text-red-500 hover:underline font-bold">Clear</button>}
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 font-bold text-slate-600">Row</th>
                      <th className="px-3 py-2 font-bold text-slate-600">Team</th>
                      {subroundMeta.map(s => (
                        <th key={s.subroundId} className="px-3 py-2 font-bold text-slate-600 text-center">
                          <span className="block">{s.displayName}</span>
                          <span className="text-[9px] text-slate-400 font-normal">/{s.maxScore}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.slice(0, 15).map((row, i) => (
                      <tr key={i} className="hover:bg-violet-50/30">
                        <td className="px-3 py-2 font-mono text-slate-500">{row.rowNum}</td>
                        <td className="px-3 py-2 font-bold text-slate-700">{row.teamName}</td>
                        {subroundMeta.map(s => (
                          <td key={s.subroundId} className="px-3 py-2 text-center text-slate-700">
                            {row.scores[s.subroundId] !== undefined ? row.scores[s.subroundId] : <span className="text-slate-300">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {previewData.length > 15 && (
                      <tr><td colSpan={2 + subroundMeta.length} className="px-3 py-2 text-center text-slate-400 italic bg-slate-50/50">...and {previewData.length - 15} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          {status === 'success' ? (
            <>
              <button onClick={resetState} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 border-2 border-slate-200 hover:bg-slate-100 transition-colors">Import More</button>
              <button onClick={handleClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-lg transition-colors">Done</button>
            </>
          ) : (
            <>
              <button onClick={handleClose} disabled={status === 'importing'} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50">Cancel</button>
              <button
                onClick={handleImport}
                disabled={status === 'importing' || status === 'error' || previewData.length === 0}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {status === 'importing' ? (
                  <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Importing...</>
                ) : (
                  `Import ${previewData.reduce((sum, r) => sum + Object.keys(r.scores).length, 0)} Scores`
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default ImportScoresModal;
