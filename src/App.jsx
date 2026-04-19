import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Sidebar           from './components/Sidebar.jsx';
import ControlPanel      from './components/ControlPanel.jsx';
import MainVisualization from './components/MainVisualization.jsx';
import ResultsPanel      from './components/ResultsPanel.jsx';
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

export default function App() {
  const [activeNav,    setActiveNav]    = useState('simulation');
  const [patientData,  setPatientData]  = useState(INITIAL);
  const [history,      setHistory]      = useState([]);
  const [beforeEGFR,   setBeforeEGFR]   = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastChanged,  setLastChanged]  = useState(null);
  const [relationshipData, setRelationshipData] = useState(null);

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

  // ── Handlers ────────────────────────────────────────────────────────────

  // Called from ControlPanel when the user moves a slider or edits a field.
  // changedKey identifies which feature triggered the change so the
  // propagation engine knows which downstream nodes to re-evaluate.
  const handleDataChange = useCallback((newData, changedKey) => {
    setPatientData(newData);
    if (changedKey) setLastChanged(changedKey);
  }, []);

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
      style={{ background: '#020812' }}
    >
      {/* 1 — Sidebar */}
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} alertCount={alertCount} />

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
    </div>
  );
}
