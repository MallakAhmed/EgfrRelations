import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposedChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Area, ReferenceArea, ReferenceLine, ReferenceDot, Cell,
} from 'recharts';
import {
  Network, Plus, Sparkles, Trash2, User, Stethoscope, GitBranch,
  Activity, Save, ChevronRight, RefreshCw, Layers,
} from 'lucide-react';
import {
  loadCaseLibrary,
  saveCaseLibrary,
  createCaseFromPatient,
  patientToFeatures,
  buildDemoCohort,
} from '../utils/caseLibrary.js';
import { getCKDStage } from '../utils/egfrCalculation.js';

const ML_BASE = import.meta.env.VITE_ML_API_URL || '/ml';
const CLUSTER_PALETTE = ['#22d3ee', '#a78bfa', '#fb923c', '#4ade80', '#f472b6', '#38bdf8'];

const FEATURE_LABELS = {
  age: 'Age', bmi: 'BMI', creatinine: 'Creatinine', egfr: 'eGFR',
  sex_female: 'Sex (female)', diabetes: 'Diabetes', hypertension: 'HTN',
  hdl: 'HDL', total_chol: 'Total chol.', hemoglobin: 'Hemoglobin',
  map: 'MAP', weight: 'Weight',
};

/* ══════════════════════════════════════════════════════
   FILTER DEFINITIONS + HELPERS
══════════════════════════════════════════════════════ */
const RANGE_DEFS = {
  total_chol: {
    label: 'Cholesterol',
    options: [
      { value: 'all',    label: 'All' },
      { value: 'low',    label: '<170 (Low)',         test: v => v < 170 },
      { value: 'normal', label: '170–200 (Normal)',   test: v => v >= 170 && v <= 200 },
      { value: 'high',   label: '>200 (High)',        test: v => v > 200 },
    ],
  },
  bmi: {
    label: 'BMI',
    options: [
      { value: 'all',    label: 'All' },
      { value: 'normal', label: '18.5–25 (Normal)',   test: v => v >= 18.5 && v <= 25 },
      { value: 'over',   label: '25–30 (Overweight)', test: v => v > 25 && v <= 30 },
      { value: 'obese',  label: '>30 (Obese)',        test: v => v > 30 },
    ],
  },
  hemoglobin: {
    label: 'Hemoglobin',
    options: [
      { value: 'all',    label: 'All' },
      { value: 'low',    label: '<12 g/dL (Anemic)',  test: v => v < 12 },
      { value: 'normal', label: '12–16 (Normal)',     test: v => v >= 12 && v <= 16 },
      { value: 'high',   label: '>16 g/dL (High)',    test: v => v > 16 },
    ],
  },
  creatinine: {
    label: 'Creatinine',
    options: [
      { value: 'all',    label: 'All' },
      { value: 'normal', label: '<1.2 (Normal)',      test: v => v < 1.2 },
      { value: 'mild',   label: '1.2–2.0 (Mild ↑)',  test: v => v >= 1.2 && v <= 2.0 },
      { value: 'high',   label: '>2.0 (High)',        test: v => v > 2.0 },
    ],
  },
};

const BLANK_BINARY = { diabetes: null, hypertension: null, sex: null };
const BLANK_RANGES = { total_chol: 'all', bmi: 'all', hemoglobin: 'all', creatinine: 'all' };
const BLANK_GROUP  = { diabetes: null, hypertension: null };

function applyFilters(cases, binary, ranges) {
  return cases.filter(c => {
    const f = c.features;
    if (binary.diabetes !== null && Boolean(f.diabetes) !== binary.diabetes) return false;
    if (binary.hypertension !== null && Boolean(f.hypertension) !== binary.hypertension) return false;
    if (binary.sex !== null) {
      const isFemale = Number(f.sex_female) === 1;
      if (binary.sex === 'female' && !isFemale) return false;
      if (binary.sex === 'male'   &&  isFemale) return false;
    }
    for (const [key, val] of Object.entries(ranges)) {
      if (val === 'all') continue;
      const opt = RANGE_DEFS[key]?.options.find(o => o.value === val);
      if (opt?.test && !opt.test(Number(f[key] ?? 0))) return false;
    }
    return true;
  });
}

function applyGroupFilter(cases, group) {
  return cases.filter(c => {
    const f = c.features;
    if (group.diabetes !== null && Boolean(f.diabetes) !== group.diabetes) return false;
    if (group.hypertension !== null && Boolean(f.hypertension) !== group.hypertension) return false;
    return true;
  });
}

/* ══════════════════════════════════════════════════════
   TRAJECTORY + COMPARE DATA BUILDERS
══════════════════════════════════════════════════════ */
function buildTrajectoryLines(cases) {
  return cases
    .filter(c => (c.progress || []).filter(p => p.date).length >= 2)
    .map(c => {
      const sorted = [...c.progress]
        .filter(p => p.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      const t0 = new Date(sorted[0].date);
      return {
        id: c.id,
        name: c.displayName,
        data: sorted.map(p => ({
          months: Math.round((new Date(p.date) - t0) / (1000 * 60 * 60 * 24 * 30.44)),
          egfr: Number(p.egfr),
        })),
      };
    });
}

function buildTrajectoryDataset(lines) {
  const allMonths = [...new Set(lines.flatMap(l => l.data.map(d => d.months)))].sort((a, b) => a - b);
  return allMonths.map(m => {
    const row = { months: m };
    lines.forEach(l => {
      const pt = l.data.find(d => d.months === m);
      row[l.id] = pt ? pt.egfr : undefined;
    });
    return row;
  });
}

function groupOffset(cases) {
  if (!cases.length) return 0;
  let total = 0;
  cases.forEach(c => {
    const ref = CKD_PCT_REF.reduce((b, r) =>
      Math.abs(r.age - c.features.age) < Math.abs(b.age - c.features.age) ? r : b);
    total += c.features.egfr - ref.p50;
  });
  return total / cases.length;
}

function buildCompareData(casesA, casesB) {
  const offA = groupOffset(casesA);
  const offB = groupOffset(casesB);

  return CKD_PCT_REF.map(ref => {
    const nearA = casesA.filter(c => Math.abs(c.features.age - ref.age) <= 12);
    const nearB = casesB.filter(c => Math.abs(c.features.age - ref.age) <= 12);

    let aLow, aP50, aHigh, bLow, bP50, bHigh;

    if (nearA.length >= 2) {
      const eg = nearA.map(c => c.features.egfr);
      aLow = pctile(eg, 25); aP50 = pctile(eg, 50); aHigh = pctile(eg, 75);
    } else {
      aLow  = Math.max(1,   ref.p25 + offA);
      aP50  = Math.max(1,   ref.p50 + offA);
      aHigh = Math.min(120, ref.p75 + offA);
    }

    if (nearB.length >= 2) {
      const eg = nearB.map(c => c.features.egfr);
      bLow = pctile(eg, 25); bP50 = pctile(eg, 50); bHigh = pctile(eg, 75);
    } else {
      bLow  = Math.max(1,   ref.p25 + offB);
      bP50  = Math.max(1,   ref.p50 + offB);
      bHigh = Math.min(120, ref.p75 + offB);
    }

    return {
      age: ref.age,
      base_a: aLow, band_a: Math.max(0, aHigh - aLow), p50_a: aP50,
      base_b: bLow, band_b: Math.max(0, bHigh - bLow), p50_b: bP50,
    };
  });
}

/* ══════════════════════════════════════════════════════
   SMALL UI SUB-COMPONENTS
══════════════════════════════════════════════════════ */
function TriToggle({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-400 mr-0.5 shrink-0">{label}</span>
      {[null, true, false].map(v => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
            value === v
              ? 'bg-cyan-600 border-cyan-500 text-white'
              : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
          }`}>
          {v === null ? 'All' : v ? 'Y' : 'N'}
        </button>
      ))}
    </div>
  );
}

function SexToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-400 mr-0.5 shrink-0">Sex</span>
      {[null, 'male', 'female'].map(v => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
            value === v
              ? 'bg-cyan-600 border-cyan-500 text-white'
              : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
          }`}>
          {v === null ? 'All' : v === 'male' ? 'M' : 'F'}
        </button>
      ))}
    </div>
  );
}

function RangeSelect({ field, value, onChange }) {
  const def = RANGE_DEFS[field];
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300 focus:outline-none focus:border-cyan-500/60">
      {def.options.map(o => <option key={o.value} value={o.value}>{def.label}: {o.label}</option>)}
    </select>
  );
}

function GroupSelector({ label, group, onChange, color }) {
  return (
    <div className="rounded-lg border p-2.5 flex-1 min-w-[200px]"
      style={{ borderColor: `${color}35`, background: `${color}08` }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        <TriToggle label="DM"  value={group.diabetes}     onChange={v => onChange({ ...group, diabetes: v })} />
        <TriToggle label="HTN" value={group.hypertension} onChange={v => onChange({ ...group, hypertension: v })} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   CORE CHART HELPERS (unchanged)
══════════════════════════════════════════════════════ */
function toApiCase(c) {
  return {
    id: c.id,
    displayName: c.displayName,
    features: { ...c.features },
    planSummary: c.planSummary || '',
    progress: (c.progress || []).map((p) => ({ date: p.date || '', egfr: Number(p.egfr) })),
  };
}

async function postAnalyze(cohort, query, k = 8) {
  const res = await fetch(`${ML_BASE}/similarity/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cohort: cohort.map(toApiCase), query: toApiCase(query), k }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); if (j.detail) msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail); } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

function ClusterBadge({ clusterId, label, small }) {
  const color = CLUSTER_PALETTE[Math.abs(clusterId) % CLUSTER_PALETTE.length];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'}`}
      style={{ background: `${color}18`, borderColor: `${color}55`, color }}>
      <GitBranch size={small ? 11 : 12} />
      {label}
    </span>
  );
}

function ProgressMiniChart({ progress, color }) {
  const data = (progress || []).filter((p) => p.date).map((p) => ({ ...p, egfr: Number(p.egfr) })).sort((a, b) => a.date.localeCompare(b.date));
  if (data.length < 2) {
    return <div className="h-24 rounded-lg border border-slate-700/50 bg-slate-900/40 flex items-center justify-center text-[11px] text-slate-500">Add visit points to see trajectory</div>;
  }
  return (
    <div className="h-28 rounded-lg border border-slate-700/50 bg-slate-900/50 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} labelStyle={{ color: '#94a3b8' }} />
          <Line type="monotone" dataKey="egfr" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   CKD PERCENTILE REFERENCE
══════════════════════════════════════════════════════ */
const CKD_PCT_REF = [
  { age: 20, p10: 45, p25: 62, p50: 82, p75: 98,  p90: 112 },
  { age: 25, p10: 43, p25: 60, p50: 80, p75: 96,  p90: 110 },
  { age: 30, p10: 41, p25: 57, p50: 77, p75: 93,  p90: 107 },
  { age: 35, p10: 38, p25: 54, p50: 74, p75: 90,  p90: 104 },
  { age: 40, p10: 35, p25: 51, p50: 70, p75: 86,  p90: 100 },
  { age: 45, p10: 31, p25: 47, p50: 65, p75: 82,  p90: 95  },
  { age: 50, p10: 27, p25: 43, p50: 61, p75: 77,  p90: 90  },
  { age: 55, p10: 23, p25: 38, p50: 56, p75: 72,  p90: 85  },
  { age: 60, p10: 19, p25: 33, p50: 51, p75: 67,  p90: 80  },
  { age: 65, p10: 16, p25: 28, p50: 46, p75: 62,  p90: 75  },
  { age: 70, p10: 13, p25: 24, p50: 41, p75: 57,  p90: 70  },
  { age: 75, p10: 11, p25: 20, p50: 36, p75: 52,  p90: 65  },
  { age: 80, p10:  9, p25: 17, p50: 31, p75: 46,  p90: 59  },
];

function pctile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  const i = (p / 100) * (s.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function buildGrowthCurve(cases) {
  // When few cases exist, compute the group's average eGFR offset vs the reference
  // so sparse buckets still shift the band instead of staying frozen at defaults.
  const globalOffset = (() => {
    if (!cases.length) return 0;
    let total = 0;
    cases.forEach(c => {
      const ref = CKD_PCT_REF.reduce((b, r) =>
        Math.abs(r.age - c.features.age) < Math.abs(b.age - c.features.age) ? r : b);
      total += c.features.egfr - ref.p50;
    });
    return total / cases.length;
  })();

  return CKD_PCT_REF.map(ref => {
    // Wider window (±12 y) + lower threshold (≥2) so small filtered groups adapt
    const nearby = cases.filter(c => Math.abs(c.features.age - ref.age) <= 12);
    let p10, p25, p50, p75, p90;
    if (nearby.length >= 2) {
      const eg = nearby.map(c => c.features.egfr);
      p10 = pctile(eg, 10); p25 = pctile(eg, 25); p50 = pctile(eg, 50);
      p75 = pctile(eg, 75); p90 = pctile(eg, 90);
    } else {
      // No nearby cases — shift reference by the group's global offset
      p10 = Math.max(1,   ref.p10 + globalOffset);
      p25 = Math.max(1,   ref.p25 + globalOffset);
      p50 = Math.max(1,   ref.p50 + globalOffset);
      p75 = Math.min(120, ref.p75 + globalOffset);
      p90 = Math.min(120, ref.p90 + globalOffset);
    }
    return {
      age: ref.age, p10, p25, p50, p75, p90,
      // single-band fields: transparent base at P25, filled span P25→P75
      iqr_base: p25,
      iqr_span: Math.max(0, p75 - p25),
      // kept for compare view (not used in age view any more)
      base:   p10,
      d_low:  Math.max(0, p25 - p10),
      d_mid:  Math.max(0, p75 - p25),
      d_high: Math.max(0, p90 - p75),
    };
  });
}

/* ══════════════════════════════════════════════════════
   GROWTH CURVE CHART  — main enhanced component
══════════════════════════════════════════════════════ */
function GrowthCurveChart({ cases, queryCase, clusterIdById, analysis }) {
  const [binary,   setBinary]   = useState(BLANK_BINARY);
  const [ranges,   setRanges]   = useState(BLANK_RANGES);
  const [viewMode, setViewMode] = useState('age');       // 'age' | 'trajectory' | 'compare'
  const [showClusterLines, setShowClusterLines] = useState(false);
  const [groupA,   setGroupA]   = useState(BLANK_GROUP);
  const [groupB,   setGroupB]   = useState({ diabetes: null, hypertension: true });

  /* ── filtered cases (age + trajectory views) ─── */
  const filtered = useMemo(() => applyFilters(cases, binary, ranges), [cases, binary, ranges]);

  /* ── band color changes with active filter so the change is unmistakable ── */
  const bandColor = useMemo(() => {
    if (binary.diabetes === true  && binary.hypertension === true)  return '#dc2626'; // DM+HTN — dark red
    if (binary.diabetes === true)   return '#f97316'; // DM only — orange
    if (binary.diabetes === false)  return '#22c55e'; // no DM — green
    if (binary.hypertension === true)  return '#ef4444'; // HTN — red
    if (binary.hypertension === false) return '#a3e635'; // no HTN — lime
    if (binary.sex === 'male')   return '#60a5fa'; // male — blue
    if (binary.sex === 'female') return '#f472b6'; // female — pink
    return '#22d3ee'; // no filter — default cyan
  }, [binary]);

  /* ── group summary stats ─────────────────────── */
  const groupStats = useMemo(() => {
    if (!filtered.length) return null;
    const avgEgfr = Math.round(filtered.reduce((s, c) => s + c.features.egfr, 0) / filtered.length);
    const pctDM   = Math.round(filtered.filter(c => Number(c.features.diabetes)    === 1).length / filtered.length * 100);
    const pctHTN  = Math.round(filtered.filter(c => Number(c.features.hypertension) === 1).length / filtered.length * 100);
    const pctF    = Math.round(filtered.filter(c => Number(c.features.sex_female)   === 1).length / filtered.length * 100);
    return { avgEgfr, pctDM, pctHTN, pctF };
  }, [filtered]);

  /* ── age view: percentile bands ─────────────── */
  const growthData = useMemo(() => buildGrowthCurve(filtered), [filtered]);

  /* ── per-cluster median lines ────────────────── */
  const clusterLines = useMemo(() => {
    if (!showClusterLines || !analysis?.clusters) return [];
    return analysis.clusters.map(cl => {
      const clCases = cases.filter(c => clusterIdById[c.id] === cl.id);
      return {
        id: cl.id,
        label: cl.label,
        color: CLUSTER_PALETTE[cl.id % CLUSTER_PALETTE.length],
        data: buildGrowthCurve(clCases),
      };
    });
  }, [showClusterLines, analysis, cases, clusterIdById]);

  /* ── trajectory view ─────────────────────────── */
  const trajLines   = useMemo(() => buildTrajectoryLines(filtered), [filtered]);
  const trajDataset = useMemo(() => buildTrajectoryDataset(trajLines), [trajLines]);

  /* ── compare view ────────────────────────────── */
  const casesA    = useMemo(() => applyGroupFilter(cases, groupA), [cases, groupA]);
  const casesB    = useMemo(() => applyGroupFilter(cases, groupB), [cases, groupB]);
  const compareData = useMemo(() => buildCompareData(casesA, casesB), [casesA, casesB]);

  const qf = queryCase.features;

  /* percentile label for query patient */
  const nearRef = CKD_PCT_REF.reduce((b, r) => Math.abs(r.age - qf.age) < Math.abs(b.age - qf.age) ? r : b);
  const pctLabel =
    qf.egfr >= nearRef.p90 ? 'Above P90 — Excellent' :
    qf.egfr >= nearRef.p75 ? 'P75–P90 — Good' :
    qf.egfr >= nearRef.p50 ? 'P50–P75 — Above average' :
    qf.egfr >= nearRef.p25 ? 'P25–P50 — Below average' :
    qf.egfr >= nearRef.p10 ? 'P10–P25 — Low' : 'Below P10 — Critical';
  const pctColor =
    qf.egfr >= nearRef.p75 ? '#22c55e' :
    qf.egfr >= nearRef.p50 ? '#06b6d4' :
    qf.egfr >= nearRef.p25 ? '#f59e0b' : '#ef4444';

  const sharedAxis = {
    yAxis: (
      <YAxis domain={[0, 120]} tick={{ fill: '#94a3b8', fontSize: 11 }}
        label={{ value: 'eGFR', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 10 }} />
    ),
    grid: <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />,
    ttStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 },
  };

  const stageZones = (
    <>
      <ReferenceArea y1={90} y2={120} fill="rgba(34,197,94,0.04)" />
      <ReferenceArea y1={60} y2={90}  fill="rgba(234,179,8,0.04)" />
      <ReferenceArea y1={30} y2={60}  fill="rgba(249,115,22,0.05)" />
      <ReferenceArea y1={0}  y2={30}  fill="rgba(239,68,68,0.06)" />
      <ReferenceLine y={90} stroke="rgba(34,197,94,0.3)"  strokeDasharray="4 4" label={{ value: 'G1/G2', position: 'right', fill: '#4ade80', fontSize: 9 }} />
      <ReferenceLine y={60} stroke="rgba(234,179,8,0.3)"  strokeDasharray="4 4" label={{ value: 'G3',    position: 'right', fill: '#facc15', fontSize: 9 }} />
      <ReferenceLine y={30} stroke="rgba(249,115,22,0.3)" strokeDasharray="4 4" label={{ value: 'G4',    position: 'right', fill: '#fb923c', fontSize: 9 }} />
      <ReferenceLine y={15} stroke="rgba(239,68,68,0.3)"  strokeDasharray="4 4" label={{ value: 'G5',    position: 'right', fill: '#f87171', fontSize: 9 }} />
    </>
  );

  return (
    <div>
      {/* ── filter bar ───────────────────────────────── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 mb-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Layers size={13} className="text-cyan-400" />
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Filter Cohort</span>
          <span className="ml-auto text-[10px] text-slate-500">
            {filtered.length} / {cases.length} cases shown
          </span>
          {(JSON.stringify(binary) !== JSON.stringify(BLANK_BINARY) || JSON.stringify(ranges) !== JSON.stringify(BLANK_RANGES)) && (
            <button onClick={() => { setBinary(BLANK_BINARY); setRanges(BLANK_RANGES); }}
              className="text-[10px] text-cyan-400/80 hover:text-cyan-300 border border-cyan-500/20 rounded px-2 py-0.5">
              Reset
            </button>
          )}
        </div>

        {/* Binary toggles row */}
        <div className="flex flex-wrap gap-3 mb-2">
          <TriToggle label="Diabetes"    value={binary.diabetes}     onChange={v => setBinary(b => ({ ...b, diabetes: v }))} />
          <TriToggle label="HTN"         value={binary.hypertension} onChange={v => setBinary(b => ({ ...b, hypertension: v }))} />
          <SexToggle                     value={binary.sex}          onChange={v => setBinary(b => ({ ...b, sex: v }))} />
        </div>

        {/* Range dropdowns row */}
        <div className="flex flex-wrap gap-2">
          {Object.keys(RANGE_DEFS).map(field => (
            <RangeSelect key={field} field={field} value={ranges[field]}
              onChange={v => setRanges(r => ({ ...r, [field]: v }))} />
          ))}
        </div>
      </div>

      {/* ── group stats bar (appears when filter is active) ── */}
      {groupStats && filtered.length < cases.length && (
        <div className="flex flex-wrap items-center gap-4 px-3 py-2 rounded-lg border mb-3 text-[11px]"
          style={{ borderColor: `${bandColor}40`, background: `${bandColor}0a` }}>
          <span className="font-bold" style={{ color: bandColor }}>
            {filtered.length} / {cases.length} cases
          </span>
          <span className="text-slate-400">Avg eGFR <span className="font-mono text-white">{groupStats.avgEgfr}</span></span>
          <span className="text-slate-400">DM <span className="font-mono text-white">{groupStats.pctDM}%</span></span>
          <span className="text-slate-400">HTN <span className="font-mono text-white">{groupStats.pctHTN}%</span></span>
          <span className="text-slate-400">Female <span className="font-mono text-white">{groupStats.pctF}%</span></span>
        </div>
      )}

      {/* ── view mode tabs ───────────────────────────── */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {[
          { id: 'age',        label: 'Age View' },
          { id: 'trajectory', label: 'Trajectory' },
          { id: 'compare',    label: 'Compare Groups' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setViewMode(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              viewMode === tab.id
                ? 'bg-cyan-600/90 border-cyan-500 text-white'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}>
            {tab.label}
          </button>
        ))}

        {/* Cluster lines toggle — only in age view */}
        {viewMode === 'age' && analysis?.clusters?.length > 0 && (
          <button onClick={() => setShowClusterLines(v => !v)}
            className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showClusterLines
                ? 'bg-violet-600/80 border-violet-500 text-white'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}>
            {showClusterLines ? '✓ ' : ''}Cluster curves
          </button>
        )}
      </div>

      {/* ── query percentile badge ───────────────────── */}
      {viewMode !== 'compare' && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-[11px] text-slate-400">Query patient percentile:</span>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
            style={{ color: pctColor, borderColor: `${pctColor}55`, background: `${pctColor}15` }}>
            {pctLabel}
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          AGE VIEW
      ══════════════════════════════════════════════ */}
      {viewMode === 'age' && (
        <>
          <div className="h-[340px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                key={`${binary.diabetes}-${binary.hypertension}-${binary.sex}-${JSON.stringify(ranges)}`}
                data={growthData} margin={{ top: 10, right: 52, left: 8, bottom: 24 }}>
                {sharedAxis.grid}
                <XAxis dataKey="age" type="number" domain={[18, 82]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  label={{ value: 'Age (years)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }} />
                {sharedAxis.yAxis}
                {stageZones}

                {/* Single IQR band — color changes with active filter */}
                <Area type="monotone" dataKey="iqr_base" stackId="s" fill="transparent" stroke="none" legendType="none" isAnimationActive={false} />
                <Area type="monotone" dataKey="iqr_span" stackId="s"
                  fill={`${bandColor}30`} stroke={bandColor} strokeWidth={1.5}
                  name="Group range (P25–P75)" isAnimationActive={false} />
                <Line type="monotone" dataKey="p50" stroke={bandColor} strokeWidth={2.5} dot={false} name="Group median (P50)" isAnimationActive={false} />

                {/* Per-cluster median lines */}
                {clusterLines.map(cl => (
                  <Line key={cl.id} data={cl.data} type="monotone" dataKey="p50"
                    stroke={cl.color} strokeWidth={1.5} dot={false}
                    strokeDasharray="4 2" name={`Cluster ${cl.id + 1} median`} isAnimationActive={false} />
                ))}

                {/* Only the filtered cases appear as dots — no dimmed ghosts */}
                <Scatter data={filtered.map(c => ({
                  age: c.features.age, egfr: c.features.egfr,
                  name: c.displayName,
                  clusterId: clusterIdById[c.id] ?? 0,
                }))} dataKey="egfr" name="Cases" isAnimationActive={false}>
                  {filtered.map((c, i) => (
                    <Cell key={i} fill={CLUSTER_PALETTE[(clusterIdById[c.id] ?? 0) % CLUSTER_PALETTE.length]} fillOpacity={0.9} />
                  ))}
                </Scatter>

                {/* Query patient crosshairs */}
                <ReferenceLine x={qf.age}  stroke="#facc15" strokeWidth={1.5} strokeDasharray="5 3" label={{ value: `${Math.round(qf.age)}y`, position: 'insideTopLeft', fill: '#facc15', fontSize: 10 }} />
                <ReferenceLine y={qf.egfr} stroke="#facc15" strokeWidth={1.5} strokeDasharray="5 3" label={{ value: `${Math.round(qf.egfr)}`, position: 'right', fill: '#facc15', fontSize: 10 }} />
                <ReferenceDot  x={qf.age}  y={qf.egfr} r={7} fill="#facc15" stroke="#0f172a" strokeWidth={2} />

                <Tooltip contentStyle={sharedAxis.ttStyle}
                  labelFormatter={v => `Age ${v} years`}
                  formatter={(val, name) => {
                    if (name === 'Cases') return [val, 'eGFR'];
                    return [typeof val === 'number' ? val.toFixed(1) : val, name];
                  }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 justify-center text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded" style={{ background: `${bandColor}60` }} />
              Group range (P25–P75)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 border-t-2" style={{ borderColor: bandColor }} />
              Group median (P50)
            </span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" /> Query patient</span>
            {showClusterLines && <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-violet-400" /> Cluster medians</span>}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-500 mt-4">No cases match the current filters.</p>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════
          TRAJECTORY VIEW  (time-based eGFR decline)
      ══════════════════════════════════════════════ */}
      {viewMode === 'trajectory' && (
        <>
          {trajLines.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 text-slate-500">
              <p className="text-sm">No trajectory data for this filter</p>
              <p className="text-[11px]">Load the demo cohort or add visit dates to cases — each case needs ≥ 2 dated visits.</p>
            </div>
          ) : (
            <>
              <div className="h-[340px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajDataset} margin={{ top: 10, right: 20, left: 8, bottom: 24 }}>
                    {sharedAxis.grid}
                    <XAxis dataKey="months" type="number"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      label={{ value: 'Months from first visit', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }} />
                    {sharedAxis.yAxis}
                    {/* CKD stage zones */}
                    <ReferenceArea y1={90} y2={120} fill="rgba(34,197,94,0.04)" />
                    <ReferenceArea y1={60} y2={90}  fill="rgba(234,179,8,0.04)" />
                    <ReferenceArea y1={30} y2={60}  fill="rgba(249,115,22,0.05)" />
                    <ReferenceArea y1={0}  y2={30}  fill="rgba(239,68,68,0.06)" />
                    <ReferenceLine y={90} stroke="rgba(34,197,94,0.3)"  strokeDasharray="4 4" label={{ value: 'G1/G2', position: 'right', fill: '#4ade80', fontSize: 9 }} />
                    <ReferenceLine y={60} stroke="rgba(234,179,8,0.3)"  strokeDasharray="4 4" label={{ value: 'G3',    position: 'right', fill: '#facc15', fontSize: 9 }} />
                    <ReferenceLine y={30} stroke="rgba(249,115,22,0.3)" strokeDasharray="4 4" label={{ value: 'G4',    position: 'right', fill: '#fb923c', fontSize: 9 }} />
                    {trajLines.map((line, i) => (
                      <Line key={line.id} dataKey={line.id}
                        stroke={CLUSTER_PALETTE[(clusterIdById[line.id] ?? i) % CLUSTER_PALETTE.length]}
                        strokeWidth={2} dot={{ r: 3 }}
                        name={line.name.slice(0, 28)}
                        connectNulls={false} isAnimationActive={false} />
                    ))}
                    <Tooltip contentStyle={sharedAxis.ttStyle}
                      labelFormatter={v => `Month ${v}`}
                      formatter={(val, name) => [typeof val === 'number' ? val.toFixed(1) : val, name]} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                Each line = one patient's eGFR trajectory from their first recorded visit. Colored by cohort group.
              </p>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════
          COMPARE VIEW  (two groups, overlaid bands)
      ══════════════════════════════════════════════ */}
      {viewMode === 'compare' && (
        <>
          {/* Group selectors */}
          <div className="flex flex-wrap gap-3 mb-4">
            <GroupSelector label={`Group A — ${casesA.length} cases`} group={groupA} onChange={setGroupA} color="#22d3ee" />
            <GroupSelector label={`Group B — ${casesB.length} cases`} group={groupB} onChange={setGroupB} color="#fb923c" />
          </div>

          {(casesA.length === 0 && casesB.length === 0) ? (
            <p className="text-center text-sm text-slate-500">Both groups are empty. Adjust the selectors above.</p>
          ) : (
            <>
              <div className="h-[340px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={compareData} margin={{ top: 10, right: 52, left: 8, bottom: 24 }}>
                    {sharedAxis.grid}
                    <XAxis dataKey="age" type="number" domain={[18, 82]}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      label={{ value: 'Age (years)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }} />
                    {sharedAxis.yAxis}
                    {stageZones}

                    {/* Group A band: base_a (transparent) + band_a (cyan fill) */}
                    <Area type="monotone" dataKey="base_a" stackId="a" fill="transparent" stroke="none" legendType="none" isAnimationActive={false} />
                    <Area type="monotone" dataKey="band_a" stackId="a" fill="rgba(34,211,238,0.18)" stroke="rgba(34,211,238,0.55)" strokeWidth={1} name="Group A — P25–P75" isAnimationActive={false} />

                    {/* Group B band: base_b (transparent) + band_b (amber fill) */}
                    <Area type="monotone" dataKey="base_b" stackId="b" fill="transparent" stroke="none" legendType="none" isAnimationActive={false} />
                    <Area type="monotone" dataKey="band_b" stackId="b" fill="rgba(251,146,60,0.18)" stroke="rgba(251,146,60,0.55)" strokeWidth={1} name="Group B — P25–P75" isAnimationActive={false} />

                    {/* Median lines */}
                    {casesA.length > 0 && <Line type="monotone" dataKey="p50_a" stroke="#22d3ee" strokeWidth={2.5} dot={false} name="Group A median" isAnimationActive={false} />}
                    {casesB.length > 0 && <Line type="monotone" dataKey="p50_b" stroke="#fb923c" strokeWidth={2.5} dot={false} name="Group B median" isAnimationActive={false} />}

                    <Tooltip contentStyle={sharedAxis.ttStyle}
                      labelFormatter={v => `Age ${v} years`}
                      formatter={(val, name) => [typeof val === 'number' ? val.toFixed(1) : val, name]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Compare legend */}
              <div className="flex flex-wrap gap-4 mt-3 justify-center text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-cyan-400" /> Group A median</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded" style={{ background: 'rgba(34,211,238,0.45)' }} /> Group A P25–P75 band</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-orange-400" /> Group B median</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded" style={{ background: 'rgba(251,146,60,0.45)' }} /> Group B P25–P75 band</span>
              </div>

              {/* Gap summary */}
              {casesA.length > 0 && casesB.length > 0 && (() => {
                const midAge = 50;
                const ref = compareData.find(d => d.age === midAge) || compareData[Math.floor(compareData.length / 2)];
                const gap = (ref.p50_a - ref.p50_b).toFixed(1);
                const direction = ref.p50_a >= ref.p50_b ? 'Group A' : 'Group B';
                const absDiff = Math.abs(Number(gap)).toFixed(1);
                return (
                  <div className="mt-3 rounded-lg border border-slate-700/50 bg-slate-900/40 px-4 py-2.5 text-[11px] text-slate-300">
                    At age {ref.age}: <span className="text-cyan-300 font-semibold">Group A P50 = {ref.p50_a.toFixed(1)}</span>
                    {' '}vs <span className="text-orange-300 font-semibold">Group B P50 = {ref.p50_b.toFixed(1)}</span>
                    {' '}— <span className="font-semibold" style={{ color: ref.p50_a >= ref.p50_b ? '#22d3ee' : '#fb923c' }}>
                      {direction} is {absDiff} mL/min higher
                    </span>
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function SimilarCasesPage({ patientData, liveEgfr }) {
  const [cases, setCases] = useState(() => {
    const saved = loadCaseLibrary();
    return saved.length > 0 ? saved : buildDemoCohort();
  });
  const [querySource, setQuerySource] = useState('live');
  const [libraryQueryId, setLibraryQueryId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveName, setSaveName] = useState('');
  const [focusCaseId, setFocusCaseId] = useState(null);
  const [newProgress, setNewProgress] = useState({ date: '', egfr: '' });

  const liveQuery = useMemo(() => ({
    id: '__live_query__',
    displayName: 'Current simulation patient',
    features: patientToFeatures(patientData, liveEgfr),
    planSummary: '',
    progress: [],
  }), [patientData, liveEgfr]);

  const queryCase = useMemo(() => {
    if (querySource === 'live') return liveQuery;
    const c = cases.find((x) => x.id === libraryQueryId);
    return c || liveQuery;
  }, [querySource, libraryQueryId, cases, liveQuery]);

  useEffect(() => {
    if (!cases.length) { setLibraryQueryId(null); return; }
    if (!libraryQueryId || !cases.some((c) => c.id === libraryQueryId)) setLibraryQueryId(cases[0].id);
  }, [cases, libraryQueryId]);

  const persist = useCallback((next) => { setCases(next); saveCaseLibrary(next); }, []);

  const runAnalysis = useCallback(async () => {
    if (!cases.length) { setAnalysis(null); setError(''); return; }
    setLoading(true); setError('');
    try {
      const data = await postAnalyze(cases, queryCase, 8);
      setAnalysis(data);
    } catch (e) {
      setError(e.message || 'Analysis failed');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [cases, queryCase]);

  useEffect(() => { const t = setTimeout(runAnalysis, 350); return () => clearTimeout(t); }, [runAnalysis]);
  useEffect(() => { if (focusCaseId && !cases.some((c) => c.id === focusCaseId)) setFocusCaseId(null); }, [cases, focusCaseId]);

  const clusterIdById = analysis?.clusterIdByCaseId || {};
  const clusterMeta = useMemo(() => {
    const m = new Map();
    (analysis?.clusters || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [analysis]);

  const scatterData = useMemo(() => cases.map((c) => ({
    x: c.features.age, y: c.features.egfr, z: 140, id: c.id,
    name: c.displayName.slice(0, 28), clusterId: clusterIdById[c.id] ?? 0, isQuery: false,
  })), [cases, clusterIdById]);

  const neighbors = analysis?.neighbors || [];
  const maxDist = Math.max(0.001, ...neighbors.map((n) => n.distance));
  const focusedCase = focusCaseId ? cases.find((c) => c.id === focusCaseId) : null;

  const updateCaseField = (id, patch) => persist(cases.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addProgressPoint = (id) => {
    const eg = parseFloat(newProgress.egfr);
    if (!newProgress.date || !Number.isFinite(eg)) return;
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    updateCaseField(id, { progress: [...(c.progress || []), { date: newProgress.date, egfr: eg }] });
    setNewProgress({ date: '', egfr: '' });
  };

  const stageForEgfr = (g) => getCKDStage(Number(g)).shortLabel;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-slate-100 select-text"
      style={{ background: 'linear-gradient(165deg, #050c18 0%, #071428 40%, #0a1628 100%)' }}>
      <div className="relative overflow-hidden border-b border-cyan-500/15">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_-20%,rgba(34,211,238,0.14),transparent)] pointer-events-none" />
        <div className="relative px-8 py-8 max-w-[1600px] mx-auto">
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/25">
                  <Network className="text-cyan-300" size={22} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Similar cases &amp; cohort groups</h1>
                  <p className="text-sm text-slate-400 mt-0.5 max-w-2xl">
                    Phase 1: k-nearest neighbors. Phase 2: k-means clusters. Phase 3: growth curves with clinical group filtering, trajectory view, and compare mode.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button"
                onClick={() => { const name = saveName.trim() || undefined; persist([createCaseFromPatient(patientData, liveEgfr, name), ...cases]); setSaveName(''); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow-lg shadow-cyan-900/30 transition-colors">
                <Plus size={16} />Save current patient
              </button>
              <button type="button"
                onClick={() => { if (!window.confirm('Replace library with 10 demo patients?')) return; persist(buildDemoCohort()); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 text-sm font-semibold transition-colors">
                <Sparkles size={16} />Load demo cohort
              </button>
              <button type="button" onClick={() => runAnalysis()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-200 text-sm font-medium">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh analysis
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
              placeholder="Optional label when saving…"
              className="rounded-lg border border-slate-600/80 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 w-64 max-w-full" />
            {cases.length > 0 && <span className="text-xs text-slate-500">{cases.length} saved case{cases.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        {/* Library sidebar */}
        <aside className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"><User size={14} />Case library</h2>
          {!cases.length ? (
            <div className="rounded-xl border border-dashed border-slate-600/60 bg-slate-900/30 p-6 text-center text-sm text-slate-500">
              No cases yet. Save the current simulation or load the demo cohort.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
              {cases.map((c) => {
                const cid = clusterIdById[c.id];
                const isQ = querySource === 'library' && libraryQueryId === c.id;
                return (
                  <li key={c.id}>
                    <button type="button"
                      onClick={() => { setFocusCaseId(c.id); setLibraryQueryId(c.id); setQuerySource('library'); }}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
                        isQ ? 'border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.08)]'
                            : 'border-slate-700/50 bg-slate-900/40 hover:border-slate-600'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100 truncate">{c.displayName}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            eGFR {Math.round(c.features.egfr)} · {stageForEgfr(c.features.egfr)}
                            {cid != null && <span className="ml-2"><ClusterBadge small clusterId={cid} label={`Group ${cid + 1}`} /></span>}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-slate-600 flex-shrink-0 mt-0.5" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {cases.length > 0 && (
            <button type="button"
              onClick={() => { if (!window.confirm('Clear all saved cases?')) return; persist([]); setAnalysis(null); }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-red-400/90 hover:text-red-300">
              <Trash2 size={14} />Clear library
            </button>
          )}
        </aside>

        <main className="space-y-6 min-w-0">
          {error && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
              {error}
              <span className="block text-[11px] text-amber-200/70 mt-1">Ensure the ML API is running (<code>npm run dev:ml</code> or <code>dev:full</code>).</span>
            </div>
          )}

          {/* Query source */}
          <section className="rounded-2xl border border-slate-700/40 bg-slate-900/35 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><Stethoscope size={16} className="text-cyan-400" />Query patient (who to match)</h2>
            <div className="flex flex-wrap gap-3 mb-4">
              {['live', 'library'].map(src => (
                <button key={src} type="button" onClick={() => setQuerySource(src)} disabled={src === 'library' && !cases.length}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${
                    querySource === src ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                                       : 'border-slate-600 bg-slate-800/40 text-slate-400 hover:text-slate-200'}`}>
                  {src === 'live' ? 'Live simulation' : 'Saved case'}
                </button>
              ))}
            </div>
            {querySource === 'library' && cases.length > 0 && (
              <select value={libraryQueryId || ''} onChange={(e) => setLibraryQueryId(e.target.value)}
                className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white">
                {cases.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
              </select>
            )}
            {querySource === 'live' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-3">
                {[
                  ['Age', Math.round(queryCase.features.age)],
                  ['eGFR', Math.round(queryCase.features.egfr)],
                  ['Cr', queryCase.features.creatinine.toFixed(2)],
                  ['DM / HTN', `${queryCase.features.diabetes ? 'Y' : 'N'} / ${queryCase.features.hypertension ? 'Y' : 'N'}`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2">
                    <span className="text-slate-500 block">{k}</span>
                    <span className="text-slate-100 font-mono font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {analysis && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-500">Query cohort group:</span>
                <ClusterBadge clusterId={analysis.queryClusterId} label={analysis.queryClusterLabel} />
              </div>
            )}
          </section>

          {/* Growth curve section */}
          {cases.length > 0 && (
            <section className="rounded-2xl border border-slate-700/40 bg-slate-900/35 p-5">
              <h2 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                <Activity size={16} className="text-violet-400" />
                eGFR Growth Curve — interactive cohort analysis
              </h2>
              <p className="text-[11px] text-slate-500 mb-4">
                Filter by clinical group, view individual trajectories over time, or compare two patient populations side by side.
              </p>
              <GrowthCurveChart
                cases={cases}
                queryCase={queryCase}
                clusterIdById={clusterIdById}
                analysis={analysis}
              />
              {analysis && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {analysis.clusters.map((cl) => (
                    <ClusterBadge key={cl.id} clusterId={cl.id}
                      label={`${cl.memberIds.length} pts · ${cl.label.slice(0, 48)}${cl.label.length > 48 ? '…' : ''}`} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Neighbors */}
          {cases.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><Network size={16} className="text-cyan-400" />Most similar cases (k-NN, scaled Euclidean)</h2>
              {!analysis && !loading && !error && <p className="text-sm text-slate-500">Computing…</p>}
              {loading && <p className="text-sm text-slate-400">Updating neighbors…</p>}
              {neighbors.length === 0 && analysis && !loading && <p className="text-sm text-slate-500">No neighbors (is the query identical to the only cohort member?).</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {neighbors.map((n) => {
                  const c = cases.find((x) => x.id === n.caseId);
                  if (!c) return null;
                  const cid = clusterIdById[c.id];
                  const cl = cid != null ? clusterMeta.get(cid) : null;
                  const color = CLUSTER_PALETTE[(cid ?? 0) % CLUSTER_PALETTE.length];
                  return (
                    <article key={n.caseId}
                      className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 shadow-xl shadow-black/20 hover:border-cyan-500/25 transition-colors cursor-pointer"
                      onClick={() => setFocusCaseId(c.id)}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-bold text-cyan-400/90 uppercase tracking-wide">Match #{n.rank}</span>
                          <h3 className="text-base font-semibold text-white leading-tight">{c.displayName}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Distance</span>
                          <span className="text-sm font-mono text-slate-200">{n.distance.toFixed(3)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (1 - n.distance / maxDist) * 100)}%`, background: `linear-gradient(90deg, ${color}, #22d3ee)` }} />
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">eGFR {Math.round(c.features.egfr)}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">Cr {c.features.creatinine.toFixed(2)}</span>
                        {cl && <ClusterBadge small clusterId={cid} label={cl.label.slice(0, 36) + (cl.label.length > 36 ? '…' : '')} />}
                      </div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Top differing drivers</p>
                      <ul className="text-[11px] text-slate-400 space-y-0.5">
                        {(n.contributions || []).slice(0, 4).map((co) => (
                          <li key={co.feature} className="flex justify-between gap-2">
                            <span>{FEATURE_LABELS[co.feature] || co.feature}</span>
                            <span className="font-mono text-slate-300">{co.absDelta.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-cyan-500/80 mt-3 flex items-center gap-1">Open plan &amp; trajectory <ChevronRight size={12} /></p>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Focused case */}
          {focusedCase && (
            <section className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Save size={18} className="text-cyan-400" />Plan &amp; progress — {focusedCase.displayName}</h2>
                <button type="button" onClick={() => setFocusCaseId(null)} className="text-xs text-slate-500 hover:text-slate-300">Close</button>
              </div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Care plan (editable)</label>
              <textarea value={focusedCase.planSummary}
                onChange={(e) => updateCaseField(focusedCase.id, { planSummary: e.target.value })}
                rows={4}
                className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 mb-5 select-text"
                placeholder="Medications, targets, referrals, patient education notes…" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">eGFR trajectory</p>
                  <ProgressMiniChart progress={focusedCase.progress} color="#22d3ee" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Add visit</p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <input type="date" value={newProgress.date} onChange={(e) => setNewProgress((p) => ({ ...p, date: e.target.value }))}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-white" />
                    <input type="number" placeholder="eGFR" value={newProgress.egfr} onChange={(e) => setNewProgress((p) => ({ ...p, egfr: e.target.value }))}
                      className="w-24 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-white" />
                    <button type="button" onClick={() => addProgressPoint(focusedCase.id)}
                      className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white">
                      Add point
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
