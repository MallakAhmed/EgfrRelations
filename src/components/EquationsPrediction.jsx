import React, { useState, useMemo } from 'react';
import TrendCharts from './TrendCharts.jsx';
import { ML_TABLE_PREVIEW_ROWS, ML_EQUATION_KEYS, ML_EQUATION_LABELS } from './mlUploadShared.js';

const ML_BASE = import.meta.env.DEV ? '/ml' : 'http://127.0.0.1:8000';

async function parseMlError(res) {
  try {
    const j = await res.json();
    const d = j.detail;
    if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join('; ');
    if (d != null) return String(d);
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`;
}

function EquationsPrediction() {
  const [data, setData] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [columns, setColumns] = useState([]);

  const handleFile = async (e) => {
    const input = e.target;
    setLoading(true);
    setError('');
    const file = input.files?.[0];
    if (!file) {
      setLoading(false);
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${ML_BASE}/predict_equations`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        setError(await parseMlError(res));
        return;
      }
      const json = await res.json();
      setData(json);
      setColumns(json.length > 0 ? Object.keys(json[0]) : []);
      setSelectedIdx(0);
    } catch (err) {
      setError(
        err?.message?.includes('Failed to fetch')
          ? 'ML server unreachable. Run: npm run dev:ml (or npm run dev:full) and ensure Python deps are installed (backend/requirements.txt).'
          : (err?.message || 'Failed to fetch predictions.'),
      );
    } finally {
      setLoading(false);
      input.value = '';
    }
  };

  const selected = data[selectedIdx] || {};
  const previewRows = useMemo(
    () => data.slice(0, ML_TABLE_PREVIEW_ROWS),
    [data],
  );

  return (
    <div className="p-6 text-slate-100 min-w-0">
      <h2 className="text-xl font-bold mb-2 text-white">6 Equations Prediction</h2>
      <p className="text-xs text-slate-400 mb-4 max-w-2xl">
        Upload a CSV (e.g. telt validation set). Each row gets six eGFR equation outputs; trend charts use the mapped age, gender, and creatinine for that row.
      </p>
      <input type="file" accept=".csv" onChange={handleFile} className="mb-4 text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-cyan-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
      {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}
      {loading && <div className="text-cyan-300 text-sm mb-3">Loading and computing equations…</div>}

      {data.length > 0 && (
        <>
          <div className="rounded-xl border border-cyan-500/20 bg-slate-900/40 p-4 mb-6">
            <h3 className="text-sm font-semibold text-cyan-200 mb-3">Selected row — equation outputs</h3>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <label className="text-xs text-slate-400 flex items-center gap-2">
                Row index (1–{data.length})
                <input
                  type="number"
                  min={1}
                  max={data.length}
                  value={selectedIdx + 1}
                  onChange={(ev) => {
                    const n = parseInt(ev.target.value, 10);
                    if (!Number.isFinite(n)) return;
                    setSelectedIdx(Math.max(0, Math.min(data.length - 1, n - 1)));
                  }}
                  className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {ML_EQUATION_KEYS.map((key) => (
                <div key={key} className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2">
                  <span className="text-slate-500 text-[11px] block">{ML_EQUATION_LABELS[key] || key}</span>
                  <span className="text-cyan-300 font-mono font-semibold">
                    {selected[key] != null && selected[key] !== ''
                      ? Number(selected[key]).toFixed(2)
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Charts: six curves vs age and vs creatinine for this row (creatinine defaults to 1.0 mg/dL if not in CSV).
            </p>
          </div>

          <div className="mb-8">
            <TrendCharts patientData={selected} theme="dark" />
          </div>

          <div className="rounded-xl border border-slate-600/30 overflow-hidden">
            <div className="px-3 py-2 bg-slate-800/60 text-xs text-slate-400">
              Preview: first <strong className="text-slate-200">{previewRows.length}</strong> of{' '}
              <strong className="text-slate-200">{data.length}</strong> rows. Click a row or use row index.
            </div>
            <div className="max-h-[min(420px,50vh)] overflow-auto">
              <table className="min-w-full border border-slate-700/50 text-xs text-slate-200">
                <thead className="sticky top-0 z-10 bg-slate-800 shadow-sm">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="border border-slate-700 px-2 py-1 text-left font-semibold text-slate-300 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        idx === selectedIdx
                          ? 'bg-cyan-900/50 cursor-pointer'
                          : 'hover:bg-slate-800/80 cursor-pointer'
                      }
                      onClick={() => setSelectedIdx(idx)}
                    >
                      {columns.map((col) => (
                        <td key={col} className="border border-slate-700/60 px-2 py-1 whitespace-nowrap">
                          {row[col] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length > ML_TABLE_PREVIEW_ROWS && (
              <p className="text-[11px] text-amber-200/90 px-3 py-2 bg-amber-950/30">
                Rows beyond {ML_TABLE_PREVIEW_ROWS} are not listed — use the row index field to select them.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default EquationsPrediction;
