/**
 * eGFR Calculation — CKD-EPI 2021 equation with clinical modifiers
 * Base formula: Inker LA, et al. (2021) NEJM 385:1737-1749
 */

export function calculateEGFR({ age, gender, creatinine, map, potassium, urineOutput, weight }) {
  const scr    = Math.max(0.1,  Number(creatinine));
  const ageVal = Math.max(18, Math.min(100, Number(age)));
  const mapVal = Number(map);
  const kVal   = Number(potassium);
  const uoVal  = Number(urineOutput);
  const wtVal  = Math.max(30, Number(weight));

  // CKD-EPI 2021 — race-free equation
  const isFemale        = gender === 'female';
  const kappa           = isFemale ? 0.7  : 0.9;
  const alpha           = isFemale ? -0.241 : -0.302;
  const femaleMultiplier = isFemale ? 1.012 : 1.0;

  const scrKappa = scr / kappa;
  let egfr = 142
    * Math.pow(Math.min(scrKappa, 1), alpha)
    * Math.pow(Math.max(scrKappa, 1), -1.200)
    * Math.pow(0.9938, ageVal)
    * femaleMultiplier;

  // MAP modifier — normal 70–100 mmHg
  if (mapVal > 105) {
    egfr *= Math.max(0.58, 1 - (mapVal - 105) * 0.0042);
  } else if (mapVal < 65) {
    egfr *= Math.max(0.44, 1 - (65 - mapVal) * 0.011);
  }

  // Urine output modifier — expected ~0.6 mL/kg/hr × 24 h
  const expectedUO = wtVal * 0.6 * 24;
  const uoRatio    = uoVal / expectedUO;
  if (uoRatio < 0.5) {
    egfr *= 0.55 + 0.45 * (uoRatio * 2);
  } else if (uoRatio < 0.85) {
    egfr *= 0.82 + 0.18 * ((uoRatio - 0.5) / 0.35);
  }

  // Potassium modifier — normal 3.5–5.0 mEq/L
  if (kVal > 5.5) {
    egfr *= Math.max(0.62, 1 - (kVal - 5.5) * 0.072);
  } else if (kVal > 5.0) {
    egfr *= 0.97 - (kVal - 5.0) * 0.024;
  } else if (kVal < 3.0) {
    egfr *= 0.91;
  }

  return Math.round(Math.max(1, Math.min(150, egfr)));
}

export function getCKDStage(egfr) {
  if (egfr >= 90) return {
    stage: 'Stage 1', label: 'Normal or High', shortLabel: 'Normal',
    description: 'Mild impairment', colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-400/10', borderClass: 'border-cyan-400/30',
    gaugeColor: '#00d4ff', severity: 1,
  };
  if (egfr >= 60) return {
    stage: 'Stage 2', label: 'Mildly Decreased', shortLabel: 'Mild',
    description: 'Mild impairment', colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-400/10', borderClass: 'border-emerald-400/30',
    gaugeColor: '#10b981', severity: 2,
  };
  if (egfr >= 45) return {
    stage: 'Stage 3A', label: 'Mild-Moderate Decline', shortLabel: 'Mod-Mild',
    description: 'Moderate decline', colorClass: 'text-yellow-400',
    bgClass: 'bg-yellow-400/10', borderClass: 'border-yellow-400/30',
    gaugeColor: '#facc15', severity: 3,
  };
  if (egfr >= 30) return {
    stage: 'Stage 3B', label: 'Moderate-Severe Decline', shortLabel: 'Mod-Severe',
    description: 'Moderate decline', colorClass: 'text-orange-400',
    bgClass: 'bg-orange-400/10', borderClass: 'border-orange-400/30',
    gaugeColor: '#fb923c', severity: 4,
  };
  if (egfr >= 15) return {
    stage: 'Stage 4', label: 'Severe Decrease', shortLabel: 'Severe',
    description: 'Severe decline', colorClass: 'text-red-400',
    bgClass: 'bg-red-400/10', borderClass: 'border-red-400/30',
    gaugeColor: '#f87171', severity: 5,
  };
  return {
    stage: 'Stage 5', label: 'Kidney Failure', shortLabel: 'Failure',
    description: 'Kidney failure risk', colorClass: 'text-red-500',
    bgClass: 'bg-red-500/15', borderClass: 'border-red-500/40',
    gaugeColor: '#ef4444', severity: 6,
  };
}

export function getRiskAssessment({ egfr, potassium, map, urineOutput, weight, creatinine }) {
  const risks = [];

  if (egfr < 15)
    risks.push({ type: 'critical', category: 'eGFR', message: `eGFR ${egfr} mL/min/1.73m² — CKD Stage 5 (kidney failure). Immediate nephrology evaluation is indicated; assessment for renal replacement therapy is required.` });
  else if (egfr < 30)
    risks.push({ type: 'critical', category: 'eGFR', message: `eGFR ${egfr} mL/min/1.73m² — CKD Stage 4 (severely decreased). Significant risk of progression to end-stage renal disease and acute-on-chronic kidney injury. Nephrology referral is indicated.` });
  else if (egfr < 60)
    risks.push({ type: 'warning', category: 'eGFR', message: `eGFR ${egfr} mL/min/1.73m² — CKD Stage 3 (moderately decreased). Serial monitoring of renal function, electrolytes, and blood pressure is recommended.` });

  if (potassium > 6.0)
    risks.push({ type: 'critical', category: 'Potassium', message: `Severe hyperkalaemia — K⁺ ${potassium} mEq/L. Risk of life-threatening cardiac arrhythmia (ventricular fibrillation, asystole). Urgent ECG assessment and potassium-lowering therapy are indicated.` });
  else if (potassium > 5.5)
    risks.push({ type: 'critical', category: 'Potassium', message: `Hyperkalaemia — K⁺ ${potassium} mEq/L. Consistent with impaired renal potassium excretion. ECG monitoring and nephrology review are indicated.` });
  else if (potassium > 5.0)
    risks.push({ type: 'warning', category: 'Potassium', message: `Borderline hyperkalaemia — K⁺ ${potassium} mEq/L. Serial monitoring is required; dietary potassium restriction and medication review should be considered.` });
  else if (potassium < 3.5)
    risks.push({ type: 'warning', category: 'Potassium', message: `Hypokalaemia — K⁺ ${potassium} mEq/L. Risk of cardiac arrhythmia and skeletal muscle weakness. Assessment for gastrointestinal or renal potassium losses is recommended.` });

  if (map > 115)
    risks.push({ type: 'critical', category: 'Blood Pressure', message: `Hypertensive emergency — MAP ${map} mmHg. Sustained elevation at this level carries an immediate risk of end-organ damage, including hypertensive nephropathy, hypertensive encephalopathy, and acute kidney injury.` });
  else if (map > 105)
    risks.push({ type: 'warning', category: 'Blood Pressure', message: `Elevated MAP — ${map} mmHg. Intraglomerular hypertension at this level accelerates nephrosclerosis and impairs autoregulatory glomerular filtration. Blood pressure optimisation is indicated.` });
  else if (map < 60)
    risks.push({ type: 'critical', category: 'Blood Pressure', message: `Haemodynamic compromise — MAP ${map} mmHg. Renal perfusion pressure is below the autoregulatory threshold, predisposing to pre-renal acute kidney injury and acute tubular necrosis.` });

  const expectedUO = weight * 0.5 * 24;
  if (urineOutput < expectedUO * 0.25)
    risks.push({ type: 'critical', category: 'Urine Output', message: `Severe oliguria — ${urineOutput} mL/day (<0.5 mL/kg/hr). Consistent with KDIGO AKI Stage 2–3 criteria. Urgent assessment for volume depletion, obstructive uropathy, or intrinsic renal failure is required.` });
  else if (urineOutput < expectedUO * 0.5)
    risks.push({ type: 'warning', category: 'Urine Output', message: `Reduced urine output — ${urineOutput} mL/day. Urinary output is below the expected range (0.5 mL/kg/hr); serial monitoring and assessment for early acute kidney injury are indicated.` });

  if (creatinine > 5.0)
    risks.push({ type: 'critical', category: 'Creatinine', message: `Markedly elevated serum creatinine — ${creatinine} mg/dL. Consistent with severe acute or chronic renal failure. Nephrology consultation and urgent electrolyte assessment are required.` });
  else if (creatinine > 2.0)
    risks.push({ type: 'warning', category: 'Creatinine', message: `Elevated serum creatinine — ${creatinine} mg/dL. Indicative of significant renal impairment. Review of nephrotoxic agents, fluid status, and urinary findings is recommended.` });

  return risks;
}

export function generateInsight({ egfr, creatinine, urineOutput, map, potassium, ckdStage, weight, age }) {
  const factors = [];
  if (creatinine > 2.0) factors.push(`elevated creatinine (${creatinine} mg/dL)`);
  else if (creatinine > 1.3) factors.push(`mildly raised creatinine (${creatinine} mg/dL)`);

  const expectedUO = weight * 0.5 * 24;
  if (urineOutput < expectedUO * 0.5) factors.push(`oliguria (${urineOutput} mL/day)`);

  if (map > 105) factors.push(`hypertension (MAP ${map} mmHg)`);
  else if (map < 65) factors.push(`low perfusion pressure (MAP ${map} mmHg)`);

  if (potassium > 5.5) factors.push(`hyperkalemia (K⁺ ${potassium} mEq/L)`);
  else if (potassium < 3.5) factors.push(`hypokalemia (K⁺ ${potassium} mEq/L)`);

  if (age > 65) factors.push(`advanced age (${age} yrs)`);

  if (factors.length === 0) {
    if (egfr >= 90)  return 'All parameters within normal range. Glomerular filtration is well-preserved.';
    if (egfr >= 60)  return 'Mild renal decline detected. Routine monitoring and lifestyle management recommended.';
    return 'Renal parameters require clinical review. No acute risk factors currently identified.';
  }

  const joined = factors.length === 1
    ? factors[0]
    : factors.slice(0, -1).join(', ') + ' and ' + factors[factors.length - 1];

  const verb = ckdStage.severity <= 2 ? 'mildly reduces'
             : ckdStage.severity <= 4 ? 'moderately reduces'
             : 'severely reduces';

  return `${joined.charAt(0).toUpperCase() + joined.slice(1)} ${verb} glomerular filtration to ${egfr} mL/min/1.73m² (${ckdStage.stage} — ${ckdStage.label}).`;
}

export const PRESETS = {
  normal:      { label: 'Normal',         age: 45, gender: 'male',   creatinine: 1.0,  map: 88,  potassium: 4.2, urineOutput: 1600, weight: 70, bmi: 25, hdlCholesterol: 52, totalCholesterol: 182, hemoglobin: 13.8, dmiEpisode: 0, hypertension: 0, diabetes: 0 },
  dehydration: { label: 'Dehydration',    age: 55, gender: 'male',   creatinine: 1.9,  map: 78,  potassium: 4.8, urineOutput: 550,  weight: 68, bmi: 27, hdlCholesterol: 46, totalCholesterol: 198, hemoglobin: 12.6, dmiEpisode: 1, hypertension: 1, diabetes: 0 },
  aki:         { label: 'AKI Event',      age: 62, gender: 'female', creatinine: 3.8,  map: 85,  potassium: 5.7, urineOutput: 280,  weight: 65, bmi: 31, hdlCholesterol: 40, totalCholesterol: 215, hemoglobin: 10.5, dmiEpisode: 1, hypertension: 1, diabetes: 1 },
  hypertension:{ label: 'Hypertension',   age: 58, gender: 'male',   creatinine: 1.7,  map: 122, potassium: 4.9, urineOutput: 1100, weight: 82, bmi: 32, hdlCholesterol: 42, totalCholesterol: 225, hemoglobin: 12.1, dmiEpisode: 0, hypertension: 1, diabetes: 1 },
  dialysis:    { label: 'Dialysis State', age: 67, gender: 'female', creatinine: 9.2,  map: 88,  potassium: 5.9, urineOutput: 120,  weight: 60, bmi: 29, hdlCholesterol: 38, totalCholesterol: 210, hemoglobin: 9.2, dmiEpisode: 1, hypertension: 1, diabetes: 1 },
};
