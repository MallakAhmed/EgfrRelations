import { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import KidneyVisualization from './KidneyVisualization.jsx';

/* ── Animated counter ────────────────────────────── */
function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(value);
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

/* ── Main ────────────────────────────────────────── */
export default function MainVisualization({ results, history, beforeEGFR, patientData }) {
  const { egfr, ckdStage, insight } = results;
  const color = ckdStage.gaugeColor;

  // Build chart data from history
  const chartData = history.length < 2
    ? [{ t: '—', v: egfr }]
    : history.slice(-14).map((h, i) => ({ t: `T${i + 1}`, v: h.egfr }));

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden grid-bg"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0a1628 0%, #030812 70%)' }}
    >
      {/* Top bar */}
      <div className="px-5 py-3 border-b border-cyan-500/10 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="font-orbitron text-xs font-bold text-slate-300 tracking-widest uppercase">
            Kidney_Twin_V2
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Active Synthetic Model</p>
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
        <div className="flex flex-col gap-4 w-28">
          <div className="glass-card rounded-xl p-3 text-center border-glow">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Creatinine</p>
            <p className="font-orbitron text-lg font-bold" style={{ color }}>
              {patientData.creatinine}
            </p>
            <p className="text-[9px] text-slate-600">mg/dL</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">K⁺ Level</p>
            <p className={`font-orbitron text-lg font-bold ${
              patientData.potassium > 5.5 ? 'text-red-400' :
              patientData.potassium > 5.0 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {patientData.potassium}
            </p>
            <p className="text-[9px] text-slate-600">mEq/L</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">MAP</p>
            <p className={`font-orbitron text-lg font-bold ${
              patientData.map > 110 ? 'text-red-400' :
              patientData.map > 100 ? 'text-amber-400' : 'text-cyan-400'
            }`}>
              {patientData.map}
            </p>
            <p className="text-[9px] text-slate-600">mmHg</p>
          </div>
        </div>

        {/* Kidney + overlay */}
        <div className="flex flex-col items-center gap-2">
          <KidneyVisualization egfr={egfr} ckdStage={ckdStage} patientData={patientData} />

          {/* eGFR value below kidney */}
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-2">
              <span
                className="font-orbitron text-5xl font-bold glow-text number-animate"
                key={egfr}
                style={{ color }}
              >
                <AnimatedNumber value={egfr} />
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
        <div className="flex flex-col gap-4 w-28">
          <div className="glass-card rounded-xl p-3 text-center border-glow">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Age / Sex</p>
            <p className="font-orbitron text-sm font-bold text-slate-300">{patientData.age}</p>
            <p className="text-[9px] text-slate-500 capitalize">{patientData.gender}</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Urine Out</p>
            <p className={`font-orbitron text-sm font-bold ${
              patientData.urineOutput < 400 ? 'text-red-400' :
              patientData.urineOutput < 800 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {patientData.urineOutput}
            </p>
            <p className="text-[9px] text-slate-600">mL/day</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Weight</p>
            <p className="font-orbitron text-sm font-bold text-slate-300">{patientData.weight}</p>
            <p className="text-[9px] text-slate-600">kg</p>
          </div>
        </div>
      </div>

      {/* Bottom: before/after + chart + insight */}
      <div className="px-5 pb-4 flex-shrink-0 space-y-2">

        {/* Before / After comparison */}
        {beforeEGFR !== null && (
          <div className="flex items-center gap-3 px-4 py-2.5 glass-card rounded-xl slide-in-right">
            <span className="text-[11px] text-slate-500">Before Sim:</span>
            <span className="font-orbitron text-sm font-bold text-slate-400">{beforeEGFR}</span>
            <span className="text-slate-600">→</span>
            <span className="font-orbitron text-sm font-bold" style={{ color }}>{egfr}</span>
            <span className="text-[11px] text-slate-500">mL/min</span>
            <span className={`ml-1 text-[11px] font-semibold ${egfr >= beforeEGFR ? 'text-emerald-400' : 'text-red-400'}`}>
              ({egfr >= beforeEGFR ? '+' : ''}{egfr - beforeEGFR})
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
