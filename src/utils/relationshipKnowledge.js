export const RELATIONSHIP_TABLES = [
  {
    title: 'Creatinine-Centered Relationships',
    rows: [
      { f1: 'Creatinine', f2: 'Age', relation: 'Scr increases with Age', type: 'Positive', interpretation: 'Aging lowers filtration reserve and raises creatinine.', reference: 'CKD-EPI Equation Study' },
      { f1: 'Creatinine', f2: 'Gender', relation: 'Scr(male) > Scr(female)', type: 'Categorical', interpretation: 'Higher average muscle mass in males increases baseline creatinine.', reference: 'Creatinine Physiology' },
      { f1: 'Creatinine', f2: 'BMI', relation: 'Scr tracks lean-mass component of BMI', type: 'Weak nonlinear', interpretation: 'BMI contributes indirectly through body composition.', reference: 'Body Composition and Creatinine' },
      { f1: 'Creatinine', f2: 'DM', relation: 'Scr increases with DM burden', type: 'Positive', interpretation: 'Diabetic nephropathy progression raises creatinine.', reference: 'Diabetic Kidney Disease' },
      { f1: 'Creatinine', f2: 'HTN', relation: 'Scr increases with HTN', type: 'Positive', interpretation: 'Hypertension drives nephron damage over time.', reference: 'Hypertension and CKD' },
      { f1: 'Creatinine', f2: 'Hemoglobin', relation: 'Scr up implies Hb down', type: 'Inverse', interpretation: 'CKD reduces EPO activity and contributes to anemia.', reference: 'Anemia in CKD' },
      { f1: 'Creatinine', f2: 'HDL', relation: 'Weak inverse tendency', type: 'Weak', interpretation: 'Advanced CKD often co-exists with adverse lipid profile.', reference: 'Dyslipidemia in CKD' },
      { f1: 'Creatinine', f2: 'Cholesterol', relation: 'Scr tends to rise with Chol', type: 'Positive', interpretation: 'Lipid-mediated vascular injury can worsen renal function.', reference: 'Lipids and Kidney Disease' },
    ],
  },
  {
    title: 'Age and Metabolic Relationships',
    rows: [
      { f1: 'Age', f2: 'BMI', relation: 'Nonlinear (U-shaped)', type: 'U-shaped', interpretation: 'Aging shifts fat/muscle balance.', reference: 'Aging and Body Composition' },
      { f1: 'Age', f2: 'DM', relation: 'P(DM) increases with Age', type: 'Positive', interpretation: 'Diabetes prevalence rises in older populations.', reference: 'Global Diabetes Epidemiology' },
      { f1: 'Age', f2: 'HTN', relation: 'P(HTN) strongly increases with Age', type: 'Strong positive', interpretation: 'Arterial stiffness and vascular remodeling accumulate.', reference: 'Hypertension Epidemiology' },
      { f1: 'Age', f2: 'Hemoglobin', relation: 'Hb decreases with Age', type: 'Negative', interpretation: 'Reduced marrow responsiveness in elderly patients.', reference: 'Anemia in Elderly' },
    ],
  },
  {
    title: 'BMI and Cardio-Metabolic Relationships',
    rows: [
      { f1: 'BMI', f2: 'DM', relation: 'P(DM) increases with BMI', type: 'Strong positive', interpretation: 'Obesity promotes insulin resistance.', reference: 'Obesity and Diabetes' },
      { f1: 'BMI', f2: 'HTN', relation: 'Blood pressure increases with BMI', type: 'Positive', interpretation: 'RAAS activation and vascular load increase.', reference: 'Obesity and Hypertension' },
      { f1: 'BMI', f2: 'Cholesterol', relation: 'Cholesterol increases with BMI', type: 'Positive', interpretation: 'Obesity is linked to dyslipidemia.', reference: 'Metabolic Syndrome' },
      { f1: 'BMI', f2: 'HDL', relation: 'HDL decreases with BMI', type: 'Negative', interpretation: 'Obesity often lowers protective HDL.', reference: 'HDL and Obesity' },
    ],
  },
  {
    title: 'Clustered Disease-Lipid Relationships',
    rows: [
      { f1: 'Cholesterol', f2: 'HTN', relation: 'Moderate positive correlation', type: 'Moderate', interpretation: 'Atherosclerotic burden increases vascular resistance.', reference: 'Lipids and Hypertension' },
      { f1: 'HDL', f2: 'Cholesterol', relation: 'Inverse balance', type: 'Negative', interpretation: 'Higher HDL is generally protective in lipid context.', reference: 'HDL Function' },
      { f1: 'HTN', f2: 'DM', relation: 'Strong clustered relationship', type: 'Clustered', interpretation: 'Core components of metabolic syndrome.', reference: 'Metabolic Syndrome' },
    ],
  },
  {
    title: 'Hemoglobin Disease Relationships',
    rows: [
      { f1: 'Hemoglobin', f2: 'DM', relation: 'Hb tends to decrease with DM kidney damage', type: 'Negative', interpretation: 'Inflammation + renal impairment lower Hb.', reference: 'Diabetes and Anemia' },
      { f1: 'Hemoglobin', f2: 'HTN', relation: 'Weak negative', type: 'Weak', interpretation: 'Mainly mediated through CKD progression.', reference: 'Anemia in CKD' },
    ],
  },
];

export const INTERACTION_TERMS = ['BMI*DM', 'HTN*Cholesterol', 'Age*HTN', 'Creatinine*Hemoglobin'];

export const ALL_RELATIONSHIP_ROWS = RELATIONSHIP_TABLES.flatMap((section) => section.rows);

export const CAUSAL_EDGES = [
  ['Age', 'BMI', 0.35],
  ['Age', 'DM', 0.52],
  ['Age', 'HTN', 0.62],
  ['BMI', 'DM', 0.66],
  ['BMI', 'HTN', 0.58],
  ['BMI', 'HDL', -0.48],
  ['DM', 'Creatinine', 0.63],
  ['HTN', 'Creatinine', 0.55],
  ['Creatinine', 'eGFR', -0.82],
  ['Creatinine', 'Hemoglobin', -0.44],
  ['Hemoglobin', 'eGFR', 0.28],
  ['HDL', 'eGFR', 0.22],
  ['Cholesterol', 'eGFR', -0.26],
];

export const PROBABILITY_MODEL_NOTES = [
  'Use directional equations (causal) rather than symmetric correlation updates.',
  'Age and gender are exogenous causes and should not be back-updated by downstream markers.',
  'Creatinine, hemoglobin, and eGFR are mediator/outcome markers and should propagate forward.',
  'Binary states (DM, HTN, DMI episode) are best updated via logistic probabilities.',
];

const FEATURE_RANGES = {
  Age: { min: 20, max: 85, step: 5 },
  Gender: { categories: ['female', 'male'] },
  BMI: { min: 18, max: 42, step: 2 },
  DM: { categories: ['No', 'Yes'] },
  HTN: { categories: ['No', 'Yes'] },
  Hemoglobin: { min: 8, max: 17, step: 1 },
  HDL: { min: 30, max: 80, step: 5 },
  Cholesterol: { min: 130, max: 280, step: 10 },
  Creatinine: { min: 0.5, max: 4.5, step: 0.3 },
};

function makeLinear(min, max, step, direction = 'positive') {
  const points = [];
  const span = Math.max(1, (max - min) / step);
  for (let i = 0; i <= span; i += 1) {
    const x = Number((min + i * step).toFixed(2));
    const t = i / span;
    const y = direction === 'positive' ? 20 + 75 * t : 95 - 75 * t;
    points.push({ x, y: Number(y.toFixed(2)) });
  }
  return points;
}

function makeUShape(min, max, step) {
  const mid = (min + max) / 2;
  const half = (max - min) / 2;
  const points = [];
  for (let x = min; x <= max; x += step) {
    const z = (x - mid) / Math.max(1, half);
    const y = 30 + 60 * z * z;
    points.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  }
  return points;
}

function makeCategorical(categories, values) {
  return categories.map((c, idx) => ({ x: c, y: values[idx] ?? values[0] ?? 50 }));
}

export function buildRelationshipTrend(row) {
  const r1 = FEATURE_RANGES[row.f1];
  const relationText = `${row.relation} ${row.type}`.toLowerCase();
  const negative = relationText.includes('inverse') || relationText.includes('negative') || relationText.includes('down');
  const uShaped = relationText.includes('u-shaped');
  const categorical = relationText.includes('categorical') || row.f2 === 'Gender' || row.f1 === 'Gender';

  if (categorical) {
    return {
      chartType: 'bar',
      xLabel: row.f2,
      yLabel: `${row.f1} relative level`,
      data: makeCategorical(['female', 'male'], negative ? [72, 54] : [54, 72]),
    };
  }

  if (uShaped) {
    return {
      chartType: 'line',
      xLabel: row.f2,
      yLabel: `${row.f1} relative level`,
      data: makeUShape(r1?.min ?? 18, r1?.max ?? 85, r1?.step ?? 5),
    };
  }

  return {
    chartType: 'line',
    xLabel: row.f2,
    yLabel: `${row.f1} relative level`,
    data: makeLinear(r1?.min ?? 0, r1?.max ?? 100, r1?.step ?? 10, negative ? 'negative' : 'positive'),
  };
}
