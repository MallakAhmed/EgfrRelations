import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Cell, LineChart, Line, ReferenceLine,
} from 'recharts';
import {
  RELATIONSHIP_TABLES,
  INTERACTION_TERMS,
  CAUSAL_EDGES,
  PROBABILITY_MODEL_NOTES,
  ALL_RELATIONSHIP_ROWS,
  buildRelationshipTrend,
} from '../utils/relationshipKnowledge.js';
import { calculateEGFR } from '../utils/egfrCalculation.js';

/* ─────────────────────────────────────────────────────────────────
   FEATURE EXPLORER — definitions, defaults, computation
───────────────────────────────────────────────────────────────── */

const FEATURE_META = {
  age:              { label: 'Age',              unit: 'years',          min: 20,  max: 85,   step: 3,    type: 'continuous',  defaultVal: 50 },
  gender:           { label: 'Gender',           unit: '',               cats: ['female','male'],           type: 'categorical', defaultVal: 'male' },
  weight:           { label: 'Weight',           unit: 'kg',             min: 40,  max: 120,  step: 4,    type: 'continuous',  defaultVal: 70 },
  bmi:              { label: 'BMI',              unit: 'kg/m²',          min: 18,  max: 42,   step: 1.2,  type: 'continuous',  defaultVal: 25 },
  totalCholesterol: { label: 'Total Cholesterol',unit: 'mg/dL',          min: 130, max: 280,  step: 8,    type: 'continuous',  defaultVal: 185 },
  hdlCholesterol:   { label: 'HDL Cholesterol',  unit: 'mg/dL',          min: 25,  max: 80,   step: 3,    type: 'continuous',  defaultVal: 52 },
  diabetes:         { label: 'Diabetes',         unit: '',               cats: ['No','Yes'],                type: 'categorical', defaultVal: 0 },
  hypertension:     { label: 'Hypertension',     unit: '',               cats: ['No','Yes'],                type: 'categorical', defaultVal: 0 },
  dmiEpisode:       { label: 'DMI Episode',      unit: '',               cats: ['No','Yes'],                type: 'categorical', defaultVal: 0 },
  map:              { label: 'MAP',              unit: 'mmHg',           min: 50,  max: 120,  step: 3.5,  type: 'continuous',  defaultVal: 88 },
  creatinine:       { label: 'Creatinine',       unit: 'mg/dL',          min: 0.5, max: 4.5,  step: 0.2,  type: 'continuous',  defaultVal: 1.0 },
  hemoglobin:       { label: 'Hemoglobin',       unit: 'g/dL',           min: 8,   max: 17,   step: 0.45, type: 'continuous',  defaultVal: 13.5 },
  potassium:        { label: 'Potassium K⁺',     unit: 'mEq/L',          min: 3.0, max: 7.0,  step: 0.2,  type: 'continuous',  defaultVal: 4.2 },
  urineOutput:      { label: 'Urine Output',     unit: 'mL/day',         min: 100, max: 3000, step: 145,  type: 'continuous',  defaultVal: 1500 },
  egfr:             { label: 'eGFR',             unit: 'mL/min/1.73m²',  min: 5,   max: 130,  step: 6.25, type: 'continuous',  defaultVal: 90 },
};

const FEATURE_KEYS = Object.keys(FEATURE_META);

// Default simulation state — held fixed while sweeping one feature
const SIM_DEFAULTS = {
  age: 50, gender: 'male', weight: 70, bmi: 25,
  totalCholesterol: 185, hdlCholesterol: 52,
  diabetes: 0, hypertension: 0, dmiEpisode: 0,
  map: 88, creatinine: 1.0, hemoglobin: 13.5,
  potassium: 4.2, urineOutput: 1500,
};

// ── Compute the expected value of `featureB` given a full simulation state ──
// egfrOverride: when featureA is 'egfr', pass the x-axis value directly so the
// chart shows a real curve instead of a flat line (eGFR is an output, not input).
function computeExpected(featureB, state, egfrOverride = null) {
  const egfr = egfrOverride !== null ? egfrOverride : calculateEGFR(state);
  const dm  = Number(state.diabetes  ?? 0);
  const htn = Number(state.hypertension ?? 0);
  const cr  = Number(state.creatinine ?? 1.0);
  const age = Number(state.age ?? 50);
  const wt  = Math.max(30, Number(state.weight ?? 70));
  const bmi = Number(state.bmi ?? 25);
  const hdl = Number(state.hdlCholesterol ?? 52);
  const m   = Number(state.map ?? 88);
  const isFemale = state.gender === 'female';

  switch (featureB) {
    case 'egfr':
      return egfr;

    case 'potassium':
      return Math.min(7.0, Math.max(3.0, 4.10 + 0.90 * Math.exp(-egfr / 25)));

    case 'urineOutput': {
      const base = wt * 0.6 * 24;
      let mapMod = 1.0;
      if      (m < 50) mapMod = Math.max(0.05, (m - 30) / 20);
      else if (m < 65) mapMod = 0.05 + 0.95 * ((m - 50) / 15);
      else if (m < 75) mapMod = 0.90 + 0.10 * ((m - 65) / 10);
      const egfrMod = egfr < 10 ? 0.20 : egfr < 15 ? 0.35 : egfr < 30 ? 0.55 : egfr < 60 ? 0.80 : 1.0;
      return Math.max(50, base * mapMod * egfrMod);
    }

    case 'hemoglobin':
      return Math.max(8, 14.8 - 0.05 * age - 0.55 * dm - 0.35 * htn - 1.2 * Math.max(0, cr - 1));

    case 'creatinine': {
      const crclH = Math.max(30, 100 - Math.max(0, age - 40) * 0.8);
      const sex   = isFemale ? 0.85 : 1.0;
      let mean    = ((140 - Math.min(age, 100)) * wt) / (72 * crclH) * sex;
      if (m > 110) mean *= 1 + (m - 110) * 0.010;
      if (m < 60)  mean *= 1 + (60 - m)  * 0.030;
      mean += 0.34 * dm + 0.26 * htn;
      return Math.min(4.5, Math.max(0.4, mean));
    }

    case 'map':
      return Math.min(105, Math.max(60, 70 + Math.max(0, age - 20) * 0.30));

    case 'hdlCholesterol':
      return Math.max(25, 57 - 0.62 * (bmi - 25) - 4.2 * dm + 3.2 * (isFemale ? 1 : 0));

    case 'totalCholesterol':
      return Math.max(120, 172 + 0.58 * (age - 45) + 1.3 * (bmi - 25) - 0.2 * hdl);

    case 'bmi':
      return Math.max(18, Math.min(42, 24 + 0.04 * (age - 45) + (isFemale ? -0.8 : 0.4)));

    default:
      return null;
  }
}

// ── Relationship metadata for description + reference ──
const REL_INFO = {
  'age_egfr':              { dir:'negative', str:0.62, desc:'Each year of aging reduces eGFR by ~0.62 mL/min — nephrons are lost progressively and not replaced. By age 80, a person may have lost 25–30% of their kidney function through aging alone.',                ref:'Inker LA et al. N Engl J Med. 2021 (CKD-EPI 2021)' },
  'age_map':               { dir:'positive', str:0.47, desc:'Blood pressure rises ~0.30 mmHg per year after age 20. Arterial walls stiffen and lose elasticity with age, forcing the heart to push harder.',                                                              ref:'Vasan RS et al. JAMA. 2002 (Framingham Heart Study)' },
  'age_creatinine':        { dir:'mixed',    str:0.40, desc:'Aging reduces muscle mass (sarcopenia), lowering creatinine production — a masking effect. An elderly patient with "normal" creatinine may actually have severely impaired kidneys.',                           ref:'Levey AS et al. Ann Intern Med. 1999 (MDRD); Cockcroft & Gault 1976' },
  'age_diabetes':          { dir:'positive', str:0.52, desc:'Diabetes prevalence rises sharply with age. ~25–30% of people over 65 have type 2 diabetes. Cells become progressively more resistant to insulin over a lifetime.',                                            ref:'Global Diabetes Epidemiology data' },
  'age_hypertension':      { dir:'positive', str:0.62, desc:'Hypertension is nearly universal in the elderly. The Framingham Heart Study documented this over decades — arterial stiffening and vascular remodeling accumulate relentlessly.',                              ref:'Vasan RS et al. JAMA. 2002' },
  'age_totalCholesterol':  { dir:'positive', str:0.31, desc:'Total cholesterol rises with age as the liver\'s ability to clear LDL declines. Peaks in the 50s–60s then may fall in advanced age.',                                                                         ref:'Nelson RG et al. JAMA. 2019' },
  'bmi_diabetes':          { dir:'positive', str:0.66, desc:'The strongest BMI relationship in the model. Excess body fat (especially visceral/abdominal fat) releases adipokines that block insulin receptors — causing insulin resistance and eventually type 2 diabetes.',  ref:'Obesity & Diabetes literature; Nelson et al. JAMA 2019' },
  'bmi_hypertension':      { dir:'positive', str:0.58, desc:'Obesity activates the RAAS hormonal system, increases cardiac output, and retains sodium — all raising blood pressure.',                                                                                       ref:'Obesity & Hypertension literature' },
  'bmi_hdlCholesterol':    { dir:'negative', str:0.48, desc:'High triglycerides in obesity accelerate HDL breakdown. Measured as HDL = 57 − 0.777×BMI in the Project HeartBeat! cohort.',                                                                                  ref:'Project HeartBeat! Int J Obes. 2011' },
  'bmi_totalCholesterol':  { dir:'positive', str:0.39, desc:'Obesity increases liver VLDL production, raising total cholesterol. Measured as TC = a + 1.539×BMI.',                                                                                                         ref:'Project HeartBeat! Int J Obes. 2011; Metabolic Syndrome literature' },
  'bmi_egfr':              { dir:'negative', str:0.30, desc:'Each BMI unit above 25 reduces eGFR by ~0.45 mL/min through glomerular hyperfiltration and eventual nephron burnout.',                                                                                          ref:'Nelson RG et al. JAMA. 2019' },
  'diabetes_creatinine':   { dir:'positive', str:0.63, desc:'Diabetic nephropathy — the most important disease edge. High blood sugar triggers AGE-RAGE signaling → TGF-β → kidney fibrosis. Filters scar one by one over 10–20 years.',                                    ref:'AGE-RAGE (hsa04933); Diabetic Kidney Disease literature' },
  'diabetes_egfr':         { dir:'negative', str:0.33, desc:'Having diabetes subtracts 7.5 mL/min from eGFR directly, plus −3.2 additional units when hypertension co-exists.',                                                                                             ref:'Nelson RG et al. JAMA. 2019' },
  'diabetes_hemoglobin':   { dir:'negative', str:0.40, desc:'Diabetes damages EPO-producing cells in the kidney and causes chronic inflammation that suppresses bone marrow — resulting in anemia of chronic disease.',                                                       ref:'Diabetes & Anemia literature; HIF-1 signaling (hsa04066)' },
  'diabetes_hypertension': { dir:'positive', str:0.52, desc:'Diabetes causes hypertension via endothelial dysfunction and RAAS overactivation. The two conditions form the core of metabolic syndrome.',                                                                     ref:'Sun D et al. Circ Res. 2019' },
  'hypertension_creatinine':{ dir:'positive',str:0.55, desc:'Chronic high pressure scars the afferent arterioles entering each kidney filter (hypertensive nephrosclerosis). This is the #2 cause of kidney failure worldwide.',                                            ref:'HTN & CKD literature; Renin-Angiotensin system (hsa04614)' },
  'hypertension_egfr':     { dir:'negative', str:0.25, desc:'Hypertension reduces eGFR by 5.5 units directly, with additional age×HTN and cholesterol×HTN interaction penalties.',                                                                                          ref:'Nelson RG et al. JAMA. 2019' },
  'map_creatinine':        { dir:'positive', str:0.55, desc:'Both extremes of MAP raise creatinine: chronic high MAP → nephrosclerosis; acute low MAP (<65 mmHg) → renal autoregulation collapses → pre-renal AKI.',                                                        ref:'Vasan 2002; Carlström M et al. Nat Rev Nephrol. 2015' },
  'map_urineOutput':       { dir:'mixed',    str:0.50, desc:'Below MAP 65 mmHg, renal autoregulation fails and urine output drops sharply. Above 65 mmHg the kidneys maintain normal output across a wide range.',                                                          ref:'Carlström M et al. Nat Rev Nephrol. 2015' },
  'creatinine_egfr':       { dir:'negative', str:0.82, desc:'The dominant edge in the entire network. Every 1 mg/dL rise in creatinine drops eGFR by ~12 units in the linear model. This is the CKD-EPI equation itself.',                                                  ref:'Inker LA et al. N Engl J Med. 2021 (CKD-EPI 2021)' },
  'creatinine_potassium':  { dir:'positive', str:0.44, desc:'Creatinine↑ → eGFR↓ → tubular potassium excretion fails. K⁺ = 4.10 + 0.90 × e^(−eGFR/25). Below eGFR 15, hyperkalemia rises steeply.',                                                                      ref:'Kovesdy CP et al. CJASN. 2012' },
  'creatinine_urineOutput':{ dir:'negative', str:0.40, desc:'Higher creatinine reflects lower eGFR → less glomerular filtrate produced → less urine. Oliguria (<0.5 mL/kg/hr) is a critical AKI/ESRD warning.',                                                             ref:'KDIGO AKI Work Group. Kidney Int Suppl. 2012' },
  'creatinine_hemoglobin': { dir:'negative', str:0.44, desc:'As kidneys fail (creatinine rises), EPO-producing cells are destroyed → bone marrow makes fewer red blood cells → hemoglobin falls. Anemia of CKD.',                                                           ref:'Anemia of CKD; HIF-1 signaling (hsa04066)' },
  'hemoglobin_egfr':       { dir:'positive', str:0.28, desc:'Low hemoglobin causes renal hypoxia — kidney tissue gets less oxygen, tubular cells die, eGFR drops. Treating anemia modestly improves kidney outcomes.',                                                      ref:'Nelson RG et al. JAMA. 2019' },
  'hdlCholesterol_egfr':   { dir:'positive', str:0.22, desc:'HDL scavenges cholesterol from renal vessel walls. Higher HDL means cleaner kidney arteries, better perfusion, better eGFR.',                                                                                  ref:'Dyslipidemia in CKD literature' },
  'totalCholesterol_egfr': { dir:'negative', str:0.26, desc:'High cholesterol builds atherosclerotic plaques in renal arteries, slowly choking kidney blood supply and reducing eGFR.',                                                                                     ref:'Lipids & Kidney Disease literature' },
  'totalCholesterol_hypertension': { dir:'positive', str:0.19, desc:'Cholesterol plaques stiffen artery walls → systolic pressure rises. logit(P(HTN)) = a + 0.025×TC.',                                                                                                  ref:'Lipids & Hypertension literature' },
  'weight_creatinine':     { dir:'positive', str:0.45, desc:'More body weight = more muscle = more creatinine produced. This is the Cockcroft-Gault muscle-mass proxy.',                                                                                                   ref:'Cockcroft & Gault. Nephron. 1976' },
  'weight_urineOutput':    { dir:'positive', str:0.40, desc:'Baseline urine output = 0.6 mL/kg/hr × 24 h. Larger body requires proportionally more urine production.',                                                                                                    ref:'KDIGO AKI Work Group. 2012' },
  'gender_creatinine':     { dir:'negative', str:0.44, desc:'Females produce ~15% less creatinine (less muscle mass). The CKD-EPI formula applies a ×0.85 correction for biological sex.',                                                                                  ref:'Cockcroft & Gault. Nephron. 1976' },
  'gender_hdlCholesterol': { dir:'positive', str:0.34, desc:'Estrogen stimulates lipoprotein lipase, raising HDL. Pre-menopausal females have naturally higher HDL than males of the same age.',                                                                            ref:'Project HeartBeat! Int J Obes. 2011' },
};

function getRelInfo(a, b) {
  return (
    REL_INFO[`${a}_${b}`] ||
    REL_INFO[`${b}_${a}`] ||
    (() => {
      // Try CAUSAL_EDGES
      const edge = CAUSAL_EDGES.find(([f, t]) =>
        (f.toLowerCase() === a || t.toLowerCase() === a) &&
        (f.toLowerCase() === b || t.toLowerCase() === b)
      );
      if (edge) {
        return {
          dir: edge[2] >= 0 ? 'positive' : 'negative',
          str: Math.abs(edge[2]),
          desc: `Causal edge from the network model with strength ${Math.abs(edge[2]).toFixed(2)}.`,
          ref: 'Derived from CAUSAL_EDGES in relationshipKnowledge.js',
        };
      }
      // Try RELATIONSHIP_TABLES
      const row = ALL_RELATIONSHIP_ROWS.find(r =>
        (r.f1.toLowerCase() === a && r.f2.toLowerCase() === b) ||
        (r.f1.toLowerCase() === b && r.f2.toLowerCase() === a)
      );
      if (row) {
        return {
          dir: row.type.toLowerCase().includes('inverse') || row.type.toLowerCase().includes('negative') ? 'negative' : 'positive',
          str: null,
          desc: row.interpretation,
          ref: row.reference,
        };
      }
      return null;
    })()
  );
}

// ── Generate chart data ──
function generatePairData(featureA, featureB) {
  if (featureA === featureB) return null;

  const metaA = FEATURE_META[featureA];
  const metaB = FEATURE_META[featureB];
  if (!metaA || !metaB) return null;

  const isCatA = metaA.type === 'categorical';
  const isCatB = metaB.type === 'categorical';

  const STEPS = 22;

  // Categorical A → Continuous B  →  bar chart
  if (isCatA && !isCatB) {
    const cats = metaA.cats;
    const data = cats.map(cat => {
      let rawVal = cat;
      if (cat === 'No')     rawVal = 0;
      if (cat === 'Yes')    rawVal = 1;
      const state  = { ...SIM_DEFAULTS, [featureA]: rawVal };
      const yVal   = computeExpected(featureB, state);
      return { x: cat, y: yVal !== null ? Number(yVal.toFixed(2)) : null };
    });
    return { chartType: 'bar', data: data.filter(d => d.y !== null), metaB };
  }

  // Continuous A → Continuous/Categorical B  →  line chart
  if (!isCatA) {
    const data = [];
    for (let i = 0; i <= STEPS; i++) {
      const xVal  = metaA.min + ((metaA.max - metaA.min) * i / STEPS);
      const state = { ...SIM_DEFAULTS, [featureA]: xVal };
      // When featureA is 'egfr', pass xVal directly — eGFR is an output so
      // setting state.egfr has no effect on calculateEGFR inside computeExpected.
      const egfrOverride = featureA === 'egfr' ? xVal : null;
      const yVal  = computeExpected(featureB, state, egfrOverride);
      if (yVal !== null) {
        data.push({ x: Number(xVal.toFixed(2)), y: Number(yVal.toFixed(2)) });
      }
    }
    if (data.length === 0) return null;
    return { chartType: 'line', data, metaB };
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────
   DIRECTION BADGE
───────────────────────────────────────────────────────────────── */
function DirBadge({ dir }) {
  if (!dir) return null;
  const map = {
    positive: { label: '↑ Positive',    bg: 'bg-red-900/40',   text: 'text-red-300',   border: 'border-red-700/40' },
    negative: { label: '↓ Negative',    bg: 'bg-blue-900/40',  text: 'text-blue-300',  border: 'border-blue-700/40' },
    mixed:    { label: '⟷ Mixed',       bg: 'bg-slate-800/60', text: 'text-slate-300', border: 'border-slate-600/40' },
  };
  const s = map[dir] || map.mixed;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CUSTOM TOOLTIP
───────────────────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label, metaA, metaB }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-600/40 bg-slate-900 p-3 text-xs shadow-xl">
      <p className="text-slate-300 font-semibold">
        {metaA?.label}: <span className="text-white">{label} {metaA?.unit}</span>
      </p>
      <p className="text-slate-300 mt-1">
        {metaB?.label}: <span className="text-cyan-300 font-bold">{payload[0]?.value?.toFixed(2)} {metaB?.unit}</span>
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FEATURE EXPLORER SECTION
───────────────────────────────────────────────────────────────── */
function FeatureExplorer() {
  const [featureA, setFeatureA] = useState('creatinine');
  const [featureB, setFeatureB] = useState('egfr');
  const [plotted, setPlotted]   = useState({ a: 'creatinine', b: 'egfr' });

  const result  = useMemo(() => generatePairData(plotted.a, plotted.b), [plotted]);
  const relInfo = useMemo(() => getRelInfo(plotted.a, plotted.b), [plotted]);
  const metaA   = FEATURE_META[plotted.a];
  const metaB   = FEATURE_META[plotted.b];

  const isSame   = featureA === featureB;
  const noFormula = result === null && plotted.a !== plotted.b;

  const lineColor = relInfo?.dir === 'negative' ? '#63B3ED'
                  : relInfo?.dir === 'positive'  ? '#FC8181'
                  : '#a0aec0';

  function handlePlot() {
    if (!isSame) setPlotted({ a: featureA, b: featureB });
  }

  return (
    <div className="rounded-xl border border-violet-500/20 bg-slate-900/30 p-5 mb-4">
      <h3 className="text-sm font-bold text-slate-100 mb-1">Feature Relationship Explorer</h3>
      <p className="text-xs text-slate-400 mb-4">
        Select any two features. The chart shows how changing Feature A affects the expected value of Feature B,
        holding all other variables at their clinical defaults. Every curve is computed from the model's
        mathematical equations — the same ones backed by the reference papers.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Feature A (X axis)</label>
          <select
            value={featureA}
            onChange={e => setFeatureA(e.target.value)}
            className="rounded-lg border border-slate-600/40 bg-slate-800 text-slate-100 text-xs px-3 py-2 focus:outline-none focus:border-violet-500/60"
          >
            {FEATURE_KEYS.map(k => (
              <option key={k} value={k}>{FEATURE_META[k].label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Feature B (Y axis)</label>
          <select
            value={featureB}
            onChange={e => setFeatureB(e.target.value)}
            className="rounded-lg border border-slate-600/40 bg-slate-800 text-slate-100 text-xs px-3 py-2 focus:outline-none focus:border-violet-500/60"
          >
            {FEATURE_KEYS.map(k => (
              <option key={k} value={k}>{FEATURE_META[k].label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handlePlot}
          disabled={isSame}
          className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${
            isSame
              ? 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
              : 'bg-violet-600/80 hover:bg-violet-500/80 text-white border border-violet-500/40'
          }`}
        >
          Plot Relationship
        </button>

        {isSame && (
          <span className="text-xs text-amber-400/80">Select two different features.</span>
        )}
      </div>

      {/* Chart */}
      {noFormula ? (
        <div className="flex items-center justify-center h-48 rounded-lg border border-slate-700/30 bg-slate-800/20">
          <div className="text-center">
            <p className="text-slate-400 text-sm font-semibold mb-1">No direct computable relationship</p>
            <p className="text-slate-500 text-xs max-w-xs">
              These two features do not have a direct mathematical formula in the current model.
              Their relationship may be indirect — mediated through other variables (e.g., both are
              affected by a common upstream cause).
            </p>
          </div>
        </div>
      ) : result ? (
        <div>
          {/* Chart title */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-200">
              {metaA?.label} → {metaB?.label}
            </span>
            {relInfo && <DirBadge dir={relInfo.dir} />}
            {relInfo?.str != null && (
              <span className="text-xs text-slate-400">
                Strength: <span className="text-slate-200 font-semibold">{relInfo.str.toFixed(2)}</span>
              </span>
            )}
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {result.chartType === 'bar' ? (
                <BarChart data={result.data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    dataKey="x"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    label={{ value: metaA?.label, position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    label={{ value: `${metaB?.label} (${metaB?.unit})`, angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip metaA={metaA} metaB={metaB} />} />
                  <Bar dataKey="y" radius={[4, 4, 0, 0]}>
                    {result.data.map((d, i) => (
                      <Cell key={i} fill={i === 0 ? '#4A90E2' : '#FC8181'} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <LineChart data={result.data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    dataKey="x"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    label={{ value: `${metaA?.label} (${metaA?.unit})`, position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    label={{ value: `${metaB?.label} (${metaB?.unit})`, angle: -90, position: 'insideLeft', offset: 12, fill: '#64748b', fontSize: 11 }}
                    width={55}
                  />
                  <Tooltip content={<CustomTooltip metaA={metaA} metaB={metaB} />} />
                  {/* Clinical reference lines for eGFR */}
                  {plotted.b === 'egfr' && (
                    <>
                      <ReferenceLine y={90} stroke="#06b6d4" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'G1', fill: '#06b6d4', fontSize: 9, position: 'right' }} />
                      <ReferenceLine y={60} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'G2', fill: '#10b981', fontSize: 9, position: 'right' }} />
                      <ReferenceLine y={45} stroke="#facc15" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'G3a', fill: '#facc15', fontSize: 9, position: 'right' }} />
                      <ReferenceLine y={30} stroke="#fb923c" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'G3b', fill: '#fb923c', fontSize: 9, position: 'right' }} />
                      <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'G4', fill: '#ef4444', fontSize: 9, position: 'right' }} />
                    </>
                  )}
                  {/* Potassium danger zone */}
                  {plotted.b === 'potassium' && (
                    <>
                      <ReferenceLine y={5.5} stroke="#FC8181" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'Hyperkalemia', fill: '#FC8181', fontSize: 9, position: 'right' }} />
                      <ReferenceLine y={3.5} stroke="#63B3ED" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'Hypokalemia', fill: '#63B3ED', fontSize: 9, position: 'right' }} />
                    </>
                  )}
                  {/* MAP autoregulation zone */}
                  {plotted.a === 'map' && plotted.b === 'urineOutput' && (
                    <ReferenceLine x={65} stroke="#facc15" strokeDasharray="5 3" strokeOpacity={0.6} label={{ value: 'Autoregulation limit', fill: '#facc15', fontSize: 9 }} />
                  )}
                  <Line
                    dataKey="y"
                    stroke={lineColor}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: lineColor }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Relationship info cards */}
          {relInfo && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Medical Interpretation</p>
                <p className="text-xs text-slate-300 leading-relaxed">{relInfo.desc}</p>
              </div>
              <div className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Reference</p>
                <p className="text-xs text-blue-300 leading-relaxed">{relInfo.ref}</p>
                <p className="text-[10px] text-slate-500 mt-2">
                  Chart computed from model equations using clinical defaults for all other variables.
                  Other features held at: Age 50, Creatinine 1.0, MAP 88, BMI 25, no DM/HTN.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   EDGE CHART
───────────────────────────────────────────────────────────────── */
const edgeChartData = CAUSAL_EDGES.map(([from, to, weight], idx) => ({
  id:     `${from}-${to}-${idx}`,
  edge:   `${from}→${to}`,
  weight: Math.abs(weight),
  sign:   weight >= 0 ? 'positive' : 'negative',
}));

/* ─────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────── */
export default function RelationshipsPage() {
  const pairTrendCharts = ALL_RELATIONSHIP_ROWS.map((row, idx) => {
    const trend = buildRelationshipTrend(row);
    return { id: `${row.f1}-${row.f2}-${idx}`, title: `${row.f1} vs ${row.f2}`, relation: row.relation, reference: row.reference, ...trend };
  });

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-5"
      style={{ background: 'linear-gradient(180deg, #071428 0%, #050d1d 55%, #040916 100%)' }}
    >
      {/* Header */}
      <div className="mb-4 rounded-xl border border-slate-500/20 bg-slate-900/30 p-4">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Relationships and Trend Modeling</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Unified representation: eGFR = f(Cr, Age, Gender, BMI, DM, HTN, Chol, HDL, Hb, interactions).
          This page summarizes literature-guided mathematical relationships and causal structure for probability-based propagation.
        </p>
        <p className="text-xs text-slate-400 mt-2">Critical interaction terms: {INTERACTION_TERMS.join(', ')}</p>
      </div>

      {/* ── Feature Explorer (new) ── */}
      <FeatureExplorer />

      {/* Edge strengths + model notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-slate-500/20 bg-slate-900/30 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Causal Edge Strengths</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={edgeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="edge" angle={-35} textAnchor="end" interval={0} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="weight">
                  {edgeChartData.map(d => (
                    <Cell key={d.id} fill={d.sign === 'positive' ? '#5f86c7' : '#b07bb6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-500/20 bg-slate-900/30 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Probability and SEM Notes</h3>
          <ul className="space-y-2">
            {PROBABILITY_MODEL_NOTES.map(note => (
              <li key={note} className="text-sm text-slate-300 leading-relaxed">- {note}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Relationship Tables */}
      <div className="space-y-4">
        {RELATIONSHIP_TABLES.map(section => (
          <div key={section.title} className="rounded-xl border border-slate-500/20 bg-slate-900/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-600/20">
              <h3 className="text-sm font-semibold text-slate-200">{section.title}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/35 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Feature 1</th>
                    <th className="px-3 py-2 font-semibold">Feature 2</th>
                    <th className="px-3 py-2 font-semibold">Mathematical Relation</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Medical Interpretation</th>
                    <th className="px-3 py-2 font-semibold">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map(row => (
                    <tr key={`${row.f1}-${row.f2}-${row.reference}`} className="border-t border-slate-700/20 text-slate-300">
                      <td className="px-3 py-2">{row.f1}</td>
                      <td className="px-3 py-2">{row.f2}</td>
                      <td className="px-3 py-2">{row.relation}</td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2">{row.interpretation}</td>
                      <td className="px-3 py-2 text-slate-400">{row.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Pairwise Trend Charts */}
      <div className="mt-5 rounded-xl border border-slate-500/20 bg-slate-900/30 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Pairwise Trend Charts (All Table Relationships)</h3>
        <p className="text-xs text-slate-400 mb-3">
          Each chart visualizes the mathematical directionality from the relationship tables (positive, inverse, U-shaped, categorical).
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {pairTrendCharts.map(chart => (
            <div key={chart.id} className="rounded-lg border border-slate-600/25 bg-slate-800/30 p-3">
              <p className="text-xs text-slate-200 font-semibold">{chart.title}</p>
              <p className="text-[11px] text-slate-400 mb-2">{chart.relation}</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  {chart.chartType === 'bar' ? (
                    <BarChart data={chart.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                      <XAxis dataKey="x" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="y" fill="#6f8ec6" />
                    </BarChart>
                  ) : (
                    <LineChart data={chart.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                      <XAxis dataKey="x" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip />
                      <Line dataKey="y" stroke="#6f8ec6" strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">{chart.reference}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
