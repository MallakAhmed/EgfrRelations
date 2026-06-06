const STORAGE_KEY = 'renalai-case-library-v1';

/** Feature vector keys aligned with backend FEATURE_ORDER */
export function patientToFeatures(patientData, egfr) {
  return {
    age: Number(patientData.age ?? 45),
    bmi: Number(patientData.bmi ?? 25),
    creatinine: Number(patientData.creatinine ?? 1),
    egfr: Number(egfr ?? 90),
    sex_female: patientData.gender === 'female' ? 1 : 0,
    diabetes: Number(patientData.diabetes ?? 0),
    hypertension: Number(patientData.hypertension ?? 0),
    hdl: Number(patientData.hdlCholesterol ?? 52),
    total_chol: Number(patientData.totalCholesterol ?? 185),
    hemoglobin: Number(patientData.hemoglobin ?? 13.5),
    map: Number(patientData.map ?? 88),
    weight: Number(patientData.weight ?? 70),
  };
}

export function makeCaseId() {
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createCaseFromPatient(patientData, egfr, displayName) {
  return {
    id: makeCaseId(),
    displayName: displayName?.trim() || `Saved ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    features: patientToFeatures(patientData, egfr),
    planSummary: '',
    progress: [],
  };
}

export function loadCaseLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.map(normalizeCase);
  } catch {
    return [];
  }
}

function normalizeCase(c) {
  return {
    id: c.id || makeCaseId(),
    displayName: c.displayName || 'Untitled',
    createdAt: c.createdAt || Date.now(),
    features: { ...patientToFeatures({}, 90), ...(c.features || {}) },
    planSummary: typeof c.planSummary === 'string' ? c.planSummary : '',
    progress: Array.isArray(c.progress) ? c.progress.map((p) => ({
      date: p.date || '',
      egfr: Number(p.egfr ?? 0),
    })) : [],
  };
}

export function saveCaseLibrary(cases) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

/** Synthetic cohort for demos — varied CKD / metabolic profiles */
export function buildDemoCohort() {
  const seeds = [
    { displayName: 'Demo — preserved, low risk', age: 38, bmi: 24, creatinine: 0.85, egfr: 102, sex_female: 0, diabetes: 0, hypertension: 0, hdl: 58, total_chol: 168, hemoglobin: 14.2, map: 82, weight: 72 },
    { displayName: 'Demo — mild CKD, DM', age: 54, bmi: 31, creatinine: 1.25, egfr: 68, sex_female: 1, diabetes: 1, hypertension: 0, hdl: 44, total_chol: 198, hemoglobin: 12.8, map: 86, weight: 88 },
    { displayName: 'Demo — HTN, moderate CKD', age: 61, bmi: 28, creatinine: 1.55, egfr: 52, sex_female: 0, diabetes: 0, hypertension: 1, hdl: 46, total_chol: 205, hemoglobin: 13.1, map: 118, weight: 84 },
    { displayName: 'Demo — DM+HTN, G3b', age: 59, bmi: 33, creatinine: 2.1, egfr: 36, sex_female: 1, diabetes: 1, hypertension: 1, hdl: 38, total_chol: 218, hemoglobin: 11.9, map: 108, weight: 92 },
    { displayName: 'Demo — older, frail CKD', age: 76, bmi: 22, creatinine: 1.95, egfr: 34, sex_female: 1, diabetes: 0, hypertension: 1, hdl: 52, total_chol: 188, hemoglobin: 11.2, map: 96, weight: 58 },
    { displayName: 'Demo — obesity, early decline', age: 47, bmi: 36, creatinine: 1.15, egfr: 76, sex_female: 0, diabetes: 1, hypertension: 1, hdl: 36, total_chol: 232, hemoglobin: 14.0, map: 112, weight: 112 },
    { displayName: 'Demo — advanced CKD', age: 64, bmi: 26, creatinine: 3.4, egfr: 22, sex_female: 0, diabetes: 1, hypertension: 1, hdl: 35, total_chol: 210, hemoglobin: 10.4, map: 102, weight: 78 },
    { displayName: 'Demo — post-AKI recovery', age: 51, bmi: 27, creatinine: 1.85, egfr: 44, sex_female: 0, diabetes: 0, hypertension: 1, hdl: 42, total_chol: 195, hemoglobin: 12.3, map: 94, weight: 81 },
    { displayName: 'Demo — young, isolated HTN', age: 33, bmi: 25, creatinine: 0.92, egfr: 99, sex_female: 1, diabetes: 0, hypertension: 1, hdl: 62, total_chol: 172, hemoglobin: 13.6, map: 128, weight: 64 },
    { displayName: 'Demo — dialysis pathway', age: 69, bmi: 29, creatinine: 6.8, egfr: 12, sex_female: 1, diabetes: 1, hypertension: 1, hdl: 33, total_chol: 198, hemoglobin: 9.1, map: 98, weight: 70 },
  ];
  const now = Date.now();
  return seeds.map((s, i) => ({
    id: `demo-${now}-${i}`,
    displayName: s.displayName,
    createdAt: now - i * 3600000,
    features: {
      age: s.age,
      bmi: s.bmi,
      creatinine: s.creatinine,
      egfr: s.egfr,
      sex_female: s.sex_female,
      diabetes: s.diabetes,
      hypertension: s.hypertension,
      hdl: s.hdl,
      total_chol: s.total_chol,
      hemoglobin: s.hemoglobin,
      map: s.map,
      weight: s.weight,
    },
    planSummary: i % 3 === 0
      ? 'ACEi/ARB titration; SGLT2i per protocol; q3mo labs.'
      : i % 3 === 1
        ? 'BP goal <130/80; nephrology referral; renal diet education.'
        : 'Optimize glycemic control; avoid NSAIDs; monitor K+.',
    progress: buildDemoProgress(s.egfr),
  }));
}

function buildDemoProgress(currentEgfr) {
  const base = Math.min(130, currentEgfr + 8 + Math.random() * 6);
  return [
    { date: monthsAgo(12), egfr: Math.round(base) },
    { date: monthsAgo(6), egfr: Math.round(base - 4) },
    { date: monthsAgo(3), egfr: Math.round(base - 7) },
    { date: monthsAgo(0), egfr: Math.round(currentEgfr) },
  ];
}

function monthsAgo(m) {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString().slice(0, 10);
}
