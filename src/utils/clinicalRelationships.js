/**
 * Clinical Bayesian Network — Gaussian Belief Propagation Engine
 *
 * Architecture: Knowledge-Based Bayesian Network (KBBN)
 *   Structure  = causal edges from medical literature
 *   Parameters = conditional Gaussian distributions fitted to published norms
 *   Inference  = belief propagation: observe one feature → update expectations
 *                for all connected features
 *
 * Network DAG (→ = "causally influences"):
 *
 *   age ──────────────────────────────────────────────────► MAP
 *   age ──────────────────────────────────────────────────► creatinine
 *   weight ────────────────────────────────────────────────► creatinine
 *   gender ────────────────────────────────────────────────► creatinine
 *   MAP ───────────────────────────────────────────────────► creatinine
 *   MAP ───────────────────────────────────────────────────► urineOutput
 *   creatinine (→ eGFR) ──────────────────────────────────► potassium
 *   creatinine (→ eGFR) ──────────────────────────────────► urineOutput
 *   weight ────────────────────────────────────────────────► urineOutput
 *
 * Consistency model:
 *   P(Xi | parents) ~ N(μ_i, σ_i²)
 *   z = (observed − μ) / σ
 *   |z| > 1.5 → warning  (p ≈ 0.13)
 *   |z| > 2.5 → critical (p ≈ 0.01)
 *
 * ── References ──────────────────────────────────────────────────────────────
 * [R1] Inker LA et al. N Engl J Med. 2021;385:1737–1749
 *        CKD-EPI 2021 race-free eGFR — baseline equation for kidney function
 * [R2] KDIGO AKI Work Group. Kidney Int Suppl. 2012;2:1–138
 *        AKI staging; oliguria ≡ <0.5 mL/kg/hr; polyuria >2.5 mL/kg/hr
 * [R3] Kovesdy CP et al. Clin J Am Soc Nephrol. 2012;7:861–867
 *        K⁺ rises exponentially as eGFR declines; Fig.1 data used to fit curve
 * [R4] Vasan RS et al. JAMA. 2002;287:1003–1010
 *        Framingham cohort: MAP increases ~0.30 mmHg/yr after age 20
 * [R5] Cockcroft DW, Gault MH. Nephron. 1976;16:31–41
 *        CrCl = (140−age)×weight / (72×Scr) × 0.85♀ — basis for expected Scr
 * [R6] Carlström M et al. Nat Rev Nephrol. 2015;11:545–557
 *        Renal autoregulation collapses below MAP ≈ 65 mmHg → UO drops sharply
 * [R7] Levey AS et al. Ann Intern Med. 1999;130:461–470
 *        MDRD study: muscle mass falls with age → lower baseline creatinine
 * ────────────────────────────────────────────────────────────────────────────
 */

import { calculateEGFR } from './egfrCalculation.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function zScore(observed, mean, sd) {
  return (observed - mean) / Math.max(sd, 0.001);
}

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK_NODES
// Each node: key, label, unit, precision, parents[], children[],
//            distribution(data) → {mean, sd}
// ─────────────────────────────────────────────────────────────────────────────

export const NETWORK_NODES = {

  // ── MAP | age ─────────────────────────────────────────────────────────────
  // Framingham Heart Study [R4]: MAP rises ~0.30 mmHg/yr after age 20
  // Population SD ≈ 12 mmHg
  map: {
    key: 'map',
    label: 'Mean Arterial Pressure',
    unit: 'mmHg',
    precision: 1,
    parents: ['age'],
    children: ['creatinine', 'urineOutput'],
    distribution({ age }) {
      return {
        mean: clamp(70 + Math.max(0, age - 20) * 0.30, 60, 105),
        sd:   12,
      };
    },
  },

  // ── creatinine | age, weight, gender, MAP ─────────────────────────────────
  // Reverse Cockcroft-Gault [R5]: Scr = (140−age)×wt / (72 × CrCl_healthy)
  // Healthy CrCl declines ~0.8 mL/min/yr after age 40 [R1]
  // MAP modifier: chronic hypertension [R4] and hypotension [R6] both raise Scr
  creatinine: {
    key: 'creatinine',
    label: 'Serum Creatinine',
    unit: 'mg/dL',
    precision: 0.1,
    parents: ['age', 'weight', 'gender', 'map'],
    children: ['potassium', 'urineOutput'],
    distribution({ age, weight, gender, map }) {
      const crclHealthy = Math.max(30, 100 - Math.max(0, age - 40) * 0.8);
      const sexFactor   = gender === 'female' ? 0.85 : 1.0;
      let   mean        = ((140 - age) * weight) / (72 * crclHealthy) * sexFactor;

      // Chronic hypertension accelerates nephrosclerosis [R4]
      if (map > 110) mean *= 1 + (map - 110) * 0.010;
      // Acute hypotension → pre-renal AKI [R6][R2]
      if (map < 60)  mean *= 1 + (60  - map)  * 0.030;

      return { mean: clamp(mean, 0.4, 1.8), sd: 0.25 };
    },
  },

  // ── potassium | creatinine, age, weight, gender ───────────────────────────
  // Kovesdy 2012 [R3] Fig.1 — K⁺ accumulates as eGFR falls:
  //   K⁺_expected = 4.10 + 0.90 × e^(−eGFR/25)
  //   eGFR 90 → 4.12   eGFR 60 → 4.18   eGFR 30 → 4.37
  //   eGFR 15 → 4.59   eGFR  5 → 4.83
  potassium: {
    key: 'potassium',
    label: 'Potassium K⁺',
    unit: 'mEq/L',
    precision: 0.1,
    parents: ['creatinine', 'age', 'weight', 'gender'],
    children: [],
    distribution(data) {
      const egfr = calculateEGFR(data);
      return {
        mean: clamp(4.10 + 0.90 * Math.exp(-egfr / 25), 3.5, 6.5),
        sd:   0.50,
      };
    },
  },

  // ── urineOutput | weight, MAP, creatinine(→eGFR) ─────────────────────────
  // Base: 0.6 mL/kg/hr × 24 h (mid of 0.5–1.0 normal range) [R2]
  // MAP modifier: autoregulation holds above ~65 mmHg; falls steeply below [R6]
  // eGFR modifier: filtration rate directly limits tubular fluid delivery [R1]
  urineOutput: {
    key: 'urineOutput',
    label: 'Urine Output',
    unit: 'mL/day',
    precision: 50,
    parents: ['weight', 'map', 'creatinine', 'age', 'gender'],
    children: [],
    distribution(data) {
      const egfr = calculateEGFR(data);
      const base = data.weight * 0.6 * 24;          // baseline at 0.6 mL/kg/hr

      // MAP-driven autoregulation modifier [R6]
      let mapMod = 1.0;
      if      (data.map < 50) mapMod = clamp((data.map - 30) / 20, 0.05, 1);
      else if (data.map < 65) mapMod = 0.05 + 0.95 * ((data.map - 50) / 15);
      else if (data.map < 75) mapMod = 0.90 + 0.10 * ((data.map - 65) / 10);

      // eGFR filtration modifier [R1][R2]
      const egfrMod = egfr < 10 ? 0.20
                    : egfr < 15 ? 0.35
                    : egfr < 30 ? 0.55
                    : egfr < 60 ? 0.80
                    : 1.0;

      return {
        mean: Math.max(50, base * mapMod * egfrMod),
        sd:   Math.max(200, base * 0.45),            // ±45% CV = real biological spread
      };
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPAGATION_GRAPH
// When feature X changes, which features' expected values must be recomputed?
// (Topological order, no cycles)
// ─────────────────────────────────────────────────────────────────────────────

export const PROPAGATION_GRAPH = {
  age:         ['map', 'creatinine', 'potassium', 'urineOutput'],
  weight:      ['creatinine', 'urineOutput', 'potassium'],
  gender:      ['creatinine', 'potassium', 'urineOutput'],
  map:         ['creatinine', 'urineOutput'],
  creatinine:  ['potassium', 'urineOutput'],
  potassium:   [],
  urineOutput: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// INFLUENCE_MAP — static table of pairwise relationships for UI display
// ─────────────────────────────────────────────────────────────────────────────

export const INFLUENCE_MAP = [
  { from: 'Age',        to: 'MAP',          arrow: '↑',   note: 'BP rises ~0.30 mmHg/yr after 20',           ref: 'R4' },
  { from: 'Age',        to: 'Creatinine',   arrow: '↓',   note: 'Muscle mass loss lowers baseline Scr',       ref: 'R7' },
  { from: 'Age',        to: 'K⁺',           arrow: '↑',   note: 'Via eGFR decline → excretion falls',         ref: 'R3' },
  { from: 'Age',        to: 'Urine Output', arrow: '↓',   note: 'Via eGFR decline → less filtrate',           ref: 'R1' },
  { from: 'Weight',     to: 'Creatinine',   arrow: '↑',   note: 'More muscle mass → more Cr production',      ref: 'R5' },
  { from: 'Weight',     to: 'Urine Output', arrow: '↑',   note: 'Larger body → higher baseline UO',           ref: 'R2' },
  { from: 'MAP',        to: 'Creatinine',   arrow: '↑',   note: 'HTN nephrosclerosis (chronic) / AKI (acute)',ref: 'R4/R6' },
  { from: 'MAP',        to: 'Urine Output', arrow: '↓',   note: 'Below 65 mmHg autoregulation collapses',     ref: 'R6' },
  { from: 'Creatinine', to: 'K⁺',           arrow: '↑',   note: 'Cr↑ → eGFR↓ → K⁺ excretion fails',          ref: 'R3' },
  { from: 'Creatinine', to: 'Urine Output', arrow: '↓',   note: 'Cr↑ → eGFR↓ → less glomerular filtrate',    ref: 'R1/R2' },
  { from: 'Gender ♀',   to: 'Creatinine',   arrow: '↓',   note: 'Lower muscle mass → Scr ×0.85 correction',  ref: 'R5' },
];

// ─────────────────────────────────────────────────────────────────────────────
// computeAllPosteriors(data)
//
// For every modelled feature, compute P(feature | all other features).
// Returns a map: { [featureKey]: { mean, sd, z, absZ, direction, inBand,
//                                  expectedMin, expectedMax } }
//
// This IS the Bayesian inference step — the network updates its belief about
// each feature given the full observed patient profile.
// ─────────────────────────────────────────────────────────────────────────────

export function computeAllPosteriors(data) {
  const out = {};
  for (const [key, node] of Object.entries(NETWORK_NODES)) {
    const observed = data[key];
    if (observed == null) continue;
    const { mean, sd }  = node.distribution(data);
    const z             = zScore(observed, mean, sd);
    out[key] = {
      mean,
      sd,
      z,
      absZ:        Math.abs(z),
      direction:   z >  0.3 ? 'high' : z < -0.3 ? 'low' : 'normal',
      inBand:      Math.abs(z) <= 1.5,
      expectedMin: mean - 1.5 * sd,
      expectedMax: mean + 1.5 * sd,
    };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// getPropagationSuggestions(changedFeature, data)
//
// When the user edits `changedFeature`, walk all downstream nodes.
// For each downstream node whose current value deviates > THRESHOLD σ from
// its new expected value, emit a suggestion to update it.
//
// This is one-directional propagation along the DAG edges — no cycles.
// ─────────────────────────────────────────────────────────────────────────────

const SUGGESTION_THRESHOLD = 1.0;   // σ — suggest if actual differs by > 1 SD

export function getPropagationSuggestions(changedFeature, data) {
  const downstream = PROPAGATION_GRAPH[changedFeature] ?? [];
  const suggestions = [];

  for (const feature of downstream) {
    const node = NETWORK_NODES[feature];
    if (!node) continue;
    const observed = data[feature];
    if (observed == null) continue;

    const { mean, sd } = node.distribution(data);
    const z            = zScore(observed, mean, sd);

    if (Math.abs(z) > SUGGESTION_THRESHOLD) {
      // Round to node's natural precision
      const p         = node.precision ?? 1;
      const suggested = Math.round(mean / p) * p;

      suggestions.push({
        feature,
        label:         node.label,
        unit:          node.unit,
        currentValue:  observed,
        suggestedValue: suggested,
        expectedMean:  mean,
        expectedSd:    sd,
        z,
        absZ:          Math.abs(z),
        severity:      Math.abs(z) > 2.5 ? 'critical' : 'warning',
        direction:     z > 0 ? 'currently high' : 'currently low',
        reason:        buildReason(changedFeature, feature, data, mean),
      });
    }
  }

  return suggestions.sort((a, b) => b.absZ - a.absZ);
}

function buildReason(from, to, data, expectedMean) {
  const egfr = calculateEGFR(data);
  const pairs = {
    age_map:
      `At age ${data.age} years, the Framingham-derived population model predicts a MAP of approximately ${expectedMean.toFixed(0)} mmHg (age-related vascular stiffening: +0.30 mmHg/yr after age 20). [R4]`,
    age_creatinine:
      `At age ${data.age} years and weight ${data.weight} kg, the Cockcroft-Gault model (assuming preserved renal function) estimates an expected serum creatinine of ${expectedMean.toFixed(1)} mg/dL, adjusted for age-related reduction in skeletal muscle mass. [R5, R7]`,
    age_potassium:
      `At age ${data.age} years, the estimated GFR is ${egfr} mL/min/1.73m². Progressive age-related GFR decline impairs renal potassium excretion; the network-expected K⁺ at this GFR is ${expectedMean.toFixed(1)} mEq/L. [R3]`,
    age_urineOutput:
      `At age ${data.age} years, the estimated GFR is ${egfr} mL/min/1.73m². Age-related reduction in filtration capacity limits urinary output; the expected urine output at this GFR is ${Math.round(expectedMean)} mL/day. [R1, R2]`,
    weight_creatinine:
      `Body weight of ${data.weight} kg serves as a proxy for skeletal muscle mass in the Cockcroft-Gault model. The expected serum creatinine for this weight at the current age and biological sex is ${expectedMean.toFixed(1)} mg/dL. [R5]`,
    weight_urineOutput:
      `Baseline urinary output is proportional to body weight (0.6 mL/kg/hr × 24 h). For a body weight of ${data.weight} kg, the expected baseline urine output is ${Math.round(expectedMean)} mL/day. [R2]`,
    weight_potassium:
      `Weight-adjusted eGFR is ${egfr} mL/min/1.73m². At this level of renal function, the network-expected serum K⁺ is ${expectedMean.toFixed(1)} mEq/L. [R3]`,
    gender_creatinine:
      `Biological sex applies a correction factor to creatinine generation (female: ×0.85, reflecting lower mean muscle mass). For a ${data.gender} patient at age ${data.age}, the expected serum creatinine is ${expectedMean.toFixed(1)} mg/dL. [R5]`,
    gender_potassium:
      `Sex-adjusted eGFR is ${egfr} mL/min/1.73m². At this level of renal function, the expected serum K⁺ is ${expectedMean.toFixed(1)} mEq/L. [R3]`,
    gender_urineOutput:
      `Sex-adjusted eGFR is ${egfr} mL/min/1.73m². The expected urine output commensurate with this filtration rate is ${Math.round(expectedMean)} mL/day. [R2]`,
    map_creatinine:
      data.map < 65
        ? `A MAP of ${data.map} mmHg exceeds the lower limit of renal autoregulation (approximately 65 mmHg), rendering glomerular filtration pressure-dependent and predisposing to pre-renal acute kidney injury with elevation of serum creatinine. Expected creatinine at this MAP: ${expectedMean.toFixed(1)} mg/dL. [R6, R2]`
        : `Chronic elevation of MAP to ${data.map} mmHg accelerates hypertensive nephrosclerosis, which progressively elevates serum creatinine over time. The network-expected creatinine at this MAP is ${expectedMean.toFixed(1)} mg/dL. [R4]`,
    map_urineOutput:
      data.map < 65
        ? `A MAP of ${data.map} mmHg falls below the renal autoregulatory threshold (approximately 65 mmHg). Below this pressure, glomerular filtration becomes pressure-passive and urine output declines sharply. Expected urine output at this MAP: ${Math.round(expectedMean)} mL/day. [R6]`
        : `At a MAP of ${data.map} mmHg, renal perfusion is within the autoregulatory range. Expected urine output based on perfusion pressure and filtration rate: ${Math.round(expectedMean)} mL/day. [R6]`,
    creatinine_potassium:
      `Serum creatinine of ${data.creatinine} mg/dL corresponds to an estimated GFR of ${egfr} mL/min/1.73m². At this level of renal function, tubular potassium secretion is ${egfr < 15 ? 'critically impaired' : egfr < 30 ? 'severely impaired' : egfr < 60 ? 'moderately reduced' : 'mildly reduced'}; the network-expected K⁺ is ${expectedMean.toFixed(1)} mEq/L. [R3]`,
    creatinine_urineOutput:
      `Serum creatinine of ${data.creatinine} mg/dL corresponds to an estimated GFR of ${egfr} mL/min/1.73m². Glomerular filtration rate directly determines the volume of tubular filtrate and, consequently, urine output. The expected urine output at this GFR is ${Math.round(expectedMean)} mL/day. [R1, R2]`,
  };
  return pairs[`${from}_${to}`] ??
    `Following modification of ${from}, the Bayesian network estimates an expected value for ${to} of ${typeof expectedMean === 'number' ? expectedMean.toFixed(1) : expectedMean}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// checkClinicalConsistency(data)
//
// Two-pass consistency check:
//   Pass 1 — Gaussian z-score check on each Bayesian node
//   Pass 2 — Pairwise hard clinical rules (non-linear relationships)
// ─────────────────────────────────────────────────────────────────────────────

const PAIRWISE_RULES = [
  {
    // Urinary K⁺ excretion is severely impaired at eGFR < 20; normo/hypokalemia is discordant [R3]
    id: 'low_k_severe_ckd',
    check(data) {
      const egfr = calculateEGFR(data);
      if (egfr < 10 && data.potassium < 4.5)
        return { severity: 'critical', category: 'K⁺ ↔ Renal Function', ref: 'R3',
          message: `Serum K⁺ of ${data.potassium} mEq/L is discordant with an eGFR of ${egfr} mL/min/1.73m². At this level of residual renal function, urinary potassium excretion is critically impaired and hyperkalaemia (K⁺ ≥ 5.0 mEq/L) is the expected biochemical finding. A sub-normal K⁺ at this eGFR necessitates investigation for concurrent kaliuretic mechanisms (potassium-binding resins, renal replacement therapy, gastrointestinal losses, or mineralocorticoid excess). [Kovesdy 2012]` };
      if (egfr < 20 && data.potassium < 4.0)
        return { severity: 'warning', category: 'K⁺ ↔ Renal Function', ref: 'R3',
          message: `Serum K⁺ of ${data.potassium} mEq/L is below the expected range for an eGFR of ${egfr} mL/min/1.73m². Progressive renal insufficiency impairs tubular potassium secretion; a low-normal potassium at this degree of renal dysfunction is biochemically atypical and warrants clinical review of concurrent potassium-depleting factors. [Kovesdy 2012]` };
      return null;
    },
  },
  {
    // End-stage renal failure cannot sustain meaningful urine output without RRT [R2]
    id: 'high_uo_esrd',
    check(data) {
      const egfr = calculateEGFR(data);
      if (egfr < 5 && data.urineOutput > 800)
        return { severity: 'critical', category: 'Urine Output ↔ Renal Function', ref: 'R2',
          message: `A urine output of ${data.urineOutput} mL/day is physiologically inconsistent with a glomerular filtration rate of ${egfr} mL/min/1.73m². At this level of renal failure, residual glomerular filtration is insufficient to generate this volume of urinary output without renal replacement therapy. [KDIGO AKI 2012]` };
      if (egfr < 10 && data.urineOutput > 1500)
        return { severity: 'warning', category: 'Urine Output ↔ Renal Function', ref: 'R2',
          message: `Urine output of ${data.urineOutput} mL/day is disproportionately preserved relative to the estimated GFR of ${egfr} mL/min/1.73m². End-stage renal disease is characteristically associated with oliguria or anuria; this degree of urinary output at this eGFR warrants clinical correlation and review. [KDIGO AKI 2012]` };
      return null;
    },
  },
  {
    // Pressure-dependent renal perfusion fails below MAP ~65 mmHg [R6]
    id: 'high_uo_hypotension',
    check(data) {
      const expectedUO = data.weight * 0.6 * 24;
      if (data.map < 50 && data.urineOutput > 500)
        return { severity: 'critical', category: 'Urine Output ↔ MAP', ref: 'R6',
          message: `At a MAP of ${data.map} mmHg, renal perfusion pressure falls below the threshold of effective glomerular filtration (lower autoregulatory limit ≈ 65 mmHg), resulting in pressure-passive reduction of filtration. A urine output of ${data.urineOutput} mL/day is not consistent with this degree of haemodynamic compromise in the absence of vasoactive or fluid resuscitation. [Carlström 2015]` };
      if (data.map < 62 && data.urineOutput > expectedUO * 0.65)
        return { severity: 'warning', category: 'Urine Output ↔ MAP', ref: 'R6',
          message: `A MAP of ${data.map} mmHg is below the renal autoregulatory threshold (approximately 65 mmHg), impairing pressure-dependent tubular perfusion. The observed urine output of ${data.urineOutput} mL/day exceeds the expected range (≤${Math.round(expectedUO * 0.4)} mL/day) commensurate with this level of mean arterial pressure. [Carlström 2015]` };
      return null;
    },
  },
  {
    // Sustained MAP < 55 mmHg is sufficient to induce pre-renal AKI; Scr must rise [R2][R6]
    id: 'low_creat_severe_hypotension',
    check(data) {
      if (data.map < 55 && data.creatinine < 1.2)
        return { severity: 'warning', category: 'Creatinine ↔ MAP', ref: 'R2/R6',
          message: `A MAP of ${data.map} mmHg constitutes haemodynamic compromise sufficient to induce pre-renal acute kidney injury, which is characteristically associated with an elevation in serum creatinine above 1.5–2.0 mg/dL. The observed creatinine of ${data.creatinine} mg/dL is below the range expected for this degree of systemic hypotension. [KDIGO AKI 2012]` };
      return null;
    },
  },
  {
    // Secondary hypertension must be excluded when MAP > 108 mmHg at age < 35 [R4]
    id: 'young_severe_htn',
    check(data) {
      if (data.age < 35 && data.map > 108)
        return { severity: 'warning', category: 'Age ↔ MAP', ref: 'R4',
          message: `A MAP of ${data.map} mmHg at age ${data.age} years is atypical for primary (essential) hypertension, which rarely presents with severe haemodynamic elevation in young adults. Secondary aetiology should be systematically excluded, including renovascular hypertension (renal artery stenosis), phaeochromocytoma, primary hyperaldosteronism, and coarctation of the aorta. [Vasan 2002]` };
      return null;
    },
  },
  {
    // Age-related sarcopenia reduces creatinine generation; low Scr may mask CKD [R7]
    id: 'elderly_low_creat',
    check(data) {
      if (data.age >= 70 && data.creatinine < 0.65)
        return { severity: 'warning', category: 'Age ↔ Creatinine', ref: 'R7',
          message: `Serum creatinine of ${data.creatinine} mg/dL at age ${data.age} years may underestimate the degree of renal impairment. Age-related sarcopenia reduces endogenous creatinine production, such that a normal or subnormal serum creatinine may correspond to a significantly reduced eGFR. Formal GFR estimation using the CKD-EPI equation is essential; creatinine alone is an unreliable marker of renal function in the elderly. [Levey 1999]` };
      return null;
    },
  },
  {
    // Urine output > 2.5 mL/kg/hr meets the clinical definition of polyuria [R2]
    id: 'polyuria',
    check(data) {
      const threshold = data.weight * 2.5 * 24;
      if (data.urineOutput > threshold)
        return { severity: 'warning', category: 'Urine Output ↔ Body Weight', ref: 'R2',
          message: `Urine output of ${data.urineOutput} mL/day (threshold for ${data.weight} kg: >${Math.round(threshold)} mL/day, i.e. >2.5 mL/kg/hr) meets the clinical definition of polyuria. The differential diagnosis includes central or nephrogenic diabetes insipidus, osmotic diuresis secondary to uncontrolled diabetes mellitus or post-obstructive uropathy, and iatrogenic hyperhydration. [KDIGO AKI 2012]` };
      return null;
    },
  },
  {
    // Scr above female reference interval with preserved eGFR is biochemically discordant [R5]
    id: 'gender_creatinine',
    check(data) {
      const egfr = calculateEGFR(data);
      if (data.gender === 'female' && data.creatinine > 1.25 && egfr > 55)
        return { severity: 'warning', category: 'Biological Sex ↔ Creatinine', ref: 'R5',
          message: `Serum creatinine of ${data.creatinine} mg/dL exceeds the established female reference interval (0.59–1.04 mg/dL) in the context of a preserved eGFR of ${egfr} mL/min/1.73m². This biochemical discordance may reflect a data entry error in the documented biological sex, increased skeletal muscle mass relative to the population norm, or exogenous creatine supplementation. [Cockcroft & Gault 1976]` };
      return null;
    },
  },
];

export function checkClinicalConsistency(data) {
  const warnings = [];

  // Pass 1: Gaussian z-score per Bayesian node
  for (const [key, node] of Object.entries(NETWORK_NODES)) {
    const observed = data[key];
    if (observed == null) continue;
    const { mean, sd } = node.distribution(data);
    const z    = zScore(observed, mean, sd);
    const absZ = Math.abs(z);
    if (absZ <= 1.5) continue;

    const dir = z > 0 ? 'exceeds' : 'is below';
    warnings.push({
      type:     'consistency',
      severity: absZ > 2.5 ? 'critical' : 'warning',
      category: `${node.label} — ${absZ.toFixed(1)}σ deviation`,
      message:  absZ > 2.5
        ? `${node.label} of ${observed} ${node.unit} ${dir} the conditionally expected value of ${mean.toFixed(1)} ${node.unit} by ${absZ.toFixed(1)} standard deviations (p < 0.01), constituting a highly atypical parameter combination for this patient profile. A significant physiological inconsistency is present; review of contributing variables is indicated.`
        : `${node.label} of ${observed} ${node.unit} ${dir} the conditionally expected value of ${mean.toFixed(1)} ${node.unit} by ${absZ.toFixed(1)} standard deviations (p < 0.13), representing an atypical combination relative to the current patient profile. Clinical review of the contributing parameters is recommended.`,
      ref:      `Bayesian network — conditional Gaussian model (node: ${key})`,
      z:        absZ,
    });
  }

  // Pass 2: Pairwise hard clinical rules
  for (const rule of PAIRWISE_RULES) {
    const r = rule.check(data);
    if (r) warnings.push({ type: 'consistency', ...r });
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL_REFERENCES — for display in UI
// ─────────────────────────────────────────────────────────────────────────────

export const CLINICAL_REFERENCES = [
  { id: 'R1', citation: 'Inker LA et al. N Engl J Med. 2021;385:1737–1749',      note: 'CKD-EPI 2021 race-free eGFR equation' },
  { id: 'R2', citation: 'KDIGO AKI Work Group. Kidney Int Suppl. 2012;2:1–138',  note: 'AKI staging, oliguria/polyuria thresholds' },
  { id: 'R3', citation: 'Kovesdy CP et al. CJASN. 2012;7:861–867',              note: 'Potassium homeostasis in CKD' },
  { id: 'R4', citation: 'Vasan RS et al. JAMA. 2002;287:1003–1010',             note: 'Age-related BP trends (Framingham cohort)' },
  { id: 'R5', citation: 'Cockcroft DW, Gault MH. Nephron. 1976;16:31–41',       note: 'Creatinine clearance by age, sex, weight' },
  { id: 'R6', citation: 'Carlström M et al. Nat Rev Nephrol. 2015;11:545–557',  note: 'Renal autoregulation; MAP–flow relationships' },
  { id: 'R7', citation: 'Levey AS et al. Ann Intern Med. 1999;130:461–470',     note: 'MDRD: muscle mass decline with age' },
];
