import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Sidebar           from './components/Sidebar.jsx';
import ControlPanel      from './components/ControlPanel.jsx';
import MainVisualization from './components/MainVisualization.jsx';
import ResultsPanel      from './components/ResultsPanel.jsx';
import RelationshipsPage from './components/RelationshipsPage.jsx';
import {
  calculateEGFR,
  getCKDStage,
  getRiskAssessment,
  generateInsight,
  PRESETS,
} from './utils/egfrCalculation.js';
import {
  checkClinicalConsistency,
  computeAllPosteriors,
  getPropagationSuggestions,
} from './utils/clinicalRelationships.js';

const INITIAL     = PRESETS.normal;
const MAX_HISTORY = 30;
const AUTO_PROP_FIELDS = ['creatinine', 'hemoglobin', 'hdlCholesterol', 'totalCholesterol', 'diabetes', 'hypertension'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

function runLocalConditionalPropagation(prevData, nextData, changedKey) {
  const age = Number(nextData.age ?? 45);
  const bmi = Number(nextData.bmi ?? 27);
  const chol = Number(nextData.totalCholesterol ?? 185);
  const htn = Number(nextData.hypertension ?? 0);
  const dm = Number(nextData.diabetes ?? 0);
  const sexFemale = nextData.gender === 'female' ? 1 : 0;

  const propagated = { ...nextData };

  // Keep BMI coherent with weight changes (assume same height).
  if (changedKey === 'weight') {
    const prevWeight = Number(prevData.weight ?? nextData.weight ?? 70);
    const nextWeight = Number(nextData.weight ?? prevWeight);
    const prevBmi = Number(prevData.bmi ?? nextData.bmi ?? 25);
    if (prevWeight > 0 && changedKey !== 'bmi') {
      propagated.bmi = Number(clamp((prevBmi * nextWeight) / prevWeight, 16, 45).toFixed(1));
    }
  }

  const usedBmi = Number(propagated.bmi ?? bmi);
  const pDM = sigmoid(-8.2 + 0.11 * age + 0.17 * usedBmi + 0.9 * htn);
  const pHTN = sigmoid(-10.5 + 0.12 * age + 0.15 * usedBmi + 0.025 * chol + 0.85 * dm);

  const expectedCreatinine = clamp(0.58 + 0.011 * age + 0.06 * (1 - sexFemale) + 0.014 * (usedBmi - 25) + 0.34 * dm + 0.26 * htn, 0.5, 6.5);
  const expectedHemoglobin = clamp(14.8 - 0.05 * age - 0.55 * dm - 0.35 * htn - 1.2 * Math.max(0, expectedCreatinine - 1), 8, 17);
  const expectedHDL = clamp(57 - 0.62 * (usedBmi - 25) - 4.2 * dm + 3.2 * sexFemale, 25, 90);
  const expectedChol = clamp(172 + 0.58 * age + 1.3 * (usedBmi - 25) - 0.2 * expectedHDL, 120, 320);
  const expectedMap = clamp(72 + 0.34 * (age - 20) + 0.48 * (usedBmi - 25) + 7 * htn, 50, 140);
  const expectedPotassium = clamp(4.0 + 0.45 * Math.max(0, expectedCreatinine - 1) + 0.12 * dm, 3.0, 6.5);
  const expectedUrine = clamp((Number(nextData.weight ?? 70) * 0.6 * 24) * (expectedMap < 65 ? 0.55 : 1.0) * (expectedCreatinine > 2 ? 0.75 : 1.0), 80, 3500);

  const updates = {
    diabetes: pDM >= 0.5 ? 1 : 0,
    hypertension: pHTN >= 0.5 ? 1 : 0,
    creatinine: Number(expectedCreatinine.toFixed(2)),
    hemoglobin: Number(expectedHemoglobin.toFixed(2)),
    hdlCholesterol: Number(expectedHDL.toFixed(1)),
    totalCholesterol: Number(expectedChol.toFixed(1)),
    map: Number(expectedMap.toFixed(0)),
    potassium: Number(expectedPotassium.toFixed(1)),
    urineOutput: Number(expectedUrine.toFixed(0)),
  };

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== changedKey) propagated[key] = value;
  });

  return propagated;
}

export default function App() {
  const [activeNav,    setActiveNav]    = useState('simulation');
  const [patientData,  setPatientData]  = useState(INITIAL);
  const [history,      setHistory]      = useState([]);
  const [beforeEGFR,   setBeforeEGFR]   = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastChanged,  setLastChanged]  = useState(null);
  const [relationshipData, setRelationshipData] = useState(null);
  const isApplyingAutoPropagation = useRef(false);

  // ── Real-time clinical results ──────────────────────────────────────────
  const results = useMemo(() => {
    const fallbackEgfr = calculateEGFR(patientData);
    const egfr         = relationshipData?.egfrModel?.predictedEgfr ?? fallbackEgfr;
    const ckdStage    = getCKDStage(egfr);
    const risks       = getRiskAssessment({ ...patientData, egfr });
    const insight     = generateInsight({ ...patientData, egfr, ckdStage });
    const consistency = checkClinicalConsistency(patientData);
    return { egfr, ckdStage, risks, insight, consistency };
  }, [patientData, relationshipData]);

  // ── Bayesian posteriors — expected value of each feature given all others
  const posteriors = useMemo(
    () => computeAllPosteriors(patientData),
    [patientData],
  );

  // ── Propagation suggestions — what to adjust after the last slider move
  const propagationSuggestions = useMemo(() => {
    if (!lastChanged) return [];
    return getPropagationSuggestions(lastChanged, patientData);
  }, [patientData, lastChanged]);

  // ── History accumulation ────────────────────────────────────────────────
  const prevEGFR = useRef(results.egfr);
  useEffect(() => {
    if (results.egfr !== prevEGFR.current) {
      prevEGFR.current = results.egfr;
      setHistory(h => [...h.slice(-(MAX_HISTORY - 1)), { egfr: results.egfr, ts: Date.now() }]);
    }
  }, [results.egfr]);

  // ── Backend relationship model (pair table + BN + trends) ──────────────
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const payload = {
          features: {
            age: patientData.age,
            gender: patientData.gender,
            bmi: patientData.bmi,
            hdlCholesterol: patientData.hdlCholesterol,
            totalCholesterol: patientData.totalCholesterol,
            hemoglobin: patientData.hemoglobin,
            creatinine: patientData.creatinine,
            dmiEpisode: patientData.dmiEpisode,
            hypertension: patientData.hypertension,
            diabetes: patientData.diabetes,
          },
        };

        const response = await fetch('http://localhost:8787/api/simulation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Failed to load simulation backend data');
        const data = await response.json();
        setRelationshipData(data);
      } catch {
        // Keep app responsive if backend is not running.
      }
    }, 120);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [patientData]);

  // ── Conditional probability auto-propagation (causal direction) ─────────
  useEffect(() => {
    if (!relationshipData?.propagation || !lastChanged) return;
    if (isApplyingAutoPropagation.current) return;

    const expected = relationshipData.propagation.expected ?? {};
    const probs = relationshipData.propagation.probabilities ?? {};

    setPatientData((prev) => {
      const next = { ...prev };
      let touched = false;

      for (const key of AUTO_PROP_FIELDS) {
        if (key === lastChanged) continue;

        if (key === 'diabetes' || key === 'hypertension') {
          const p = Number(probs[key]);
          if (!Number.isFinite(p)) continue;
          const updatedBinary = p >= 0.5 ? 1 : 0;
          if (updatedBinary !== prev[key]) {
            next[key] = updatedBinary;
            touched = true;
          }
          continue;
        }

        const value = Number(expected[key]);
        if (!Number.isFinite(value)) continue;
        const delta = Math.abs(value - Number(prev[key] ?? 0));
        if (delta < 0.05) continue;

        next[key] = Number(value.toFixed(key === 'creatinine' || key === 'hemoglobin' ? 2 : 1));
        touched = true;
      }

      if (touched) isApplyingAutoPropagation.current = true;
      return touched ? next : prev;
    });
  }, [relationshipData, lastChanged]);

  useEffect(() => {
    if (!isApplyingAutoPropagation.current) return;
    const timer = setTimeout(() => {
      isApplyingAutoPropagation.current = false;
    }, 180);
    return () => clearTimeout(timer);
  }, [patientData]);

  // ── Handlers ────────────────────────────────────────────────────────────

  // Called from ControlPanel when the user moves a slider or edits a field.
  // changedKey identifies which feature triggered the change so the
  // propagation engine knows which downstream nodes to re-evaluate.
  const handleDataChange = useCallback((newData, changedKey) => {
    const propagated = changedKey ? runLocalConditionalPropagation(patientData, newData, changedKey) : newData;
    setPatientData(propagated);
    if (changedKey) setLastChanged(changedKey);
  }, [patientData]);

  // Applying a suggestion updates the feature and re-runs propagation from it.
  const handleApplySuggestion = useCallback((feature, value) => {
    setPatientData(prev => ({ ...prev, [feature]: value }));
    setLastChanged(feature);
  }, []);

  // Apply every current suggestion at once; clear lastChanged so no cascade.
  const handleApplyAllSuggestions = useCallback(() => {
    setPatientData(prev => {
      const next = { ...prev };
      propagationSuggestions.forEach(s => { next[s.feature] = s.suggestedValue; });
      return next;
    });
    setLastChanged(null);
  }, [propagationSuggestions]);

  const handleRun = useCallback(() => {
    setBeforeEGFR(results.egfr);
    setIsSimulating(true);
    setTimeout(() => setIsSimulating(false), 800);
  }, [results.egfr]);

  const alertCount = results.risks.filter(r => r.type === 'critical').length;

  return (
    <div
      className="h-screen flex overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #071428 0%, #050d1d 58%, #040916 100%)' }}
    >
      {/* 1 — Sidebar */}
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} alertCount={alertCount} />

      {activeNav === 'trends' ? (
        <RelationshipsPage />
      ) : (
        <>
          {/* 2 — Control panel */}
          <ControlPanel
            data={patientData}
            onChange={handleDataChange}
            onRun={handleRun}
            isSimulating={isSimulating}
            posteriors={posteriors}
            suggestions={propagationSuggestions}
            onApplySuggestion={handleApplySuggestion}
            onApplyAllSuggestions={handleApplyAllSuggestions}
          />

          {/* 3 — Main visualization */}
          <MainVisualization
            results={results}
            history={history}
            beforeEGFR={beforeEGFR}
            patientData={patientData}
          />

          {/* 4 — Results panel */}
          <ResultsPanel results={results} patientData={patientData} relationshipData={relationshipData} />
        </>
      )}
    </div>
  );
}
