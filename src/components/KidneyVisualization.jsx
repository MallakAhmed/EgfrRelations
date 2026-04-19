import { useEffect, useState, useRef } from 'react';

/* ── Derived renal metrics ───────────────────────── */
function getMetrics(egfr, map = 88) {
  // Renal blood flow approximation (normal ~1100–1200 mL/min)
  const rbf = Math.round(Math.max(80, Math.min(1400, egfr * 9.5 + 50)));
  // Intrarenal pressure approximation (normal 10–18 mmHg)
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

/* ── Pulse engine (glow on / off) ────────────────── */
const PULSE_PHASES = [
  { intensity: 0.30, duration: 900 },   // resting glow
  { intensity: 1.00, duration: 280 },   // PEAK — bright flash
  { intensity: 0.05, duration: 380 },   // dim / off
  { intensity: 0.30, duration: 640 },   // return to rest
];

function usePulse() {
  const [intensity, setIntensity] = useState(0.3);
  const phaseRef  = useRef(0);
  const timerRef  = useRef(null);

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

  // Dynamic glow style driven by pulse engine
  const r1 = (4  + intensity * 22).toFixed(1);
  const r2 = (2  + intensity * 50).toFixed(1);
  const r3 = (1  + intensity * 80).toFixed(1);
  const o1 = intensity.toFixed(3);
  const o2 = (intensity * 0.55).toFixed(3);
  const o3 = (intensity * 0.25).toFixed(3);
  const transitionMs = intensity > 0.5 ? 220 : 380;

  const glowFilter = `drop-shadow(0 0 ${r1}px rgba(${rgb},${o1})) drop-shadow(0 0 ${r2}px rgba(${rgb},${o2})) drop-shadow(0 0 ${r3}px rgba(${rgb},${o3}))`;

  return (
    <div className="relative w-full">
      {/* Pulse glow overlay (background radial, scales with intensity) */}
      <div
        className="absolute inset-0 pointer-events-none rounded-full"
        style={{
          background: `radial-gradient(ellipse 70% 70% at 50% 50%, rgba(${rgb},${(intensity * 0.18).toFixed(3)}) 0%, transparent 75%)`,
          transition: `background ${transitionMs}ms ease`,
        }}
      />

      <svg
        viewBox="0 0 400 315"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full relative z-10"
        style={{
          filter: glowFilter,
          transition: `filter ${transitionMs}ms ease`,
        }}
      >
        <defs>
          {/* Shared glow filter for internal elements */}
          <filter id="ig" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
            <feFlood floodColor={color} floodOpacity="0.75" result="c" />
            <feComposite in="c" in2="b" operator="in" result="cg" />
            <feMerge><feMergeNode in="cg" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Softer glow for details */}
          <filter id="sg" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
            <feFlood floodColor={color} floodOpacity="0.6" result="c" />
            <feComposite in="c" in2="b" operator="in" result="cg" />
            <feMerge><feMergeNode in="cg" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* LEFT kidney fill — lit from top-left */}
          <radialGradient id="lk" cx="32%" cy="28%" r="68%">
            <stop offset="0%"   stopColor={color} stopOpacity="0.42" />
            <stop offset="35%"  stopColor="#041628" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#020c1c" stopOpacity="1" />
          </radialGradient>

          {/* RIGHT kidney fill — lit from top-right */}
          <radialGradient id="rk" cx="68%" cy="28%" r="68%">
            <stop offset="0%"   stopColor={color} stopOpacity="0.42" />
            <stop offset="35%"  stopColor="#041628" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#020c1c" stopOpacity="1" />
          </radialGradient>

          {/* BG disc gradient */}
          <radialGradient id="bg" cx="50%" cy="46%" r="52%">
            <stop offset="0%"   stopColor="#061c32" stopOpacity="1" />
            <stop offset="100%" stopColor="#020812" stopOpacity="1" />
          </radialGradient>

          {/* Clip to kidney shapes for scan line */}
          <clipPath id="leftKidneyClip">
            <path d="M 128,72 C 165,70 186,97 186,126 C 186,138 181,147 173,152 C 165,155 160,163 167,172 C 175,177 186,187 186,200 C 186,226 165,243 128,241 C 91,243 72,226 72,200 C 72,174 72,140 72,120 C 72,96 91,70 128,72 Z" />
          </clipPath>
          <clipPath id="rightKidneyClip">
            <path d="M 272,72 C 235,70 214,97 214,126 C 214,138 219,147 227,152 C 235,155 240,163 233,172 C 225,177 214,187 214,200 C 214,226 235,243 272,241 C 309,243 328,226 328,200 C 328,174 328,140 328,120 C 328,96 309,70 272,72 Z" />
          </clipPath>
        </defs>

        {/* ══════════ BACKGROUND DISC ══════════ */}
        <circle cx="200" cy="156" r="150" fill="url(#bg)" />
        {/* Outer ring */}
        <circle cx="200" cy="156" r="149" fill="none"
          stroke={color} strokeWidth="1.2" opacity="0.28" />
        {/* Inner dashed ring */}
        <circle cx="200" cy="156" r="136" fill="none"
          stroke={color} strokeWidth="0.6" strokeDasharray="5 10" opacity="0.12" />
        {/* Subtle inner fill circle */}
        <circle cx="200" cy="156" r="130" fill={color} fillOpacity="0.018" />

        {/* Corner tick marks on outer ring */}
        {[0, 90, 180, 270].map(deg => {
          const rad  = deg * Math.PI / 180;
          const r1o  = 138, r2o = 150;
          const x1   = 200 + r1o * Math.sin(rad), y1 = 156 - r1o * Math.cos(rad);
          const x2   = 200 + r2o * Math.sin(rad), y2 = 156 - r2o * Math.cos(rad);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" opacity="0.4" />;
        })}

        {/* ══════════ LEFT KIDNEY ══════════ */}
        <g filter="url(#ig)">
          {/* Main body */}
          <path
            d="M 128,72 C 165,70 186,97 186,126 C 186,138 181,147 173,152 C 165,155 160,163 167,172 C 175,177 186,187 186,200 C 186,226 165,243 128,241 C 91,243 72,226 72,200 C 72,174 72,140 72,120 C 72,96 91,70 128,72 Z"
            fill="url(#lk)"
            stroke={color} strokeWidth="1.6"
            className="value-transition"
          />
          {/* Cortex inner ring */}
          <path
            d="M 128,88 C 158,87 172,108 172,130 C 172,140 168,148 162,152 C 156,155 152,161 158,168 C 164,173 172,181 172,192 C 172,212 158,226 128,224 C 98,226 86,212 86,192 C 86,168 86,140 86,124 C 86,104 98,87 128,88 Z"
            fill="none" stroke={color} strokeWidth="0.9" opacity="0.3"
          />
          {/* Hilum notch lines */}
          <path d="M 183,143 C 196,148 197,164 183,170"
            fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
          {/* Medullary pyramids */}
          {[[108,90],[118,102],[108,114],[118,126],[108,138],[118,150],[108,162],[118,174]].map(([cx,cy],i) => (
            <ellipse key={i} cx={cx} cy={cy} rx="8" ry="7"
              fill={color} fillOpacity={0.055 + (i%2)*0.02}
              stroke={color} strokeWidth="0.4" strokeOpacity="0.18" />
          ))}
          {/* Collecting system */}
          <path d="M 128,115 L 128,200 M 118,130 L 130,155 L 120,180"
            fill="none" stroke={color} strokeWidth="0.8" opacity="0.22" strokeLinecap="round" />
          {/* Animated filtration flow line */}
          <line x1="128" y1="88" x2="128" y2="222" stroke={color} strokeWidth="0.9" opacity="0.28" strokeDasharray="3 7">
            <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1.4s" repeatCount="indefinite" />
          </line>
          {/* Renal capsule highlight */}
          <path d="M 108,82 C 88,100 80,132 82,162"
            fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.18" />
        </g>

        {/* Scan line — left kidney */}
        <g clipPath="url(#leftKidneyClip)">
          <rect x="72" y="0" width="114" height="2.5" fill={color} fillOpacity="0.55">
            <animateTransform attributeName="transform" type="translate"
              from="0,72" to="0,245" dur="3.2s" repeatCount="indefinite" />
          </rect>
        </g>

        {/* ══════════ RIGHT KIDNEY ══════════ */}
        <g filter="url(#ig)">
          {/* Main body */}
          <path
            d="M 272,72 C 235,70 214,97 214,126 C 214,138 219,147 227,152 C 235,155 240,163 233,172 C 225,177 214,187 214,200 C 214,226 235,243 272,241 C 309,243 328,226 328,200 C 328,174 328,140 328,120 C 328,96 309,70 272,72 Z"
            fill="url(#rk)"
            stroke={color} strokeWidth="1.6"
            className="value-transition"
          />
          {/* Cortex inner ring */}
          <path
            d="M 272,88 C 242,87 228,108 228,130 C 228,140 232,148 238,152 C 244,155 248,161 242,168 C 236,173 228,181 228,192 C 228,212 242,226 272,224 C 302,226 314,212 314,192 C 314,168 314,140 314,124 C 314,104 302,87 272,88 Z"
            fill="none" stroke={color} strokeWidth="0.9" opacity="0.3"
          />
          {/* Hilum notch lines */}
          <path d="M 217,143 C 204,148 203,164 217,170"
            fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
          {/* Medullary pyramids */}
          {[[292,90],[282,102],[292,114],[282,126],[292,138],[282,150],[292,162],[282,174]].map(([cx,cy],i) => (
            <ellipse key={i} cx={cx} cy={cy} rx="8" ry="7"
              fill={color} fillOpacity={0.055 + (i%2)*0.02}
              stroke={color} strokeWidth="0.4" strokeOpacity="0.18" />
          ))}
          {/* Collecting system */}
          <path d="M 272,115 L 272,200 M 282,130 L 270,155 L 280,180"
            fill="none" stroke={color} strokeWidth="0.8" opacity="0.22" strokeLinecap="round" />
          {/* Animated flow line */}
          <line x1="272" y1="88" x2="272" y2="222" stroke={color} strokeWidth="0.9" opacity="0.28" strokeDasharray="3 7">
            <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1.6s" repeatCount="indefinite" />
          </line>
          {/* Renal capsule highlight */}
          <path d="M 292,82 C 312,100 320,132 318,162"
            fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.18" />
        </g>

        {/* Scan line — right kidney */}
        <g clipPath="url(#rightKidneyClip)">
          <rect x="214" y="0" width="114" height="2.5" fill={color} fillOpacity="0.55">
            <animateTransform attributeName="transform" type="translate"
              from="0,72" to="0,245" dur="3.2s" begin="1.6s" repeatCount="indefinite" />
          </rect>
        </g>

        {/* ══════════ CENTRAL VASCULATURE ══════════ */}
        <g filter="url(#sg)">
          {/* Aorta / IVC vertical trunk */}
          <line x1="200" y1="82" x2="200" y2="228"
            stroke={color} strokeWidth="3" opacity="0.45" strokeLinecap="round" />
          {/* Renal artery — left */}
          <path d="M 200,156 C 192,153 186,152 183,152"
            fill="none" stroke={color} strokeWidth="2.2" opacity="0.55" strokeLinecap="round" />
          {/* Renal artery — right */}
          <path d="M 200,156 C 208,153 214,152 217,152"
            fill="none" stroke={color} strokeWidth="2.2" opacity="0.55" strokeLinecap="round" />
          {/* Blood flow dots on arteries */}
          <circle cx="192" cy="154" r="2" fill={color} opacity="0.7">
            <animate attributeName="cx" from="200" to="183" dur="1.1s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.9;0" dur="1.1s" repeatCount="indefinite" />
          </circle>
          <circle cx="208" cy="154" r="2" fill={color} opacity="0.7">
            <animate attributeName="cx" from="200" to="217" dur="1.1s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.9;0" dur="1.1s" repeatCount="indefinite" />
          </circle>
          {/* Ureter stubs */}
          <path d="M 128,240 L 128,255 C 128,262 136,264 142,260 L 200,250"
            fill="none" stroke={color} strokeWidth="1.2" opacity="0.3" strokeLinecap="round" />
          <path d="M 272,240 L 272,255 C 272,262 264,264 258,260 L 200,250"
            fill="none" stroke={color} strokeWidth="1.2" opacity="0.3" strokeLinecap="round" />
        </g>

        {/* ══════════ TOP STATUS ══════════ */}
        <text x="200" y="30" textAnchor="middle" fill={color}
          fontSize="7" fontFamily="Orbitron,sans-serif" opacity="0.6" letterSpacing="2">
          RENAL SIMULATION ACTIVE
        </text>
        {/* Status dots */}
        {[-8, 0, 8].map((dx, i) => (
          <circle key={i} cx={200 + dx} cy={42} r={1.6} fill={color} opacity="0.5">
            <animate attributeName="opacity" values="0.3;0.9;0.3"
              dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* ══════════ METRIC CARDS ══════════ */}
        {/* LEFT CARD — Renal Blood Flow */}
        <g>
          <rect x="22" y="256" width="140" height="46" rx="5"
            fill="rgba(4,14,30,0.88)" stroke={color} strokeWidth="0.8" strokeOpacity="0.38" />
          {/* Left accent bar */}
          <rect x="22" y="256" width="2.5" height="46" rx="1"
            fill={color} opacity="0.55" />
          <text x="34" y="271" fill={color} fontSize="7"
            fontFamily="Orbitron,sans-serif" opacity="0.6" letterSpacing="1.2">
            RENAL BLOOD FLOW
          </text>
          <text x="34" y="291" fill={color} fontSize="20"
            fontFamily="Orbitron,sans-serif" fontWeight="700">
            {rbf.toLocaleString()}
          </text>
          <text x="34" y="297" fill={color} fontSize="7.5"
            fontFamily="Inter,sans-serif" opacity="0.5"
            dy="0">
            {' '.repeat(rbf.toString().length * 2)}
          </text>
          <text x={34 + rbf.toString().length * 12.2} y="291" fill={color} fontSize="9"
            fontFamily="Inter,sans-serif" opacity="0.55">
            mL/min
          </text>
        </g>

        {/* RIGHT CARD — Intrarenal Pressure */}
        <g>
          <rect x="238" y="256" width="140" height="46" rx="5"
            fill="rgba(4,14,30,0.88)" stroke={color} strokeWidth="0.8" strokeOpacity="0.38" />
          {/* Right accent bar */}
          <rect x="375.5" y="256" width="2.5" height="46" rx="1"
            fill={color} opacity="0.55" />
          <text x="248" y="271" fill={color} fontSize="7"
            fontFamily="Orbitron,sans-serif" opacity="0.6" letterSpacing="1.2">
            INTRARENAL PRESSURE
          </text>
          <text x="248" y="291" fill={color} fontSize="20"
            fontFamily="Orbitron,sans-serif" fontWeight="700">
            {irp}
          </text>
          <text x={248 + irp.toString().length * 12.2} y="291" fill={color} fontSize="9"
            fontFamily="Inter,sans-serif" opacity="0.55">
            mmHg
          </text>
        </g>
      </svg>
    </div>
  );
}
