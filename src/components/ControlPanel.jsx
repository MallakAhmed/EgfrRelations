import React from 'react';
import { Play, Zap, GitBranch, ChevronRight, CheckCheck } from 'lucide-react';
import { PRESETS } from '../utils/egfrCalculation.js';

// ─────────────────────────────────────────────────────────────────────────────
// SliderRow
//
// Renders a labelled range slider with:
//   • Filled progress bar (cyan / amber / red based on clinical thresholds)
//   • Violet "expected band" overlay — where the Bayesian network expects
//     this value to fall given the current values of all other features.
//     Narrow band = tight expectation.  Wide band = high uncertainty.
// ─────────────────────────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step, unit, onChange,
  warnHigh, warnLow, dangerHigh, dangerLow,
  expectedMin, expectedMax,           // from Bayesian posterior
}) {
  const progress = ((value - min) / (max - min)) * 100;

  const getColor = () => {
    if ((dangerHigh && value >= dangerHigh) || (dangerLow && value <= dangerLow)) return '#ef4444';
    if ((warnHigh  && value >= warnHigh)  || (warnLow  && value <= warnLow))  return '#f59e0b';
    return '#00d4ff';
  };
  const color = getColor();

  // Convert expected range to % positions on the track
  const bandLeft  = expectedMin != null
    ? Math.max(0, Math.min(100, ((expectedMin - min) / (max - min)) * 100))
    : null;
  const bandWidth = (expectedMin != null && expectedMax != null)
    ? Math.max(0, Math.min(100 - bandLeft, ((expectedMax - expectedMin) / (max - min)) * 100))
    : null;

  // Is the current value inside the expected band?
  const inBand = expectedMin != null
    ? value >= expectedMin && value <= expectedMax
    : true;

  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1.5">
          {/* Small dot: green if in band, violet if outside */}
          {expectedMin != null && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: inBand ? '#34d399' : '#a78bfa' }}
              title={inBand ? 'Within expected range' : 'Outside network expectation'}
            />
          )}
          <span className="font-orbitron text-sm font-semibold" style={{ color }}>
            {value}
            <span className="text-[10px] font-normal text-slate-500 ml-1">{unit}</span>
          </span>
        </div>
      </div>

      <div className="relative h-3 flex items-center">
        {/* Track background */}
        <div className="absolute left-0 right-0 h-[3px] rounded-full bg-slate-700/70" />

        {/* Violet expected-range band (Bayesian posterior ±1.5σ) */}
        {bandLeft != null && bandWidth != null && (
          <div
            className="absolute h-[5px] rounded-full pointer-events-none"
            style={{
              left:    `${bandLeft}%`,
              width:   `${bandWidth}%`,
              background: 'linear-gradient(90deg, #7c3aed55, #a78bfa88, #7c3aed55)',
            }}
          />
        )}

        {/* Filled progress */}
        <div
          className="absolute left-0 h-[3px] rounded-full transition-all duration-150"
          style={{ width: `${progress}%`, background: color, boxShadow: `0 0 5px ${color}70` }}
        />

        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="slider"
        />
      </div>

      {/* Expected range label */}
      {expectedMin != null && expectedMax != null && (
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-purple-500/50">
            expected {typeof expectedMin === 'number' ? expectedMin.toFixed(expectedMin < 10 ? 1 : 0) : expectedMin}
            –{typeof expectedMax === 'number' ? expectedMax.toFixed(expectedMax < 10 ? 1 : 0) : expectedMax} {unit}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NumInput
// ─────────────────────────────────────────────────────────────────────────────

function NumInput({ label, value, min, max, step, unit, onChange, expectedMin, expectedMax }) {
  const inBand = expectedMin != null ? value >= expectedMin && value <= expectedMax : true;
  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>
        {expectedMin != null && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: inBand ? '#34d399' : '#a78bfa' }}
            title={inBand ? 'Within expected range' : 'Outside network expectation'}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value) || min)}
          className="w-full px-3 py-1.5 rounded-lg text-sm font-orbitron text-cyan-300 font-medium
                     bg-slate-800/60 border border-cyan-500/15 focus:border-cyan-400/40 focus:outline-none
                     focus:ring-1 focus:ring-cyan-400/20 transition-all"
        />
        <span className="text-[11px] text-slate-500 flex-shrink-0">{unit}</span>
      </div>
      {expectedMin != null && expectedMax != null && (
        <p className="text-[8px] text-purple-500/50 mt-0.5">
          expected {Math.round(expectedMin)}–{Math.round(expectedMax)} {unit}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <span className="w-1 h-3 rounded-full bg-cyan-400/70" />
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-cyan-500/8" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PropagationSuggestions
//
// Appears below the last-changed slider whenever the Bayesian network detects
// that other features should be updated to remain physiologically consistent.
// The user can apply each suggestion individually or all at once.
// ─────────────────────────────────────────────────────────────────────────────

function PropagationSuggestions({ suggestions, onApply, onApplyAll }) {
  if (!suggestions || suggestions.length === 0) return null;

  const hasCritical = suggestions.some(s => s.severity === 'critical');

  return (
    <div className={`mb-4 rounded-xl border p-3 ${
      hasCritical
        ? 'bg-violet-500/10 border-violet-400/30'
        : 'bg-purple-500/8  border-purple-400/20'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <GitBranch size={11} className="text-violet-400" />
        <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">
          Network Suggests
        </span>
        <span className="ml-auto text-[9px] text-slate-500">
          {suggestions.length} related feature{suggestions.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Individual suggestions */}
      <div className="space-y-2 mb-2.5">
        {suggestions.map(s => (
          <div key={s.feature} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-300 font-medium">{s.label}</p>
              <p className="text-[9px] text-slate-500 leading-snug mt-0.5 pr-1">{s.reason}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-slate-500">{s.currentValue} {s.unit}</span>
                <ChevronRight size={9} className="text-slate-600" />
                <span className={`text-[10px] font-semibold ${
                  s.severity === 'critical' ? 'text-violet-300' : 'text-purple-300'
                }`}>
                  {s.suggestedValue} {s.unit}
                </span>
                <span className="text-[8px] text-slate-600 ml-0.5">
                  ({s.absZ.toFixed(1)}σ off)
                </span>
              </div>
            </div>
            <button
              onClick={() => onApply(s.feature, s.suggestedValue)}
              className="flex-shrink-0 mt-0.5 text-[9px] px-2 py-1 rounded-lg
                         bg-violet-500/20 text-violet-300 border border-violet-400/25
                         hover:bg-violet-500/35 hover:text-white transition-all"
            >
              Apply
            </button>
          </div>
        ))}
      </div>

      {/* Apply all */}
      {suggestions.length > 1 && (
        <button
          onClick={onApplyAll}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg
                     bg-violet-500/20 border border-violet-400/30 text-violet-200
                     text-[10px] font-semibold hover:bg-violet-500/35 transition-all"
        >
          <CheckCheck size={10} />
          Apply All Suggestions
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ControlPanel (main export)
// ─────────────────────────────────────────────────────────────────────────────

export default function ControlPanel({
  data,
  onChange,
  onRun,
  isSimulating,
  posteriors = {},
  suggestions = [],
  onApplySuggestion,
  onApplyAllSuggestions,
}) {
  // set(key)(val) — notifies parent of both the new data AND which key changed
  const set = key => val => onChange({ ...data, [key]: val }, key);

  const applyPreset = key => {
    onChange({ ...data, ...PRESETS[key] }, null);
  };

  // Shorthand: get expected range for a feature from posteriors
  const exp = key => posteriors[key]
    ? { expectedMin: posteriors[key].expectedMin, expectedMax: posteriors[key].expectedMax }
    : {};

  return (
    <div
      className="w-[270px] flex-shrink-0 flex flex-col border-r border-cyan-500/10 overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#060e1c 0%,#05091a 100%)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-cyan-500/10 flex-shrink-0">
        <p className="font-orbitron text-xs font-bold text-cyan-400/80 tracking-wider uppercase">
          Simulation Controls
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">Patient: ID-8842 (Marcus Thorne)</p>
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* ── Bayesian propagation suggestions ─────────────────────────── */}
        <PropagationSuggestions
          suggestions={suggestions}
          onApply={onApplySuggestion}
          onApplyAll={onApplyAllSuggestions}
        />

        {/* ── Patient Factors ───────────────────────────────────────────── */}
        <SectionHeader>Patient Factors</SectionHeader>

        <SliderRow
          label="Age" value={data.age} min={18} max={90} step={1} unit="yrs"
          onChange={set('age')}
          warnHigh={65} dangerHigh={80}
        />

        <div className="mb-3.5">
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block mb-1.5">Gender</span>
          <div className="flex gap-2">
            {['male', 'female'].map(g => (
              <button
                key={g}
                onClick={() => set('gender')(g)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200
                  ${data.gender === g
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                    : 'bg-slate-800/50 border border-slate-600/30 text-slate-400 hover:border-cyan-500/20'
                  }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <SliderRow
          label="Weight" value={data.weight} min={30} max={160} step={1} unit="kg"
          onChange={set('weight')}
        />

        {/* ── Feature Relationship Inputs (Research Model) ─────────────── */}
        <SectionHeader>Research Features</SectionHeader>

        <SliderRow
          label="BMI" value={data.bmi} min={16} max={45} step={0.1} unit="kg/m²"
          onChange={set('bmi')}
        />

        <SliderRow
          label="HDL Cholesterol" value={data.hdlCholesterol} min={20} max={90} step={1} unit="mg/dL"
          onChange={set('hdlCholesterol')}
        />

        <SliderRow
          label="Total Cholesterol" value={data.totalCholesterol} min={100} max={320} step={1} unit="mg/dL"
          onChange={set('totalCholesterol')}
        />

        <SliderRow
          label="Hemoglobin" value={data.hemoglobin} min={7} max={18} step={0.1} unit="g/dL"
          onChange={set('hemoglobin')}
        />

        <div className="mb-3.5">
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block mb-1.5">DMI Episode</span>
          <div className="flex gap-2">
            {[0, 1].map(v => (
              <button
                key={v}
                onClick={() => set('dmiEpisode')(v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                  ${data.dmiEpisode === v
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                    : 'bg-slate-800/50 border border-slate-600/30 text-slate-400 hover:border-cyan-500/20'
                  }`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3.5">
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block mb-1.5">Hypertension</span>
          <div className="flex gap-2">
            {[0, 1].map(v => (
              <button
                key={v}
                onClick={() => set('hypertension')(v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                  ${data.hypertension === v
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                    : 'bg-slate-800/50 border border-slate-600/30 text-slate-400 hover:border-cyan-500/20'
                  }`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3.5">
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block mb-1.5">Diabetes</span>
          <div className="flex gap-2">
            {[0, 1].map(v => (
              <button
                key={v}
                onClick={() => set('diabetes')(v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                  ${data.diabetes === v
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                    : 'bg-slate-800/50 border border-slate-600/30 text-slate-400 hover:border-cyan-500/20'
                  }`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Renal Markers ─────────────────────────────────────────────── */}
        <SectionHeader>Renal Markers</SectionHeader>

        <SliderRow
          label="Serum Creatinine" value={data.creatinine} min={0.4} max={15} step={0.1} unit="mg/dL"
          onChange={set('creatinine')}
          warnHigh={1.4} dangerHigh={2.5}
          {...exp('creatinine')}
        />

        <SliderRow
          label="Potassium (K⁺)" value={data.potassium} min={2.0} max={8.0} step={0.1} unit="mEq/L"
          onChange={set('potassium')}
          warnLow={3.5} warnHigh={5.0} dangerHigh={5.5} dangerLow={2.5}
          {...exp('potassium')}
        />

        <NumInput
          label="Urine Output" value={data.urineOutput} min={50} max={4000} step={50} unit="mL/day"
          onChange={set('urineOutput')}
          {...exp('urineOutput')}
        />

        {/* ── Hemodynamics ──────────────────────────────────────────────── */}
        <SectionHeader>Hemodynamics</SectionHeader>

        <SliderRow
          label="Mean Art. Pressure" value={data.map} min={40} max={150} step={1} unit="mmHg"
          onChange={set('map')}
          warnLow={65} warnHigh={100} dangerLow={55} dangerHigh={115}
          {...exp('map')}
        />

        {/* ── Scenario Presets ──────────────────────────────────────────── */}
        <SectionHeader>Scenario Presets</SectionHeader>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className="py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-300
                         bg-slate-800/55 border border-slate-600/25
                         hover:border-cyan-500/30 hover:bg-cyan-500/8 hover:text-cyan-300
                         transition-all duration-200 text-center"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <div className="mb-3 px-1 space-y-1">
          <p className="text-[9px] text-slate-600 uppercase tracking-widest">Slider legend</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-[4px] rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed55,#a78bfa88,#7c3aed55)' }} />
            <span className="text-[9px] text-slate-500">Violet band = Bayesian expected range (±1.5σ)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="text-[9px] text-slate-500">Green dot = within expected range</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
            <span className="text-[9px] text-slate-500">Violet dot = outside network expectation</span>
          </div>
        </div>
      </div>

      {/* Run button */}
      <div className="px-4 pb-4 pt-2 border-t border-cyan-500/10 flex-shrink-0">
        <button
          onClick={onRun}
          disabled={isSimulating}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-orbitron text-sm font-bold
                      transition-all duration-300 group
                      ${isSimulating
                        ? 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-400/60 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan-500/25 to-blue-600/20 border border-cyan-400/45 text-cyan-300 hover:from-cyan-500/35 hover:to-blue-600/30 hover:border-cyan-400/70 hover:text-white'
                      }
                      shadow-cyan-glow`}
        >
          {isSimulating
            ? <><span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />Processing...</>
            : <><Play size={14} className="group-hover:scale-110 transition-transform" fill="currentColor" />Run Simulation</>
          }
        </button>
        <p className="text-center text-[10px] text-slate-600 mt-2">
          <Zap size={9} className="inline mr-1 text-cyan-500/50" />
          Live recalculation on each input change
        </p>
      </div>
    </div>
  );
}
