import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, ReferenceLine, ComposedChart, Area,
} from 'recharts';
import {
  calculateEGFR, egfrCkdEpi2009, egfrMdrd4,
  egfrEq1, egfrEq2, egfrEq3, egfrEq4,
} from '../utils/egfrCalculation.js';

/* ── equation definitions (shared) ─────────────────── */
const equationDefs = [
  { key: 'ckd-epi-2021', label: 'CKD-EPI 2021',    color: '#06b6d4',
    fn: (p) => calculateEGFR({ ...p, map: 88, potassium: 4.2, urineOutput: 1600, weight: 70 }) },
  { key: 'ckd-epi-2009', label: 'CKD-EPI 2009',    color: '#818cf8',
    fn: (p) => egfrCkdEpi2009({ ...p, isBlack: false }) },
  { key: 'mdrd-4',       label: 'MDRD 4-variable',  color: '#f59e42',
    fn: (p) => egfrMdrd4({ ...p, isBlack: false }) },
  { key: 'jpn-eq1',      label: 'Japanese Eq1',     color: '#22c55e',
    fn: (p) => egfrEq1(p.creatinine, p.age, p.gender === 'female') },
  { key: 'jpn-eq2',      label: 'Japanese Eq2',     color: '#e11d48',
    fn: (p) => egfrEq2(p.creatinine, p.age, p.gender === 'female') },
  { key: 'jpn-eq3',      label: 'Japanese Eq3',     color: '#fbbf24',
    fn: (p) => egfrEq3(p.creatinine, p.age, p.gender === 'female') },
];

const COLOR_180 = '#06b6d4';
const COLOR_360 = '#f59e42';

/* ── theme helpers ─────────────────────────────────── */
function themeVars(isDark) {
  return {
    titleCls:   isDark ? 'text-slate-200' : 'text-slate-700',
    boxCls:     isDark
      ? 'bg-slate-900/50 border border-slate-600/50 rounded shadow-inner'
      : 'bg-slate-50 rounded shadow-inner',
    axisTick:   isDark ? { fill: '#94a3b8', fontSize: 11 } : { fontSize: 11 },
    gridStroke: isDark ? 'rgba(148,163,184,0.15)' : undefined,
    ttStyle:    isDark ? { background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' } : undefined,
    legStyle:   isDark ? { color: '#cbd5e1' } : undefined,
  };
}

/* ── batch fetch helper ─────────────────────────────── */
function buildRow(pd, egfr) {
  return {
    gender:              pd.gender === 'female' ? 1.0 : 0.0,
    age:                 pd.age,
    dm_episode:          pd.dmiEpisode ?? pd.diabetes ?? 0,
    hypertension_status: pd.hypertension ?? 0,
    egfr,
    bmi:                 pd.bmi,
    hemoglobin:          pd.hemoglobin,
  };
}

async function fetchBatch(rows, signal) {
  const res = await fetch('/ml/predict_future_egfr_batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
    signal,
  });
  if (!res.ok) throw new Error('batch failed');
  return res.json();
}

/* ════════════════════════════════════════════════════
   1. CURRENT EGFR CHARTS  (default export)
      — eGFR vs Age  |  eGFR vs Creatinine
   ════════════════════════════════════════════════════ */
export default function TrendCharts({ patientData, theme = 'light' }) {
  const isDark = theme === 'dark';
  const { titleCls, boxCls, axisTick, gridStroke, ttStyle, legStyle } = themeVars(isDark);

  const catboostPred    = patientData?.egfr_pred != null ? Number(patientData.egfr_pred) : null;
  const showCatboostRef = catboostPred != null && Number.isFinite(catboostPred);
  const creatinine      = patientData?.creatinine ?? 1.0;
  const gender          = patientData?.gender     ?? 'male';
  const age             = patientData?.age        ?? 45;

  const ageSeries = useMemo(() => {
    const pts = [];
    for (let a = 18; a <= 90; a += 2) {
      const row = { age: a };
      equationDefs.forEach(eq => { row[eq.key] = eq.fn({ age: a, gender, creatinine }); });
      pts.push(row);
    }
    return pts;
  }, [creatinine, gender]);

  const crSeries = useMemo(() => {
    const pts = [];
    for (let cr = 0.4; cr <= 6.0; cr = parseFloat((cr + 0.1).toFixed(2))) {
      const row = { creatinine: cr };
      equationDefs.forEach(eq => { row[eq.key] = eq.fn({ age, gender, creatinine: cr }); });
      pts.push(row);
    }
    return pts;
  }, [age, gender]);

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      {/* eGFR vs Age */}
      <div className="min-w-0">
        <h3 className={`text-base font-semibold mb-2 ${titleCls}`}>eGFR vs. Age</h3>
        <div style={{ height: 280 }} className={`flex items-center justify-center min-w-0 ${boxCls}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={200}>
            <LineChart data={ageSeries} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="age" tick={axisTick}
                label={{ value: 'Age (years)', position: 'insideBottom', offset: -4, fill: isDark ? '#94a3b8' : undefined }} />
              <YAxis tick={axisTick}
                label={{ value: 'eGFR', angle: -90, position: 'insideLeft', offset: 8, fill: isDark ? '#94a3b8' : undefined }} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={legStyle} verticalAlign="top" height={36} />
              {equationDefs.map(eq => (
                <Line key={eq.key} type="monotone" dataKey={eq.key} stroke={eq.color}
                  dot={false} strokeWidth={2} name={eq.label} />
              ))}
              {showCatboostRef && (
                <ReferenceLine y={catboostPred} stroke="#a855f7" strokeDasharray="6 4"
                  label={{ value: 'CatBoost', fill: '#7c3aed', fontSize: 11 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* eGFR vs Creatinine */}
      <div className="min-w-0">
        <h3 className={`text-base font-semibold mb-2 ${titleCls}`}>eGFR vs. Creatinine</h3>
        <div style={{ height: 280 }} className={`flex items-center justify-center min-w-0 ${boxCls}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={200}>
            <LineChart data={crSeries} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="creatinine" tick={axisTick}
                label={{ value: 'Creatinine (mg/dL)', position: 'insideBottom', offset: -4, fill: isDark ? '#94a3b8' : undefined }} />
              <YAxis tick={axisTick}
                label={{ value: 'eGFR', angle: -90, position: 'insideLeft', offset: 8, fill: isDark ? '#94a3b8' : undefined }} />
              <Tooltip contentStyle={ttStyle} />
              <Legend wrapperStyle={legStyle} verticalAlign="top" height={36} />
              {equationDefs.map(eq => (
                <Line key={eq.key} type="monotone" dataKey={eq.key} stroke={eq.color}
                  dot={false} strokeWidth={2} name={eq.label} />
              ))}
              {showCatboostRef && (
                <ReferenceLine y={catboostPred} stroke="#a855f7" strokeDasharray="6 4"
                  label={{ value: 'CatBoost', fill: '#7c3aed', fontSize: 11 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   2. FUTURE EGFR CHARTS  (named export)
      — Future eGFR vs Age  |  Future eGFR vs Creatinine
      Exact same visual style as TrendCharts above.
   ════════════════════════════════════════════════════ */
export function FutureTrendCharts({ patientData, theme = 'light' }) {
  const isDark = theme === 'dark';
  const { titleCls, boxCls, axisTick, gridStroke, ttStyle, legStyle } = themeVars(isDark);

  const gender     = patientData?.gender     ?? 'male';
  const creatinine = patientData?.creatinine ?? 1.0;
  const age        = patientData?.age        ?? 45;

  /* ── Future vs Age ──────────────────────────────── */
  const [ageSeries, setAgeSeries]   = useState(null);
  const [ageLoading, setAgeLoading] = useState(false);

  useEffect(() => {
    if (!patientData) return;
    const ctrl = new AbortController();
    setAgeLoading(true);

    const ages = [];
    for (let a = 18; a <= 90; a += 4) ages.push(a);

    const rows = ages.map(a => {
      const egfr = calculateEGFR({
        ...patientData, age: a, creatinine, gender,
        map: 88, potassium: 4.2, urineOutput: 1600, weight: patientData.weight ?? 70,
      });
      return buildRow(patientData, egfr);
    });

    fetchBatch(rows, ctrl.signal)
      .then(results => {
        setAgeSeries(results.map((r, i) => ({
          age:     ages[i],
          egfr180: r.egfr_180,
          egfr360: r.egfr_360,
        })));
        setAgeLoading(false);
      })
      .catch(() => setAgeLoading(false));

    return () => ctrl.abort();
  }, [creatinine, gender,
      patientData?.dmiEpisode, patientData?.hypertension,
      patientData?.bmi, patientData?.hemoglobin]);

  /* ── Future vs Creatinine ───────────────────────── */
  const [crSeries, setCrSeries]   = useState(null);
  const [crLoading, setCrLoading] = useState(false);

  useEffect(() => {
    if (!patientData) return;
    const ctrl = new AbortController();
    setCrLoading(true);

    const crs = [];
    for (let c = 0.4; c <= 6.0; c = parseFloat((c + 0.2).toFixed(2))) crs.push(c);

    const rows = crs.map(cr => {
      const egfr = calculateEGFR({
        ...patientData, creatinine: cr, age, gender,
        map: 88, potassium: 4.2, urineOutput: 1600, weight: patientData.weight ?? 70,
      });
      return buildRow(patientData, egfr);
    });

    fetchBatch(rows, ctrl.signal)
      .then(results => {
        setCrSeries(results.map((r, i) => ({
          creatinine: crs[i],
          egfr180:    r.egfr_180,
          egfr360:    r.egfr_360,
        })));
        setCrLoading(false);
      })
      .catch(() => setCrLoading(false));

    return () => ctrl.abort();
  }, [age, gender,
      patientData?.dmiEpisode, patientData?.hypertension,
      patientData?.bmi, patientData?.hemoglobin]);

  const futureLegend = [
    { value: '180-day eGFR', type: 'line', color: COLOR_180 },
    { value: '360-day eGFR', type: 'line', color: COLOR_360 },
  ];

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">

      {/* Future eGFR vs Age */}
      <div className="min-w-0">
        <h3 className={`text-base font-semibold mb-2 ${titleCls}`}>Future eGFR vs. Age</h3>
        <div style={{ height: 280 }} className={`flex items-center justify-center min-w-0 ${boxCls}`}>
          {ageLoading && (
            <p className={`text-sm ${isDark ? 'text-cyan-400/60' : 'text-cyan-600/60'} animate-pulse`}>
              Computing…
            </p>
          )}
          {!ageLoading && !ageSeries && (
            <p className="text-sm text-slate-400">Backend offline — start server to load</p>
          )}
          {!ageLoading && ageSeries && (
            <ResponsiveContainer width="100%" height="100%" minWidth={200}>
              <LineChart data={ageSeries} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="age" tick={axisTick}
                  label={{ value: 'Age (years)', position: 'insideBottom', offset: -4, fill: isDark ? '#94a3b8' : undefined }} />
                <YAxis tick={axisTick}
                  label={{ value: 'eGFR', angle: -90, position: 'insideLeft', offset: 8, fill: isDark ? '#94a3b8' : undefined }} />
                <Tooltip contentStyle={ttStyle} formatter={(v) => [v?.toFixed(1), '']} />
                <Legend wrapperStyle={legStyle} verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="egfr180" stroke={COLOR_180} dot={false}
                  strokeWidth={2} name="180-day eGFR" />
                <Line type="monotone" dataKey="egfr360" stroke={COLOR_360} dot={false}
                  strokeWidth={2} name="360-day eGFR" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Future eGFR vs Creatinine */}
      <div className="min-w-0">
        <h3 className={`text-base font-semibold mb-2 ${titleCls}`}>Future eGFR vs. Creatinine</h3>
        <div style={{ height: 280 }} className={`flex items-center justify-center min-w-0 ${boxCls}`}>
          {crLoading && (
            <p className={`text-sm ${isDark ? 'text-cyan-400/60' : 'text-cyan-600/60'} animate-pulse`}>
              Computing…
            </p>
          )}
          {!crLoading && !crSeries && (
            <p className="text-sm text-slate-400">Backend offline — start server to load</p>
          )}
          {!crLoading && crSeries && (
            <ResponsiveContainer width="100%" height="100%" minWidth={200}>
              <LineChart data={crSeries} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="creatinine" tick={axisTick}
                  label={{ value: 'Creatinine (mg/dL)', position: 'insideBottom', offset: -4, fill: isDark ? '#94a3b8' : undefined }} />
                <YAxis tick={axisTick}
                  label={{ value: 'eGFR', angle: -90, position: 'insideLeft', offset: 8, fill: isDark ? '#94a3b8' : undefined }} />
                <Tooltip contentStyle={ttStyle} formatter={(v) => [v?.toFixed(1), '']} />
                <Legend wrapperStyle={legStyle} verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="egfr180" stroke={COLOR_180} dot={false}
                  strokeWidth={2} name="180-day eGFR" />
                <Line type="monotone" dataKey="egfr360" stroke={COLOR_360} dot={false}
                  strokeWidth={2} name="360-day eGFR" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   3. CONFIDENCE INTERVAL CHART  (named export)
      — Trajectory: Now → 180d → 360d with 95% CI bands
   ════════════════════════════════════════════════════ */
export function CIChart({ futurePredictions, currentEgfr, theme = 'light' }) {
  const isDark = theme === 'dark';
  const { titleCls, boxCls, axisTick, gridStroke, ttStyle, legStyle } = themeVars(isDark);

  const {
    egfr180, egfr180Lower, egfr180Upper, sigma180,
    egfr360, egfr360Lower, egfr360Upper, sigma360,
    loading,
  } = futurePredictions ?? {};

  const EGFR_MAX = 120;
  const data = useMemo(() => {
    if (egfr180 == null || egfr360 == null) return null;
    const cap180Upper = Math.min(EGFR_MAX, egfr180Upper);
    const cap360Upper = Math.min(EGFR_MAX, egfr360Upper);
    return [
      { day: 0,   label: 'Now',  egfr: currentEgfr,  lower: currentEgfr, ci: 0 },
      { day: 180, label: '180d', egfr: egfr180,       lower: egfr180Lower, ci: cap180Upper - egfr180Lower },
      { day: 360, label: '360d', egfr: egfr360,       lower: egfr360Lower, ci: cap360Upper - egfr360Lower },
    ];
  }, [currentEgfr, egfr180, egfr180Lower, egfr180Upper, egfr360, egfr360Lower, egfr360Upper]);

  const statRows = [
    { horizon: '180 days', pred: egfr180, lower: egfr180Lower, upper: egfr180Upper != null ? Math.min(120, egfr180Upper) : null, sigma: sigma180, color: COLOR_180 },
    { horizon: '360 days', pred: egfr360, lower: egfr360Lower, upper: egfr360Upper != null ? Math.min(120, egfr360Upper) : null, sigma: sigma360, color: COLOR_360 },
  ];

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">

      {/* Trajectory chart */}
      <div className="min-w-0">
        <h3 className={`text-base font-semibold mb-2 ${titleCls}`}>
          eGFR Trajectory with 95% Confidence Interval
        </h3>
        <div style={{ height: 280 }} className={`flex items-center justify-center min-w-0 ${boxCls}`}>
          {loading && (
            <p className={`text-sm ${isDark ? 'text-cyan-400/60' : 'text-cyan-600/60'} animate-pulse`}>
              Computing…
            </p>
          )}
          {!loading && !data && (
            <p className="text-sm text-slate-400">Backend offline — start server to load</p>
          )}
          {!loading && data && (
            <ResponsiveContainer width="100%" height="100%" minWidth={200}>
              <ComposedChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="day" tick={axisTick}
                  tickFormatter={v => v === 0 ? 'Now' : `${v}d`}
                  label={{ value: 'Days from today', position: 'insideBottom', offset: -4, fill: isDark ? '#94a3b8' : undefined }} />
                <YAxis tick={axisTick} domain={[0, 120]}
                  label={{ value: 'eGFR', angle: -90, position: 'insideLeft', offset: 8, fill: isDark ? '#94a3b8' : undefined }} />
                <Tooltip contentStyle={ttStyle}
                  formatter={(v, name) => [typeof v === 'number' ? v.toFixed(1) : v, name]}
                  labelFormatter={l => l === 0 ? 'Now' : `Day ${l}`} />
                <Legend wrapperStyle={legStyle} verticalAlign="top" height={36} />
                {/* CI band: stack lower (transparent) + ci width (filled) */}
                <Area dataKey="lower" stackId="ci" stroke="none" fill="transparent" legendType="none" />
                <Area dataKey="ci"    stackId="ci" stroke="none" fill={COLOR_180} fillOpacity={0.2}
                  name="95% Confidence Interval" />
                {/* Prediction line */}
                <Line dataKey="egfr" stroke={COLOR_180} strokeWidth={2.5}
                  dot={{ fill: COLOR_180, r: 5, strokeWidth: 0 }}
                  name="Predicted eGFR" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* CI summary table */}
      <div className="min-w-0">
        <h3 className={`text-base font-semibold mb-2 ${titleCls}`}>Prediction Uncertainty Summary</h3>
        <div className={`rounded ${isDark ? 'bg-slate-900/50 border border-slate-600/50' : 'bg-slate-50 border border-slate-200'} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <th className="text-left px-4 py-2 font-medium">Horizon</th>
                <th className="text-right px-4 py-2 font-medium">Prediction</th>
                <th className="text-right px-4 py-2 font-medium">95% CI Lower</th>
                <th className="text-right px-4 py-2 font-medium">95% CI Upper</th>
                <th className="text-right px-4 py-2 font-medium">σ (mL/min)</th>
              </tr>
            </thead>
            <tbody>
              {statRows.map(row => (
                <tr key={row.horizon}
                  className={`border-b last:border-0 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className="px-4 py-2 font-semibold" style={{ color: row.color }}>{row.horizon}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {row.pred != null ? row.pred.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {row.lower != null ? row.lower.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {row.upper != null ? row.upper.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {row.sigma != null ? `±${row.sigma.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`px-4 py-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            σ = √(σ_ensemble² + σ_residual²) · ensemble spread from XGBoost / CatBoost / LightGBM base models
          </p>
        </div>
      </div>
    </div>
  );
}
