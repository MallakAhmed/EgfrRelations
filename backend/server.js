import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

const FEATURES = [
  'age',
  'gender',
  'bmi',
  'hdlCholesterol',
  'totalCholesterol',
  'dmiEpisode',
  'hypertension',
  'diabetes',
];

const REFERENCES = [
  { id: 'REF-1', citation: 'Inker LA et al. N Engl J Med. 2021;385:1737-1749', note: 'CKD-EPI 2021 eGFR equation.' },
  { id: 'REF-2', citation: 'Kanda E et al. Sci Rep. 2019;9:5082', note: 'Bayesian network for CKD progression design.' },
  { id: 'REF-3', citation: 'Scientific Reports. 2023; s41598-023-32279-z', note: 'CKD risk logistic equation with age, sex, HTN, DM.' },
  { id: 'REF-4', citation: 'Nelson RG et al. JAMA. 2019;322:2104-2114', note: 'Global CKD risk equations and feature effects.' },
  { id: 'REF-5', citation: 'Project HeartBeat! Int J Obes. 2011;35:1144-1152', note: 'BMI-lipid regression coefficients (HDL/TC trends).' },
  { id: 'REF-6', citation: 'Sun D et al. Circ Res. 2019;124:930-937', note: 'Diabetes-hypertension causal direction evidence.' },
  { id: 'REF-7', citation: 'Ofori E et al. J Clin Hypertens. 2022;24:1358-1369', note: 'eGFR decline with age/diabetes/hypertension.' },
];

const PAIR_PRIORS = {
  'age|gender': { weight: 0.06, direction: 'contextual', equation: 'Age distribution differs by sex in cohorts (adjustment term).' },
  'age|bmi': { weight: 0.19, direction: 'mixed', equation: 'BMI ~ a + b1*age + b2*age^2 (population trend).' },
  'age|hdlCholesterol': { weight: -0.22, direction: 'negative', equation: 'HDL ~ a + b*age (declines with aging in many cohorts).' },
  'age|totalCholesterol': { weight: 0.31, direction: 'positive', equation: 'TC ~ a + b1*age + b2*age^2 (age-associated rise).' },
  'age|dmiEpisode': { weight: 0.26, direction: 'positive', equation: 'logit(P(DMI episode)) = a + b*age.' },
  'age|hypertension': { weight: 0.47, direction: 'positive', equation: 'logit(P(HTN)) = a + b*age (Framingham-like trend).' },
  'age|diabetes': { weight: 0.35, direction: 'positive', equation: 'logit(P(DM)) = a + b*age.' },
  'gender|bmi': { weight: 0.15, direction: 'contextual', equation: 'BMI ~ a + b*sex + covariates.' },
  'gender|hdlCholesterol': { weight: 0.34, direction: 'positive', equation: 'HDL ~ a + b*sex (female generally higher HDL).' },
  'gender|totalCholesterol': { weight: 0.14, direction: 'contextual', equation: 'TC ~ a + b*sex + age interaction.' },
  'gender|dmiEpisode': { weight: 0.10, direction: 'contextual', equation: 'logit(P(DMI episode)) = a + b*sex.' },
  'gender|hypertension': { weight: 0.13, direction: 'contextual', equation: 'logit(P(HTN)) = a + b*sex + age interaction.' },
  'gender|diabetes': { weight: 0.11, direction: 'contextual', equation: 'logit(P(DM)) = a + b*sex + age interaction.' },
  'bmi|hdlCholesterol': { weight: -0.45, direction: 'negative', equation: 'HDL = a - 0.777*BMI + ... (Project HeartBeat slope).' },
  'bmi|totalCholesterol': { weight: 0.39, direction: 'positive', equation: 'TC = a + 1.539*BMI + ... (Project HeartBeat).' },
  'bmi|dmiEpisode': { weight: 0.22, direction: 'positive', equation: 'logit(P(DMI episode)) = a + b*BMI.' },
  'bmi|hypertension': { weight: 0.41, direction: 'positive', equation: 'logit(P(HTN)) = a + b*BMI (obesity effect).' },
  'bmi|diabetes': { weight: 0.48, direction: 'positive', equation: 'logit(P(DM)) = a + b*BMI.' },
  'hdlCholesterol|totalCholesterol': { weight: 0.28, direction: 'positive', equation: 'TC = HDL + LDL + TG/5 (lipid balance).' },
  'hdlCholesterol|dmiEpisode': { weight: -0.20, direction: 'negative', equation: 'logit(P(DMI episode)) = a - b*HDL.' },
  'hdlCholesterol|hypertension': { weight: -0.16, direction: 'negative', equation: 'logit(P(HTN)) = a - b*HDL + confounders.' },
  'hdlCholesterol|diabetes': { weight: -0.25, direction: 'negative', equation: 'logit(P(DM)) = a - b*HDL.' },
  'totalCholesterol|dmiEpisode': { weight: 0.24, direction: 'positive', equation: 'logit(P(DMI episode)) = a + b*TC.' },
  'totalCholesterol|hypertension': { weight: 0.19, direction: 'positive', equation: 'logit(P(HTN)) = a + b*TC.' },
  'totalCholesterol|diabetes': { weight: 0.18, direction: 'positive', equation: 'logit(P(DM)) = a + b*TC.' },
  'dmiEpisode|hypertension': { weight: 0.27, direction: 'positive', equation: 'logit(P(DMI episode)) = a + b*HTN.' },
  'dmiEpisode|diabetes': { weight: 0.36, direction: 'positive', equation: 'logit(P(DMI episode)) = a + b*DM.' },
  'hypertension|diabetes': { weight: 0.52, direction: 'positive', equation: 'OR(T2D->HTN) ~ 1.07; strong bidirectional comorbidity.' },
};

function keyFor(a, b) {
  return [a, b].sort().join('|');
}

function normalizeBinary(v) {
  return v ? 1 : 0;
}

function toNumericGender(gender) {
  return gender === 'female' ? 1 : 0;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function predictEgfr(features) {
  const age = Number(features.age ?? 45);
  const female = toNumericGender(features.gender);
  const bmi = Number(features.bmi ?? 27);
  const hdl = Number(features.hdlCholesterol ?? 50);
  const tc = Number(features.totalCholesterol ?? 185);
  const hb = Number(features.hemoglobin ?? 13.4);
  const creatinine = Number(features.creatinine ?? 1.0);
  const dmiEpisode = normalizeBinary(features.dmiEpisode);
  const hypertension = normalizeBinary(features.hypertension);
  const diabetes = normalizeBinary(features.diabetes);

  let egfr = 122
    - (0.62 * age)
    + (2.0 * female)
    - (0.45 * (bmi - 25))
    + (0.23 * (hdl - 50))
    - (0.30 * ((tc - 180) / 10))
    + (0.85 * (hb - 13))
    - (12.0 * (creatinine - 1))
    - (7.5 * diabetes)
    - (5.5 * hypertension)
    - (4.0 * dmiEpisode)
    - (3.2 * diabetes * hypertension)
    - (0.14 * bmi * diabetes)
    - (0.02 * age * hypertension)
    - (0.010 * tc * hypertension)
    + (0.22 * creatinine * hb);

  egfr = Math.max(5, Math.min(130, egfr));

  const effects = [
    { feature: 'age', effectPerUnit: -0.62, unit: 'year' },
    { feature: 'gender', effectPerUnit: 2.0, unit: 'female-vs-male baseline offset' },
    { feature: 'bmi', effectPerUnit: -0.45, unit: 'kg/m²' },
    { feature: 'hdlCholesterol', effectPerUnit: 0.23, unit: 'mg/dL' },
    { feature: 'totalCholesterol', effectPerUnit: -0.03, unit: 'mg/dL' },
    { feature: 'hemoglobin', effectPerUnit: 0.85, unit: 'g/dL' },
    { feature: 'creatinine', effectPerUnit: -12.0, unit: 'mg/dL' },
    { feature: 'dmiEpisode', effectPerUnit: -4.0, unit: 'episode flag' },
    { feature: 'hypertension', effectPerUnit: -5.5, unit: 'disease flag' },
    { feature: 'diabetes', effectPerUnit: -7.5, unit: 'disease flag' },
  ];

  return {
    predictedEgfr: Number(egfr.toFixed(1)),
    equation:
      'eGFR = 126 -0.62*age +2.2*female -0.45*(BMI-25) +0.28*(HDL-50) -0.35*((TC-180)/10) -8*diabetes -6*hypertension -4*dmiEpisode -3.5*(diabetes*hypertension)',
    effects,
  };
}

function propagateNetwork(features) {
  const age = Number(features.age ?? 45);
  const female = toNumericGender(features.gender);
  const bmi = Number(features.bmi ?? 27);
  const cholesterol = Number(features.totalCholesterol ?? 185);
  const hdl = Number(features.hdlCholesterol ?? 50);
  const dm = normalizeBinary(features.diabetes);
  const htn = normalizeBinary(features.hypertension);
  const creatinine = Number(features.creatinine ?? 1.0);
  const hemoglobin = Number(features.hemoglobin ?? 13.4);

  const pDM = sigmoid(-8.2 + 0.11 * age + 0.17 * bmi + 0.9 * htn);
  const pHTN = sigmoid(-10.5 + 0.12 * age + 0.15 * bmi + 0.025 * cholesterol + 0.85 * dm);
  const expectedCreatinine = Math.max(0.5, 0.58 + 0.011 * age + 0.06 * (1 - female) + 0.014 * (bmi - 25) + 0.34 * dm + 0.26 * htn);
  const expectedHemoglobin = Math.max(8, 14.8 - 0.05 * age - 0.55 * dm - 0.35 * htn - 1.2 * Math.max(0, creatinine - 1));
  const expectedHDL = Math.max(25, 57 - 0.62 * (bmi - 25) - 4.2 * dm + 3.2 * female);
  const expectedChol = Math.max(120, 172 + 0.58 * age + 1.3 * (bmi - 25) - 0.2 * hdl);
  const expectedEgfr = predictEgfr({
    ...features,
    creatinine: expectedCreatinine,
    hemoglobin: expectedHemoglobin,
    hdlCholesterol: expectedHDL,
    totalCholesterol: expectedChol,
  }).predictedEgfr;

  return {
    probabilities: {
      diabetes: Number(pDM.toFixed(4)),
      hypertension: Number(pHTN.toFixed(4)),
    },
    expected: {
      creatinine: Number(expectedCreatinine.toFixed(3)),
      hemoglobin: Number(expectedHemoglobin.toFixed(3)),
      hdlCholesterol: Number(expectedHDL.toFixed(3)),
      totalCholesterol: Number(expectedChol.toFixed(3)),
      egfr: Number(expectedEgfr.toFixed(3)),
    },
  };
}

function buildPairwiseTable() {
  const rows = [];
  for (let i = 0; i < FEATURES.length; i += 1) {
    for (let j = i + 1; j < FEATURES.length; j += 1) {
      const featureA = FEATURES[i];
      const featureB = FEATURES[j];
      const prior = PAIR_PRIORS[keyFor(featureA, featureB)] ?? {
        weight: 0.12,
        direction: 'contextual',
        equation: `${featureA} ~ a + b*${featureB} + covariates`,
      };

      rows.push({
        id: `${featureA}__${featureB}`,
        featureA,
        featureB,
        relationshipStrength: prior.weight,
        direction: prior.direction,
        equation: prior.equation,
        references: ['REF-2', 'REF-4'],
      });
    }
  }
  return rows;
}

function buildBayesianNetwork(features) {
  const nodes = [...FEATURES, 'egfr'].map((name) => ({ id: name }));
  const edges = [
    ['age', 'bmi', 0.19], ['age', 'totalCholesterol', 0.31], ['age', 'hypertension', 0.47], ['age', 'diabetes', 0.35], ['age', 'egfr', -0.62],
    ['gender', 'hdlCholesterol', 0.34], ['gender', 'bmi', 0.15], ['gender', 'egfr', 0.12],
    ['bmi', 'hdlCholesterol', -0.45], ['bmi', 'totalCholesterol', 0.39], ['bmi', 'hypertension', 0.41], ['bmi', 'diabetes', 0.48], ['bmi', 'egfr', -0.30],
    ['totalCholesterol', 'hypertension', 0.19], ['totalCholesterol', 'egfr', -0.18],
    ['hdlCholesterol', 'egfr', 0.16],
    ['diabetes', 'hypertension', 0.52], ['hypertension', 'diabetes', 0.31],
    ['dmiEpisode', 'diabetes', 0.36], ['dmiEpisode', 'egfr', -0.22],
    ['hypertension', 'egfr', -0.25], ['diabetes', 'egfr', -0.33],
  ].map(([from, to, weight]) => ({ from, to, weight }));

  const expected = {
    age: Number(features.age ?? 45),
    gender: features.gender ?? 'male',
    bmi: Number((24 + 0.04 * (Number(features.age ?? 45) - 45) + (toNumericGender(features.gender) ? -0.8 : 0.4)).toFixed(1)),
    hdlCholesterol: Number((56 - 0.55 * (Number(features.bmi ?? 27) - 25) + (toNumericGender(features.gender) ? 4 : 0)).toFixed(1)),
    totalCholesterol: Number((178 + 0.65 * (Number(features.age ?? 45) - 45) + 1.3 * (Number(features.bmi ?? 27) - 25)).toFixed(1)),
    dmiEpisode: normalizeBinary(features.dmiEpisode),
    hypertension: normalizeBinary(features.hypertension),
    diabetes: normalizeBinary(features.diabetes),
  };

  return { nodes, edges, expected };
}

function buildTrendSeries(features) {
  const trends = [
    { feature: 'age', points: [] },
    { feature: 'bmi', points: [] },
    { feature: 'hdlCholesterol', points: [] },
    { feature: 'totalCholesterol', points: [] },
  ];

  const ageStart = 20;
  const bmiStart = 18;
  const hdlStart = 30;
  const tcStart = 120;

  for (let i = 0; i < 16; i += 1) {
    trends[0].points.push({
      x: ageStart + i * 4,
      y: predictEgfr({ ...features, age: ageStart + i * 4 }).predictedEgfr,
    });
    trends[1].points.push({
      x: bmiStart + i * 1.5,
      y: predictEgfr({ ...features, bmi: bmiStart + i * 1.5 }).predictedEgfr,
    });
    trends[2].points.push({
      x: hdlStart + i * 3,
      y: predictEgfr({ ...features, hdlCholesterol: hdlStart + i * 3 }).predictedEgfr,
    });
    trends[3].points.push({
      x: tcStart + i * 8,
      y: predictEgfr({ ...features, totalCholesterol: tcStart + i * 8 }).predictedEgfr,
    });
  }
  return trends;
}

app.get('/api/references', (_req, res) => {
  res.json({ references: REFERENCES });
});

app.get('/api/relationships/pairwise', (_req, res) => {
  res.json({ pairwise: buildPairwiseTable() });
});

app.post('/api/simulation', (req, res) => {
  const features = req.body?.features ?? {};
  const egfrModel = predictEgfr(features);
  const pairwise = buildPairwiseTable();
  const bayesianNetwork = buildBayesianNetwork(features);
  const trends = buildTrendSeries(features);
  const propagation = propagateNetwork(features);

  res.json({
    features: FEATURES,
    egfrModel,
    pairwise,
    bayesianNetwork,
    trends,
    propagation,
    equationsFromPapers: [
      {
        id: 'CKD-EPI-2021',
        equation: 'eGFRcr = 142 * min(Scr/k,1)^a * max(Scr/k,1)^-1.200 * 0.9938^Age * 1.012(if female)',
        source: 'REF-1',
      },
      {
        id: 'CKD-5yr-logit',
        equation: 'P(CKD)=1/(1+exp(-(9.4876 + 0.0311*age + 0.2400*sex + 0.3470*HTN + 0.3444*DM - 0.1980*eGFR + ... )))',
        source: 'REF-3',
      },
      {
        id: 'BN-design',
        equation: 'P(X) = Π P(node | parents(node))  (Directed Acyclic Graph)',
        source: 'REF-2',
      },
    ],
    references: REFERENCES,
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`egfr-dashboard backend listening on http://localhost:${PORT}`);
});
