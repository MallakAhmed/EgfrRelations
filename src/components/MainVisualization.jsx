import { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

import KidneyVisualization from './KidneyVisualization.jsx';
import TrendCharts, { FutureTrendCharts, CIChart } from './TrendCharts.jsx';
import { calculateEGFR } from '../utils/egfrCalculation.js';

/* ── Animated counter ────────────────────────────── */
function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(parseFloat(value.toFixed(decimals)));
  const raf     = useRef(null);
  const startRef = useRef({ from: value, start: null });

  useEffect(() => {
    const from = display;
    const to   = value;
    const dur  = 600;
    startRef.current = { from, start: null };

    const step = (ts) => {
      if (!startRef.current.start) startRef.current.start = ts;
      const progress = Math.min((ts - startRef.current.start) / dur, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(parseFloat((from + (to - from) * ease).toFixed(decimals)));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]); // eslint-disable-line

  return <>{display}</>;
}

/* ── Custom tooltip ──────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-slate-400">{label}</p>
      <p className="text-cyan-300 font-orbitron font-semibold">
        {payload[0].value} <span className="text-slate-500 font-normal">mL/min</span>
      </p>
    </div>
  );
};

/* ── Stage pill ──────────────────────────────────── */
function StagePill({ ckdStage }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${ckdStage.bgClass} ${ckdStage.borderClass} ${ckdStage.colorClass}`}>
      <span className="w-1.5 h-1.5 rounded-full status-dot" style={{ background: ckdStage.gaugeColor }} />
      {ckdStage.stage}
      <span className="text-[10px] opacity-70 font-normal">— {ckdStage.description}</span>
    </div>
  );
}

/* ── Metric card ─────────────────────────────────── */
const STATUS_STYLES = {
  safe:     { border: 'border-emerald-500/30', val: '#10b981', bg: 'rgba(16,185,129,0.06)',  dot: '#10b981', ref: 'Normal'   },
  warning:  { border: 'border-amber-400/35',   val: '#fbbf24', bg: 'rgba(251,191,36,0.06)',  dot: '#fbbf24', ref: 'Elevated' },
  critical: { border: 'border-red-400/40',      val: '#f87171', bg: 'rgba(248,113,113,0.07)', dot: '#ef4444', ref: 'Critical' },
  neutral:  { border: 'border-cyan-500/20',     val: '#67e8f9', bg: 'rgba(0,212,255,0.05)',   dot: '#00d4ff', ref: ''        },
};

function StatCard({ label, value, unit, status = 'neutral', ref: refRange, sub }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.neutral;
  return (
    <div
      className={`glass-card rounded-xl p-3 text-center border ${s.border} transition-all duration-500`}
      style={{ background: s.bg }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[8px] text-slate-500 uppercase tracking-widest">{label}</p>
        <span className="w-1.5 h-1.5 rounded-full status-dot flex-shrink-0" style={{ background: s.dot }} />
      </div>
      <p className="font-orbitron text-lg font-bold leading-none" style={{ color: s.val }}>
        {value}
      </p>
      <p className="text-[8px] text-slate-600 mt-1">{unit}</p>
      {(refRange || sub) && (
        <p className="text-[7px] mt-1 font-medium" style={{ color: s.dot + 'aa' }}>
          {refRange || sub}
        </p>
      )}
    </div>
  );
}

/* ── Main ────────────────────────────────────────── */
export default function MainVisualization({ results, history, beforeEGFR, patientData, futurePredictions }) {
  const { egfr, ckdStage, insight } = results;
  const color = ckdStage.gaugeColor;
  const [showCurrentTrends, setShowCurrentTrends] = useState(false);
  const [showFutureTrends,  setShowFutureTrends]  = useState(false);
  const [showCI,            setShowCI]            = useState(false);

  const currentEgfr = calculateEGFR({
    ...patientData, map: 88, potassium: 4.2, urineOutput: 1600, weight: patientData.weight ?? 70,
  });

  // Build chart data from history
  const chartData = history.length < 2
    ? [{ t: '—', v: egfr }]
    : history.slice(-14).map((h, i) => ({ t: `T${i + 1}`, v: h.egfr }));

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden grid-bg"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0a1628 0%, #030812 70%)' }}
    >
      {/* Modal: Current eGFR Trend Charts */}
      {showCurrentTrends && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowCurrentTrends(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <button className="absolute top-3 right-3 text-slate-400 hover:text-red-500 text-xl font-bold leading-none"
              onClick={() => setShowCurrentTrends(false)}>×</button>
            <h2 className="text-lg font-bold mb-5 text-cyan-700">eGFR Trend Charts</h2>
            <TrendCharts patientData={patientData} />
          </div>
        </div>
      )}

      {/* Modal: Future eGFR Trend Charts */}
      {showFutureTrends && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowFutureTrends(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <button className="absolute top-3 right-3 text-slate-400 hover:text-red-500 text-xl font-bold leading-none"
              onClick={() => setShowFutureTrends(false)}>×</button>
            <h2 className="text-lg font-bold mb-5 text-cyan-700">Future eGFR Trend Charts</h2>
            <FutureTrendCharts patientData={patientData} />
          </div>
        </div>
      )}

      {/* Modal: Confidence Interval */}
      {showCI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowCI(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <button className="absolute top-3 right-3 text-slate-400 hover:text-red-500 text-xl font-bold leading-none"
              onClick={() => setShowCI(false)}>×</button>
            <h2 className="text-lg font-bold mb-5 text-cyan-700">Confidence Interval</h2>
            <CIChart futurePredictions={futurePredictions} currentEgfr={currentEgfr} />
          </div>
        </div>
      )}
      {/* Top bar */}
      <div className="px-5 py-3 border-b border-cyan-500/10 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="font-orbitron text-xs font-bold text-slate-300 tracking-widest uppercase">
            Kidney_Twin_V2
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Active Synthetic Model</p>
          <div className="flex justify-center gap-2 mt-1">
            <button
              className="px-3 py-1 rounded bg-cyan-600 text-white text-xs font-semibold shadow hover:bg-cyan-700 transition"
              onClick={() => setShowCurrentTrends(true)}
            >
              Trend Charts
            </button>
            <button
              className="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-semibold shadow hover:bg-indigo-700 transition"
              onClick={() => setShowFutureTrends(true)}
            >
              Future Trends
            </button>
            <button
              className="px-3 py-1 rounded bg-violet-600 text-white text-xs font-semibold shadow hover:bg-violet-700 transition"
              onClick={() => setShowCI(true)}
            >
              CI
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {[
            { label: 'Perfusion', value: 'ON',  ok: true  },
            { label: 'Damping',   value: 'OFF', ok: false },
            { label: 'Electrolytes', value: 'ON', ok: true },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-cyan-400' : 'bg-slate-600'}`} />
              <span className="text-[10px] text-slate-500">{label}</span>
              <span className={`text-[10px] font-semibold ${ok ? 'text-cyan-400' : 'text-slate-600'}`}>{value}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/8 border border-cyan-500/18">
            <span className="relative">
              <span className="w-1.5 h-1.5 block rounded-full bg-cyan-400" />
              <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping opacity-60" />
            </span>
            <span className="text-[10px] text-cyan-400 font-semibold">LIVE SIM ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Center: kidney + eGFR display */}
      <div className="flex-1 flex items-center justify-center gap-8 px-6 py-2 min-h-0">

        {/* Left metrics column */}
        <div className="flex flex-col gap-3 w-28">
          <StatCard
            label="Creatinine"
            value={parseFloat(patientData.creatinine).toFixed(1)}
            unit="mg/dL"
            status={patientData.creatinine > 5.0 ? 'critical' : patientData.creatinine > 1.3 ? 'warning' : 'safe'}
            refRange={patientData.creatinine > 1.3 ? '↑ High' : '0.7–1.3'}
          />
          <StatCard
            label="K⁺ Level"
            value={parseFloat(patientData.potassium).toFixed(1)}
            unit="mEq/L"
            status={patientData.potassium > 5.5 || patientData.potassium < 3.0 ? 'critical' : patientData.potassium > 5.0 || patientData.potassium < 3.5 ? 'warning' : 'safe'}
            refRange="3.5–5.0"
          />
          <StatCard
            label="MAP"
            value={Math.round(patientData.map)}
            unit="mmHg"
            status={patientData.map > 115 || patientData.map < 55 ? 'critical' : patientData.map > 100 || patientData.map < 65 ? 'warning' : 'safe'}
            refRange="65–100"
          />
        </div>

        {/* Kidney + overlay */}
        <div className="flex flex-col items-center gap-2">
          <KidneyVisualization egfr={egfr} ckdStage={ckdStage} patientData={patientData} />

          {/* eGFR value below kidney */}
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-2">
              <span
                className="font-orbitron text-5xl font-bold glow-text number-animate"
                key={Math.round(egfr)}
                style={{ color }}
              >
                <AnimatedNumber value={Math.round(egfr)} />
              </span>
              <span className="text-sm text-slate-500 font-medium">mL/min/1.73m²</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Predicted eGFR</p>
            <div className="mt-2 flex justify-center">
              <StagePill ckdStage={ckdStage} />
            </div>
          </div>
        </div>

        {/* Right metrics column */}
        <div className="flex flex-col gap-3 w-28">
          <StatCard
            label="Age / Sex"
            value={Math.round(patientData.age)}
            unit={String(patientData.gender || '').toLowerCase() === 'male' ? 'Male' : 'Female'}
            status="neutral"
          />
          <StatCard
            label="Urine Out"
            value={Math.round(patientData.urineOutput).toLocaleString()}
            unit="mL/day"
            status={patientData.urineOutput < 400 ? 'critical' : patientData.urineOutput < 800 ? 'warning' : 'safe'}
            refRange={patientData.urineOutput < 400 ? 'Oliguria' : patientData.urineOutput < 800 ? 'Low' : '≥800'}
          />
          <StatCard
            label="Weight"
            value={Math.round(patientData.weight)}
            unit="kg"
            status="neutral"
          />
        </div>
      </div>

      {/* Bottom: before/after + chart + insight */}
      <div className="px-5 pb-4 flex-shrink-0 space-y-2">

        {/* Before / After comparison */}
        {beforeEGFR !== null && (
          <div className="flex items-center gap-3 px-4 py-2.5 glass-card rounded-xl slide-in-right">
            <span className="text-[11px] text-slate-500">Before Sim:</span>
            <span className="font-orbitron text-sm font-bold text-slate-400">{Math.round(beforeEGFR)}</span>
            <span className="text-slate-600">→</span>
            <span className="font-orbitron text-sm font-bold" style={{ color }}>{Math.round(egfr)}</span>
            <span className="text-[11px] text-slate-500">mL/min</span>
            <span className={`ml-1 text-[11px] font-semibold ${egfr >= beforeEGFR ? 'text-emerald-400' : 'text-red-400'}`}>
              ({egfr >= beforeEGFR ? '+' : ''}{Math.round(egfr - beforeEGFR)})
            </span>
            <div className="flex-1" />
            <span className="text-[10px] text-slate-600">GFR before vs after</span>
          </div>
        )}

        {/* Trend sparkline + insight card */}
        <div className="flex gap-3">
          {/* Sparkline */}
          <div className="flex-1 glass-card rounded-xl p-3">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">eGFR Trend</p>
            <ResponsiveContainer width="100%" height={52}>
              <LineChart data={chartData} margin={{ top: 2, right: 4, left: -30, bottom: 0 }}>
                <XAxis dataKey="t" tick={{ fill: '#475569', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 8 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: `${color}30` }} />
                <ReferenceLine y={60}  stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={0.8} />
                <ReferenceLine y={30}  stroke="#ef4444" strokeDasharray="3 3" strokeWidth={0.8} />
                <Line
                  type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
                  dot={false} activeDot={{ r: 3, fill: color }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Insight card */}
          <div className="flex-[2] glass-card rounded-xl p-3 flex flex-col justify-between">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Simulation Insight</p>
            <p
              className="text-[12px] text-slate-300 leading-relaxed fade-in"
              key={insight}
            >
              {insight}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1 h-1 rounded-full bg-cyan-400 status-dot" />
              <span className="text-[9px] text-slate-600">AI-generated clinical note</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
