import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, Download, GitBranch, ChevronDown, ChevronUp } from 'lucide-react';
import { CLINICAL_REFERENCES, INFLUENCE_MAP } from '../utils/clinicalRelationships.js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts';

/* ── Circular eGFR gauge ─────────────────────────── */
function EGFRGauge({ egfr, ckdStage }) {
  const R   = 72;
  const cx  = 96, cy = 96;
  const circ = 2 * Math.PI * R;
  // 240° arc gauge (starts at 150°, sweeps 240°)
  const arcLen   = (240 / 360) * circ;
  const filled   = arcLen * Math.min(egfr / 120, 1);
  const gap      = circ - arcLen;
  const color    = ckdStage.gaugeColor;

  return (
    <svg viewBox="0 0 192 192" className="w-full">
      <defs>
        <filter id="gaugeGlow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background arc */}
      <circle
        cx={cx} cy={cy} r={R}
        fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="10"
        strokeDasharray={`${arcLen} ${gap}`}
        strokeLinecap="round"
        transform={`rotate(150 ${cx} ${cy})`}
      />

      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={R}
        fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(150 ${cx} ${cy})`}
        filter="url(#gaugeGlow)"
        style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.5s' }}
      />

      {/* Tick marks */}
      {[0, 30, 60, 90, 120].map((val, i) => {
        const angle = (150 + (val / 120) * 240) * (Math.PI / 180);
        const r1 = R + 10, r2 = R + 16;
        return (
          <line key={i}
            x1={cx + r1 * Math.cos(angle)} y1={cy + r1 * Math.sin(angle)}
            x2={cx + r2 * Math.cos(angle)} y2={cy + r2 * Math.sin(angle)}
            stroke={val <= egfr ? color : '#334155'} strokeWidth="1.5"
            opacity={val <= egfr ? 0.7 : 0.3}
          />
        );
      })}

      {/* Center value */}
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color}
        fontSize="26" fontFamily="Orbitron, sans-serif" fontWeight="700">
        {egfr}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#64748b" fontSize="8"
        fontFamily="Inter, sans-serif">
        mL/min/1.73m²
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill={color} fontSize="10"
        fontFamily="Orbitron, sans-serif" fontWeight="600" opacity="0.85">
        {ckdStage.stage}
      </text>
    </svg>
  );
}

/* ── Metric card ─────────────────────────────────── */
function MetricCard({ label, value, unit, status, subtext, large }) {
  const colors = {
    safe:     { ring: 'border-emerald-400/25', val: 'text-emerald-400', bg: 'bg-emerald-400/6', dot: 'bg-emerald-400', shadow: 'shadow-green-glow' },
    warning:  { ring: 'border-amber-400/30',   val: 'text-amber-400',   bg: 'bg-amber-400/6',   dot: 'bg-amber-400',   shadow: 'shadow-amber-glow' },
    critical: { ring: 'border-red-400/35',      val: 'text-red-400',     bg: 'bg-red-400/8',     dot: 'bg-red-400',     shadow: 'shadow-red-glow' },
    neutral:  { ring: 'border-cyan-500/20',     val: 'text-cyan-300',    bg: 'bg-cyan-500/6',    dot: 'bg-cyan-400',    shadow: '' },
  };
  const c = colors[status] || colors.neutral;

  return (
    <div className={`rounded-xl p-3 border ${c.ring} ${c.bg} ${c.shadow} transition-all duration-500`}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</span>
        <span className={`w-1.5 h-1.5 rounded-full status-dot ${c.dot}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-orbitron font-bold ${c.val} ${large ? 'text-2xl' : 'text-lg'} value-transition`}>
          {value}
        </span>
        <span className="text-[10px] text-slate-600">{unit}</span>
      </div>
      {subtext && <p className="text-[10px] text-slate-500 mt-0.5">{subtext}</p>}
    </div>
  );
}

/* ── Consistency warning item ────────────────────── */
function ConsistencyItem({ item }) {
  const isCritical = item.severity === 'critical';
  return (
    <div className={`flex gap-2.5 px-3 py-2 rounded-lg ${
      isCritical
        ? 'bg-violet-500/8 border border-violet-400/20'
        : 'bg-purple-500/6 border border-purple-400/15'
    }`}>
      <GitBranch size={13} className={`${isCritical ? 'text-violet-400' : 'text-purple-400'} flex-shrink-0 mt-0.5`} />
      <div>
        <p className={`text-[10px] font-semibold ${isCritical ? 'text-violet-400' : 'text-purple-400'} mb-0.5`}>
          {item.category}
        </p>
        <p className="text-[11px] text-slate-400 leading-snug">{item.message}</p>
        {item.ref && (
          <p className="text-[9px] text-slate-600 mt-1 italic">{item.ref}</p>
        )}
      </div>
    </div>
  );
}

/* ── Risk warning item ───────────────────────────── */
function RiskItem({ risk }) {
  if (risk.type === 'critical') {
    return (
      <div className="flex gap-2.5 px-3 py-2 rounded-lg bg-red-500/8 border border-red-400/20 slide-in-right">
        <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-semibold text-red-400 mb-0.5">{risk.category}</p>
          <p className="text-[11px] text-slate-400 leading-snug">{risk.message}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-400/20">
      <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[10px] font-semibold text-amber-400 mb-0.5">{risk.category}</p>
        <p className="text-[11px] text-slate-400 leading-snug">{risk.message}</p>
      </div>
    </div>
  );
}

/* ── Stage severity bar chart ────────────────────── */
const STAGE_BARS = [
  { name: 'S1', threshold: 90,  color: '#00d4ff' },
  { name: 'S2', threshold: 60,  color: '#10b981' },
  { name: 'S3A',threshold: 45,  color: '#facc15' },
  { name: 'S3B',threshold: 30,  color: '#fb923c' },
  { name: 'S4', threshold: 15,  color: '#f87171' },
  { name: 'S5', threshold: 0,   color: '#ef4444' },
];

const BarTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-2 py-1 text-[10px]">
      <span className="text-slate-300">{payload[0].payload.name}</span>
    </div>
  );
};

/* ── Main ────────────────────────────────────────── */
export default function ResultsPanel({ results, patientData, relationshipData }) {
  const { egfr, ckdStage, risks, consistency = [] } = results;
  const [showRefs,      setShowRefs]      = useState(false);
  const [showInfluence, setShowInfluence] = useState(false);
  const [showRelationships, setShowRelationships] = useState(true);

  const getStatus = (val, warnLow, warnHigh, critLow, critHigh) => {
    if ((critHigh && val >= critHigh) || (critLow && val <= critLow)) return 'critical';
    if ((warnHigh && val >= warnHigh) || (warnLow && val <= warnLow)) return 'warning';
    return 'safe';
  };

  const egfrStatus     = egfr < 30 ? 'critical' : egfr < 60 ? 'warning' : 'safe';
  const kStatus        = getStatus(patientData.potassium, 3.5, 5.0, 2.5, 5.5);
  const mapStatus      = getStatus(patientData.map, 65, 100, 55, 115);
  const uoStatus       = patientData.urineOutput < 400 ? 'critical' :
                         patientData.urineOutput < 800 ? 'warning' : 'safe';
  const creatStatus    = patientData.creatinine > 2.0 ? 'warning' :
                         patientData.creatinine > 5.0 ? 'critical' : 'safe';

  // Stage severity bar data
  const barData = STAGE_BARS.map(s => ({
    name: s.name,
    val: s.threshold === 0 ? 5 : Math.max(0, Math.min(s.threshold, 30)),
    active: egfr >= s.threshold && (s === STAGE_BARS[STAGE_BARS.length - 1] || egfr < (STAGE_BARS[STAGE_BARS.indexOf(s) - 1]?.threshold ?? 999)),
    color: s.color,
  }));

  const riskLevel = risks.some(r => r.type === 'critical') ? 'critical'
                  : risks.some(r => r.type === 'warning')  ? 'warning' : 'safe';

  const riskLabels = { safe: 'Low', warning: 'Medium', critical: 'High' };
  const pairwise = relationshipData?.pairwise ?? [];
  const bnEdges = relationshipData?.bayesianNetwork?.edges ?? [];
  const trendSeries = relationshipData?.trends ?? [];
  const activeTrend = trendSeries[0] ?? null;
  const equation = relationshipData?.egfrModel?.equation;

  return (
    <div
      className="w-[280px] flex-shrink-0 flex flex-col border-l border-cyan-500/10 overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#060e1c 0%,#04091a 100%)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-cyan-500/10 flex-shrink-0 flex items-center justify-between">
        <div>
          <p className="font-orbitron text-xs font-bold text-cyan-400/80 tracking-wider uppercase">Predicted Outcomes</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Real-time analysis</p>
        </div>
        <button className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors py-1 px-2 rounded border border-transparent hover:border-cyan-500/20">
          <Download size={10} />Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* eGFR gauge */}
        <div className="px-3 pt-3">
          <div className="glass-card rounded-xl p-2 border-glow">
            <div className="w-36 mx-auto">
              <EGFRGauge egfr={egfr} ckdStage={ckdStage} />
            </div>
            <div className={`mx-3 mb-2 py-1.5 rounded-lg text-center text-xs font-semibold ${ckdStage.bgClass} ${ckdStage.colorClass} border ${ckdStage.borderClass}`}>
              {ckdStage.label}
            </div>
          </div>
        </div>

        {/* Metric cards grid */}
        <div className="px-3 pt-3 grid grid-cols-2 gap-2">
          <MetricCard
            label="Risk Level" value={riskLabels[riskLevel]} unit=""
            status={riskLevel} subtext={`${risks.length} flag${risks.length !== 1 ? 's' : ''} active`}
          />
          <MetricCard
            label="Creatinine" value={patientData.creatinine} unit="mg/dL"
            status={creatStatus} subtext={patientData.creatinine > 1.3 ? 'Elevated' : 'Normal'}
          />
          <MetricCard
            label="Potassium" value={patientData.potassium} unit="mEq/L"
            status={kStatus}
            subtext={patientData.potassium > 5.5 ? 'Hyperkalemia' : patientData.potassium < 3.5 ? 'Hypokalemia' : 'Normal'}
          />
          <MetricCard
            label="MAP" value={patientData.map} unit="mmHg"
            status={mapStatus} subtext={patientData.map > 100 ? 'Elevated' : 'Normal'}
          />
          <MetricCard
            label="Urine Output" value={patientData.urineOutput} unit="mL/d"
            status={uoStatus} subtext={patientData.urineOutput < 500 ? 'Oliguria' : 'Adequate'}
          />
          <MetricCard
            label="GFR Score" value={egfr} unit="mL/min"
            status={egfrStatus} subtext={ckdStage.shortLabel}
          />
        </div>

        {/* Stage severity bars */}
        <div className="px-3 pt-3">
          <div className="glass-card rounded-xl p-3">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Stage Severity Indicator</p>
            <ResponsiveContainer width="100%" height={48}>
              <BarChart data={barData} barCategoryGap="25%">
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 8 }} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTip />} cursor={false} />
                <Bar dataKey="val" radius={[2, 2, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      opacity={egfr >= STAGE_BARS[i].threshold ? 0.85 : 0.18}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[8px] text-slate-600 mt-1 px-1">
              <span>← Failure</span>
              <span>Normal →</span>
            </div>
          </div>
        </div>

        {/* Risk assessment */}
        <div className="px-3 pt-3">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2 px-1">Risk Assessment</p>
          {risks.length === 0 ? (
            <div className="flex gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-400/6 border border-emerald-400/20">
              <CheckCircle size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-300">All parameters within acceptable range. No acute risk factors identified.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {risks.map((r, i) => <RiskItem key={i} risk={r} />)}
            </div>
          )}
        </div>

        {/* Parameter Consistency */}
        <div className="px-3 pt-3 pb-4">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <GitBranch size={9} className="text-purple-400/70" />
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">Parameter Consistency</p>
            {consistency.length > 0 && (
              <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                consistency.some(c => c.severity === 'critical')
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-purple-500/15 text-purple-400'
              }`}>
                {consistency.length}
              </span>
            )}
          </div>

          {consistency.length === 0 ? (
            <div className="flex gap-2.5 px-3 py-2.5 rounded-lg bg-purple-400/5 border border-purple-400/15">
              <CheckCircle size={13} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400">All parameters are physiologically consistent with each other.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {consistency.map((c, i) => <ConsistencyItem key={i} item={c} />)}
            </div>
          )}

          {/* Collapsible references */}
          <button
            onClick={() => setShowRefs(r => !r)}
            className="mt-3 w-full flex items-center gap-1.5 text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            {showRefs ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            <span>Clinical references ({CLINICAL_REFERENCES.length})</span>
          </button>
          {showRefs && (
            <div className="mt-2 space-y-1.5 border-l-2 border-purple-500/20 pl-2.5">
              {CLINICAL_REFERENCES.map(r => (
                <div key={r.id}>
                  <p className="text-[9px] text-purple-400/70 font-semibold">{r.id} — {r.note}</p>
                  <p className="text-[9px] text-slate-600 italic">{r.citation}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature Relationship Map */}
        <div className="px-3 pt-1 pb-4">
          <button
            onClick={() => setShowInfluence(v => !v)}
            className="w-full flex items-center gap-1.5 text-[9px] text-slate-600 hover:text-slate-400 transition-colors mb-2"
          >
            {showInfluence ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            <span className="uppercase tracking-widest">Feature Relationship Map</span>
            <span className="ml-auto text-[8px] text-purple-500/60">{INFLUENCE_MAP.length} edges</span>
          </button>

          {showInfluence && (
            <div className="rounded-xl border border-purple-500/15 bg-purple-500/4 overflow-hidden">
              <div className="grid grid-cols-[72px_14px_72px_1fr] gap-x-1 px-2 py-1.5 border-b border-purple-500/10">
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">From</span>
                <span />
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">To</span>
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">Effect</span>
              </div>
              {INFLUENCE_MAP.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[72px_14px_72px_1fr] gap-x-1 px-2 py-1.5 items-start
                             border-b border-purple-500/8 last:border-0 hover:bg-purple-500/6 transition-colors"
                >
                  <span className="text-[9px] text-cyan-300/80 font-medium truncate">{row.from}</span>
                  <span className={`text-[10px] font-bold leading-none pt-0.5 ${row.arrow === '↑' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {row.arrow}
                  </span>
                  <span className="text-[9px] text-slate-300 truncate">{row.to}</span>
                  <span className="text-[8px] text-slate-500 leading-snug">
                    {row.note}
                    <span className="ml-1 text-purple-500/60">[{row.ref}]</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Research relationship workspace */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setShowRelationships(v => !v)}
            className="w-full flex items-center gap-1.5 text-[9px] text-slate-600 hover:text-slate-400 transition-colors mb-2"
          >
            {showRelationships ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            <span className="uppercase tracking-widest">Research Relationships</span>
            <span className="ml-auto text-[8px] text-cyan-500/60">
              {pairwise.length ? `${pairwise.length} pairs` : 'backend offline'}
            </span>
          </button>

          {showRelationships && (
            <div className="space-y-2">
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/4 p-2.5">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">eGFR simulation equation</p>
                <p className="text-[10px] text-cyan-300 leading-relaxed break-words">
                  {equation || 'Start backend with `npm run dev:server` to load model equation.'}
                </p>
              </div>

              {activeTrend?.points?.length > 0 && (
                <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/4 p-2.5">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Feature-to-eGFR trend chart</p>
                  <p className="text-[9px] text-cyan-300/80 mb-1">{activeTrend.feature} → eGFR</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={activeTrend.points} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(71,85,105,0.18)" strokeDasharray="3 3" />
                      <XAxis dataKey="x" type="number" stroke="#64748b" tick={{ fontSize: 8 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                      <Tooltip />
                      <Line
                        dataKey="y"
                        name="eGFR"
                        stroke="#00d4ff"
                        strokeWidth={1.8}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {bnEdges.length > 0 && (
                <div className="rounded-xl border border-purple-500/15 bg-purple-500/4 overflow-hidden">
                  <div className="px-2.5 py-1.5 border-b border-purple-500/10 text-[8px] text-slate-500 uppercase tracking-wider">
                    Bayesian network edges ({bnEdges.length})
                  </div>
                  <div className="max-h-28 overflow-y-auto">
                    {bnEdges.map((edge, idx) => (
                      <div key={`${edge.from}-${edge.to}-${idx}`} className="px-2.5 py-1.5 border-b border-purple-500/8 last:border-0 text-[9px] text-slate-300">
                        <span className="text-cyan-300">{edge.from}</span> → <span className="text-purple-300">{edge.to}</span>
                        <span className="text-slate-500 ml-1">w={edge.weight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pairwise.length > 0 && (
                <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/4 overflow-hidden">
                  <div className="grid grid-cols-[48px_1fr_1fr_52px_1.6fr] gap-x-1 px-2 py-1.5 border-b border-cyan-500/10">
                    <span className="text-[8px] text-slate-600 uppercase tracking-wider">#</span>
                    <span className="text-[8px] text-slate-600 uppercase tracking-wider">Feature A</span>
                    <span className="text-[8px] text-slate-600 uppercase tracking-wider">Feature B</span>
                    <span className="text-[8px] text-slate-600 uppercase tracking-wider">Weight</span>
                    <span className="text-[8px] text-slate-600 uppercase tracking-wider">Equation</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {pairwise.map((row, idx) => (
                      <div key={row.id} className="grid grid-cols-[48px_1fr_1fr_52px_1.6fr] gap-x-1 px-2 py-1.5 border-b border-cyan-500/8 last:border-0">
                        <span className="text-[9px] text-slate-500">{idx + 1}</span>
                        <span className="text-[9px] text-cyan-300/90">{row.featureA}</span>
                        <span className="text-[9px] text-cyan-300/90">{row.featureB}</span>
                        <span className="text-[9px] text-slate-300">{row.relationshipStrength}</span>
                        <span className="text-[8px] text-slate-500 leading-snug">{row.equation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
