import { useEffect, useState, useRef } from 'react';

/* ── Derived renal metrics ───────────────────────── */
function getMetrics(egfr, map = 88) {
  const rbf = Math.round(Math.max(80, Math.min(1400, egfr * 9.5 + 50)));
  const irp = Math.round(Math.max(5, Math.min(28, map / 6.2)));
  return { rbf, irp };
}

/* ── Hex → "r,g,b" string ───────────────────────── */
function hexRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length < 6) return '0,212,255';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/* ── Pulse engine ────────────────────────────────── */
const PULSE_PHASES = [
  { intensity: 0.30, duration: 900 },
  { intensity: 1.00, duration: 280 },
  { intensity: 0.05, duration: 380 },
  { intensity: 0.30, duration: 640 },
];

function usePulse() {
  const [intensity, setIntensity] = useState(0.3);
  const phaseRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const p = PULSE_PHASES[phaseRef.current];
      setIntensity(p.intensity);
      timerRef.current = setTimeout(() => {
        phaseRef.current = (phaseRef.current + 1) % PULSE_PHASES.length;
        tick();
      }, p.duration);
    };
    tick();
    return () => clearTimeout(timerRef.current);
  }, []);

  return intensity;
}

/* ── Component ───────────────────────────────────── */
export default function KidneyVisualization({ egfr, ckdStage, patientData }) {
  const color     = ckdStage.gaugeColor;
  const rgb       = hexRgb(color);
  const intensity = usePulse();
  const { rbf, irp } = getMetrics(egfr, patientData?.map);

  const transitionMs = intensity > 0.5 ? 220 : 380;

  const glowFilter = [
    `drop-shadow(0 0 ${(8  + intensity * 28).toFixed(1)}px rgba(${rgb},${(0.4 + intensity * 0.55).toFixed(2)}))`,
    `drop-shadow(0 0 ${(20 + intensity * 55).toFixed(1)}px rgba(${rgb},${(0.15 + intensity * 0.22).toFixed(2)}))`,
    `drop-shadow(0 0 ${(1  + intensity * 90).toFixed(1)}px rgba(${rgb},${(0.05 + intensity * 0.10).toFixed(2)}))`,
  ].join(' ');

  const overlayOpacity = (0.10 + intensity * 0.18).toFixed(3);
  const bgGlowOpacity  = (0.07 + intensity * 0.13).toFixed(3);

  return (
    <div className="relative flex flex-col items-center gap-2">

      {/* ── Outer ring + image wrapper ── */}
      <div className="relative flex items-center justify-center" style={{ width: 248, height: 248 }}>

        {/* Expanding pulse rings */}
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`absolute inset-0 rounded-full border pulse-ring${i > 0 ? `-${i + 1}` : ''}`}
            style={{ borderColor: `rgba(${rgb},${0.45 - i * 0.1})` }}
          />
        ))}

        {/* Background ambient glow (breathes with pulse) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 80% at 50% 50%, rgba(${rgb},${bgGlowOpacity}) 0%, transparent 72%)`,
            transition: `background ${transitionMs}ms ease`,
          }}
        />

        {/* ── Image + effect layers ── */}
        <div
          className="relative overflow-hidden rounded-full"
          style={{
            width: 228, height: 228,
            filter: glowFilter,
            transition: `filter ${transitionMs}ms ease`,
          }}
        >
          {/* 3D kidney photo */}
          <img
            src="/kidney.png"
            alt="Kidney Digital Twin"
            className="kidney-breath w-full h-full object-cover"
            style={{ borderRadius: '50%' }}
          />

          {/* CKD color tint overlay (screen blend — adds hue without hiding image) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 75% 65% at 48% 38%, rgba(${rgb},${overlayOpacity}) 0%, transparent 65%)`,
              mixBlendMode: 'screen',
              transition: `background ${transitionMs}ms ease`,
              borderRadius: '50%',
            }}
          />

          {/* Scan line (uses CKD color) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: '50%' }}>
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                height: 2,
                background: `linear-gradient(90deg, transparent 0%, rgba(${rgb},0.85) 40%, rgba(${rgb},0.85) 60%, transparent 100%)`,
                animation: 'scanLine 3.2s linear infinite',
                boxShadow: `0 0 8px rgba(${rgb},0.6)`,
              }}
            />
          </div>

          {/* Holographic grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(${rgb},0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(${rgb},0.04) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              borderRadius: '50%',
            }}
          />

          {/* Edge vignette to blend into dark background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 55%, rgba(3,8,18,0.85) 100%)',
              borderRadius: '50%',
            }}
          />
        </div>

        {/* Status label */}
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 font-orbitron text-[7px] tracking-widest uppercase opacity-60"
          style={{ color }}
        >
          RENAL SIM ACTIVE
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="flex gap-2 w-full px-1">
        <div
          className="flex-1 glass-card rounded-xl p-2.5 text-center"
          style={{ borderColor: `rgba(${rgb},0.28)`, borderWidth: 1, borderStyle: 'solid' }}
        >
          <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-1">Blood Flow</p>
          <p className="font-orbitron text-sm font-bold" style={{ color }}>{rbf.toLocaleString()}</p>
          <p className="text-[8px] text-slate-600">mL/min</p>
        </div>
        <div
          className="flex-1 glass-card rounded-xl p-2.5 text-center"
          style={{ borderColor: `rgba(${rgb},0.28)`, borderWidth: 1, borderStyle: 'solid' }}
        >
          <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-1">Intrarenal P.</p>
          <p className="font-orbitron text-sm font-bold" style={{ color }}>{irp}</p>
          <p className="text-[8px] text-slate-600">mmHg</p>
        </div>
      </div>
    </div>
  );
}
