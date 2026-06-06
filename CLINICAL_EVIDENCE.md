# eGFR Dashboard — Clinical Evidence Reference Document

**Project:** eGFR Prediction & CKD Monitoring Dashboard  
**Authors:** Mallak & Hazem  
**Last Updated:** 2026-05-24  
**Purpose:** Master reference for all research papers, mathematical equations, causal relationships, probability models, and normal ranges used in the Bayesian network and prediction models.

---

## Table of Contents

1. [Research References](#1-research-references)
2. [All Mathematical Equations](#2-all-mathematical-equations)
3. [Causal Relationships Table](#3-causal-relationships-table)
4. [Probability Causal Model — How It Works](#4-probability-causal-model--how-it-works)
5. [Normal Ranges for All Features](#5-normal-ranges-for-all-features)
6. [KEGG Pathways & GO Biological Processes](#6-kegg-pathways--go-biological-processes)
7. [Gaps & Known Limitations](#7-gaps--known-limitations)

---

## 1. Research References

### R1 — CKD-EPI 2021 (Primary eGFR Equation)
**Citation:** Inker LA, Eneanya ND, Coresh J, et al. *New Creatinine– and Cystatin C–Based Equations to Estimate GFR without Race.* N Engl J Med. 2021;385:1737–1749.  
**DOI:** 10.1056/NEJMoa2102953  
**Status:** ✅ Current (2021 — most recent standard)  
**Used for:** eGFR calculation (race-free), age and sex correction, baseline filtration equation  
**Key equation:**
```
eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^(−1.200) × 0.9938^Age × [1.012 if female]
  where κ = 0.7 (female), 0.9 (male)
        α = −0.241 (female), −0.302 (male)
```

---

### R2 — KDIGO AKI Guidelines (Urine Output & AKI Staging)
**Citation:** KDIGO AKI Work Group. *KDIGO Clinical Practice Guideline for Acute Kidney Injury.* Kidney Int Suppl. 2012;2:1–138.  
**Status:** ⚠️ Partially dated — KDIGO 2024 update exists; oliguria thresholds unchanged  
**Used for:** Urine output normal ranges, oliguria definition, polyuria definition, AKI staging  
**Key thresholds:**
```
Normal urine output:  0.5–1.0 mL/kg/hr  (720–1440 mL/day for 60 kg person)
Oliguria:             < 0.5 mL/kg/hr    (< 720 mL/day for 60 kg)
Polyuria:             > 2.5 mL/kg/hr    (> 3600 mL/day for 60 kg)
Baseline model:       UO_base = weight × 0.6 mL/kg/hr × 24h
```

---

### R3 — Potassium Homeostasis in CKD
**Citation:** Kovesdy CP, Appel LJ, Grams ME, et al. *Potassium Homeostasis in Renal Function and Disease.* Clin J Am Soc Nephrol. 2012;7:861–867.  
**Status:** ✅ Still valid (K⁺ curve confirmed in recent CKD-MBD guidelines)  
**Used for:** Potassium accumulation as eGFR declines  
**Key equation:**
```
K⁺_expected = 4.10 + 0.90 × e^(−eGFR / 25)

eGFR 90  → K⁺ ≈ 4.12 mEq/L
eGFR 60  → K⁺ ≈ 4.18 mEq/L
eGFR 30  → K⁺ ≈ 4.37 mEq/L
eGFR 15  → K⁺ ≈ 4.59 mEq/L
eGFR  5  → K⁺ ≈ 4.83 mEq/L
```

---

### R4 — Age-Related Blood Pressure (Framingham Heart Study)
**Citation:** Vasan RS, Beiser A, Seshadri S, et al. *Residual Lifetime Risk for Developing Hypertension in Middle-aged Women and Men.* JAMA. 2002;287:1003–1010.  
**Status:** ⚠️ Old (2002) — valid estimate but newer Framingham analyses available  
**Used for:** MAP increase with age, age → HTN relationship  
**Key equation:**
```
MAP_expected = clamp(70 + max(0, age − 20) × 0.30,  min=60, max=105)
  Population SD = 12 mmHg
  Interpretation: +0.30 mmHg MAP per year of life after age 20
```

---

### R5 — Cockcroft-Gault Creatinine Clearance
**Citation:** Cockcroft DW, Gault MH. *Prediction of Creatinine Clearance from Serum Creatinine.* Nephron. 1976;16:31–41.  
**Status:** ⚠️ Classical (1976) — still used for drug dosing; replaced by CKD-EPI for GFR estimation  
**Used for:** Expected serum creatinine from age, weight, sex (reverse formula); muscle mass physiology  
**Key equation:**
```
CrCl = [(140 − age) × weight] / (72 × Scr) × 0.85 [if female]

Reversed to estimate expected Scr:
Scr_expected = [(140 − age) × weight] / (72 × CrCl_healthy) × sex_factor
  CrCl_healthy = max(30,  100 − max(0, age − 40) × 0.8)   [declines ~0.8 mL/min/yr after 40]
  sex_factor   = 0.85 (female),  1.0 (male)
  Population SD = 0.25 mg/dL
```

---

### R6 — Renal Autoregulation (MAP → Filtration)
**Citation:** Carlström M, Wilcox CS, Arendshorst WJ. *Renal Autoregulation in Health and Disease.* Nat Rev Nephrol. 2015;11:545–557.  
**Status:** ✅ Current  
**Used for:** MAP → urine output modifier, MAP → creatinine modifier  
**Key thresholds:**
```
MAP > 110 mmHg  → chronic hypertensive nephrosclerosis  → Scr rises × (1 + (MAP − 110) × 0.010)
MAP 65–110 mmHg → autoregulation intact                 → normal filtration
MAP 50–65 mmHg  → partial autoregulation failure        → UO modifier = 0.05 + 0.95 × (MAP − 50)/15
MAP < 50 mmHg   → autoregulation collapsed              → UO modifier = clamp((MAP − 30)/20, 0.05, 1)
                                                         → Scr rises × (1 + (60 − MAP) × 0.030)
```

---

### R7 — MDRD Study (Age & Muscle Mass)
**Citation:** Levey AS, Bosch JP, Lewis JB, et al. *A More Accurate Method to Estimate Glomerular Filtration Rate from Serum Creatinine.* Ann Intern Med. 1999;130:461–470.  
**Status:** ❌ Superseded by CKD-EPI 2021 for GFR calculation  
**Used for:** Conceptual basis of sarcopenia reducing creatinine production with age; age → creatinine (negative) relationship  
**Key concept:**
```
Skeletal muscle mass decreases ~0.5–1% per year after age 30.
Creatinine production ∝ muscle mass → elderly patients can have "normal" Scr with severely reduced GFR.
This is why age is a required input in all modern GFR equations.
```

---

### R8 — CKD Risk Equations (Primary Coefficient Source)
**Citation:** Nelson RG, Grams ME, Ballew SH, et al. *Development of Risk Prediction Equations for Incident Chronic Kidney Disease.* JAMA. 2019;322:2104–2114.  
**Status:** ✅ Current (2019)  
**Used for:** DM, HTN, BMI, Cholesterol, HDL, Hemoglobin effect sizes on eGFR; linear model coefficients  
**Key coefficients (linear eGFR model):**
```
eGFR_predicted = Intercept
  + Age          × (−0.62)        per year
  + DM_flag      × (−7.50)        if diabetes present
  + HTN_flag     × (−5.50)        if hypertension present
  + DM × HTN    × (−3.20)        interaction penalty (combined is worse)
  + Age × HTN   × (−0.02)        per year if hypertensive
  + BMI_excess   × (−0.45)        per BMI unit above 25
  + Cholesterol  × (−0.26)        per mg/dL rise (via vascular injury)
  + HDL_excess   × (+0.23)        per 10 mg/dL above 50 (protective)
  + Hemoglobin   × (+0.85)        per g/dL (renal oxygenation)
  + DMI_episode  × (−4.00)        per acute diabetic event (direct tubular injury)
```

---

### R9 — Diabetes ↔ Hypertension Causal Direction
**Citation:** Sun D, Zhou T, Heianza Y, et al. *Type 2 Diabetes and Hypertension: A Mendelian Randomization Study.* Circ Res. 2019;124:930–937.  
**Status:** ✅ Current (2019 — Mendelian randomization = strong causal design)  
**Used for:** DM → HTN causal direction (DM causes HTN, not the reverse as primary direction)  
**Key finding:**
```
DM → HTN:  causal effect weight +0.52  (endothelial dysfunction + RAAS activation)
HTN → DM:  weaker reverse causation (metabolic syndrome clustering)
The primary causal arrow goes DM → HTN.
```

---

### R10 — Project HeartBeat! BMI-Lipid Regressions
**Citation:** Labarthe DR, et al. *Project HeartBeat! A Longitudinal Study of Coronary Heart Disease Risk Factor Development.* Int J Obes. 2011;35:1144–1152.  
**Status:** ⚠️ Dated (2011) — slopes still cited; newer meta-analyses exist  
**Used for:** BMI → HDL and BMI → Total Cholesterol regression equations  
**Key equations:**
```
HDL_expected       = HDL_base − 0.777 × BMI           (HDL falls with obesity)
TotalChol_expected = TC_base  + 1.539 × BMI           (TC rises with obesity)
  HDL_base  ≈ 75 mg/dL (adjusted for sex/age)
  TC_base   ≈ 100 mg/dL (adjusted for sex/age)
```

---

### R11 — Bayesian Network for CKD (Design Reference)
**Citation:** Kanda E, Kashihara N, Kanesaki Y, et al. *A Bayesian Network Model for the Prediction of Chronic Kidney Disease Progression.* Sci Rep. 2019;9:5082.  
**Status:** ✅ Current (2019)  
**Used for:** Structural design of the KBBN (Knowledge-Based Bayesian Network); DAG architecture principles  
**Key concept:**
```
Validated that CKD progression can be modeled as a Bayesian DAG.
Confirmed creatinine is the dominant node.
Supported multi-factor Gaussian belief propagation for clinical decision support.
```

---

## 2. All Mathematical Equations

### 2.1 — eGFR Calculation (CKD-EPI 2021) [R1]
```
κ = 0.7 (female), 0.9 (male)
α = −0.241 (female), −0.302 (male)

eGFR = 142
      × min(Scr/κ, 1)^α
      × max(Scr/κ, 1)^(−1.200)
      × 0.9938^Age
      × 1.012  [if female]

Physiological ceiling: eGFR is capped at 120 mL/min/1.73m² in all displays.
```

### 2.2 — Mean Arterial Pressure | Age [R4]
```
MAP_expected = clamp(70 + max(0, age − 20) × 0.30,  lo=60, hi=105)
SD           = 12 mmHg

Interpretation: Each year after 20 adds 0.30 mmHg to expected MAP.
Age 30 → MAP ≈ 73 mmHg
Age 50 → MAP ≈ 79 mmHg
Age 70 → MAP ≈ 85 mmHg
```

### 2.3 — Creatinine | Age, Weight, Sex, MAP [R5, R6, R7]
```
CrCl_healthy = max(30,  100 − max(0, age − 40) × 0.8)   [mL/min, declines after 40]
sex_factor   = 0.85 (female),  1.0 (male)
Scr_mean     = [(140 − age) × weight] / (72 × CrCl_healthy) × sex_factor

MAP modifier (chronic hypertension) [R6]:
  if MAP > 110:  Scr_mean × (1 + (MAP − 110) × 0.010)
  if MAP < 60:   Scr_mean × (1 + (60  − MAP) × 0.030)

Final: Scr_expected = clamp(Scr_mean,  lo=0.4, hi=1.8)
       SD = 0.25 mg/dL
```

### 2.4 — Potassium | eGFR [R3]
```
K⁺_expected = clamp(4.10 + 0.90 × e^(−eGFR / 25),  lo=3.5, hi=6.5)
SD           = 0.50 mEq/L
```

### 2.5 — Urine Output | Weight, MAP, eGFR [R2, R6]
```
UO_base  = weight × 0.6 × 24          [mL/day — 0.6 mL/kg/hr baseline]

MAP modifier [R6]:
  MAP < 50:        mapMod = clamp((MAP − 30) / 20,  0.05, 1.0)
  MAP 50–65:       mapMod = 0.05 + 0.95 × (MAP − 50) / 15
  MAP 65–75:       mapMod = 0.90 + 0.10 × (MAP − 65) / 10
  MAP ≥ 75:        mapMod = 1.0

eGFR modifier [R1, R2]:
  eGFR < 10:       egfrMod = 0.20
  eGFR 10–15:      egfrMod = 0.35
  eGFR 15–30:      egfrMod = 0.55
  eGFR 30–60:      egfrMod = 0.80
  eGFR ≥ 60:       egfrMod = 1.00

UO_expected = max(50, UO_base × mapMod × egfrMod)
SD           = max(200, UO_base × 0.45)
```

### 2.6 — Hemoglobin | Creatinine (Anemia of CKD) [Anemia of CKD literature]
```
Hb_expected = 14.8 − 1.2 × max(0, Creatinine − 1.0)
  Scr 1.0  → Hb ≈ 14.8 g/dL   (normal)
  Scr 2.0  → Hb ≈ 13.6 g/dL
  Scr 3.0  → Hb ≈ 12.4 g/dL
  Scr 5.0  → Hb ≈ 10.0 g/dL
  Scr 7.0  → Hb ≈  7.6 g/dL   (severe anemia of CKD)
```

### 2.7 — Hemoglobin | Diabetes [R8, Diabetes & Anemia literature]
```
DM penalty: −0.55 g/dL per DM unit (EPO suppression + chronic inflammation)
Combined model: Hb_expected = 14.8 − 1.2 × max(0, Scr − 1) − 0.55 × DM_flag
```

### 2.8 — BMI → HDL [R10]
```
HDL_expected = HDL_base − 0.777 × BMI
  HDL_base ≈ 75 mg/dL (sex/age adjusted)
  BMI 25 → HDL ≈ 55.6 mg/dL
  BMI 30 → HDL ≈ 51.7 mg/dL
  BMI 35 → HDL ≈ 47.8 mg/dL
```

### 2.9 — BMI → Total Cholesterol [R10]
```
TC_expected = TC_base + 1.539 × BMI
  TC_base ≈ 100 mg/dL (sex/age adjusted)
  BMI 25 → TC ≈ 138 mg/dL
  BMI 30 → TC ≈ 146 mg/dL
  BMI 35 → TC ≈ 154 mg/dL
```

### 2.10 — Linear eGFR Prediction Model [R8]
```
eGFR_predicted = Baseline
  − 0.62  × Age
  − 7.50  × DM_flag
  − 5.50  × HTN_flag
  − 3.20  × (DM_flag × HTN_flag)    [interaction: combined damage > additive]
  − 0.02  × (Age × HTN_flag)        [HTN damage worsens with age]
  − 0.45  × max(0, BMI − 25)        [only excess BMI penalizes eGFR]
  − 0.26  × Total_Cholesterol_excess
  + 0.23  × max(0, (HDL − 50) / 10) [protective above 50 mg/dL]
  + 0.85  × Hemoglobin
  − 4.00  × DMI_episodes
  − 12.0  × Creatinine               [dominant term, non-linear in CKD-EPI]
```

---

## 3. Causal Relationships Table

### 3.1 — Creatinine Relationships

| Feature 1 | Feature 2 | Mathematical Relation | Type | Medical Interpretation | Reference |
|---|---|---|---|---|---|
| Age | Creatinine | Scr ↑ ∝ Age | Positive | Aging ↓ GFR → ↑ creatinine (sarcopenia reduces production, declining GFR reduces clearance) | CKD-EPI [R1], Cockcroft-Gault [R5], MDRD [R7] |
| Sex (Male) | Creatinine | Scr_male > Scr_female | Categorical | Males have ~15% more muscle mass → ×0.85 female correction factor | Cockcroft-Gault [R5] |
| BMI | Creatinine | Scr ∝ Lean Mass ⊂ BMI | Weak positive, nonlinear | Lean mass (muscle) component of BMI drives creatinine production | Body Composition [R5] |
| DM | Creatinine | Scr ↑ ∝ DM | Positive (weight +0.63) | Diabetic nephropathy: hyperfiltration → mesangial expansion → glomerulosclerosis | DKD literature [R8] |
| HTN | Creatinine | Scr ↑ ∝ HTN | Positive (weight +0.55) | Hypertensive nephrosclerosis: afferent arteriole scarring | HTN & CKD [R8] |
| Creatinine | Hemoglobin | Scr ↑ → Hb ↓ | Inverse | CKD → ↓ EPO → anemia of CKD | Anemia of CKD |
| Creatinine | HDL | Weak inverse | Weak negative | CKD associated with dyslipidemia via lipid metabolism disruption | Dyslipidemia in CKD |
| Cholesterol | eGFR | Chol ↑ → eGFR ↓ | Negative (−0.26) | Lipid-mediated renal vascular injury (atherosclerosis of renal arteries) | Lipids & Kidney [R8] |

### 3.2 — Age Relationships

| Feature 1 | Feature 2 | Mathematical Relation | Type | Medical Interpretation | Reference |
|---|---|---|---|---|---|
| Age | BMI | Nonlinear (U-shaped) | Complex | Aging → fat ↑, muscle ↓; BMI rises mid-life, may fall in frailty | Aging & Body Composition |
| Age | DM | P(DM) ↑ ∝ Age | Positive (+0.52) | Insulin resistance increases with age; 25-30% of >65yo have DM | Global DM Epidemiology |
| Age | HTN | P(HTN) ↑ ∝ Age | Strong positive (+0.62) | Arterial stiffening (vascular remodeling) with aging | Framingham [R4] |
| Age | Hemoglobin | Hb ↓ ∝ Age | Negative (indirect) | Reduced bone marrow response + declining eGFR reduces EPO | Anemia in Elderly |
| Age | MAP | MAP ↑ = +0.30/yr | Positive | Aortic stiffness → systolic BP rises | Framingham [R4] |
| Age | eGFR | eGFR ↓ = −0.62/yr | Negative | Physiological decline: ~1 mL/min/yr after age 40 | CKD-EPI [R1], Nelson [R8] |

### 3.3 — BMI Relationships

| Feature 1 | Feature 2 | Mathematical Relation | Type | Medical Interpretation | Reference |
|---|---|---|---|---|---|
| BMI | DM | P(DM) ↑ ∝ BMI | Strong positive (+0.66) | Adipokines from fat → insulin resistance → type 2 DM | Obesity & DM [R8] |
| BMI | HTN | BP ↑ ∝ BMI | Positive (+0.58) | Obesity → RAAS activation + increased blood volume + endothelial dysfunction | Obesity & HTN |
| BMI | Cholesterol | Chol ↑ ∝ BMI: TC = a + 1.539 × BMI | Positive (+0.39) | Obesity → liver overproduces VLDL → total cholesterol rises | Metabolic Syndrome [R10] |
| BMI | HDL | HDL ↓ ∝ BMI: HDL = a − 0.777 × BMI | Negative (−0.48) | High triglycerides in obesity displace HDL | HDL & Obesity [R10] |
| BMI | eGFR | eGFR ↓ = −0.45 × (BMI − 25) | Negative | Obesity → glomerular hyperfiltration → progressive glomerulosclerosis | Nelson [R8] |

### 3.4 — Lipid & Disease Relationships

| Feature 1 | Feature 2 | Mathematical Relation | Type | Medical Interpretation | Reference |
|---|---|---|---|---|---|
| Cholesterol | HTN | Positive correlation | Moderate (+0.19) | Atherosclerotic plaques stiffen arteries → BP rises | Lipids & HTN |
| HDL | Cholesterol | Inverse balance | Negative | HDL removes cholesterol from walls; they are metabolically opposed | HDL Function |
| HTN | DM | Strong positive (clustered) | Bidirectional (+0.52) | Metabolic syndrome: both share insulin resistance and RAAS dysfunction as common drivers | Metabolic Syndrome [R9] |
| DM | HTN | DM → HTN (+0.52, primary direction) | Causal (Mendelian RCT) | Endothelial dysfunction + RAAS activation from chronic hyperglycemia raises BP | Sun 2019 [R9] |

### 3.5 — Hemoglobin Relationships

| Feature 1 | Feature 2 | Mathematical Relation | Type | Medical Interpretation | Reference |
|---|---|---|---|---|---|
| DM | Hemoglobin | Hb ↓ ∝ DM (−0.55 g/dL) | Negative | Chronic inflammation + EPO suppression + functional iron deficiency | DM & Anemia |
| HTN | Hemoglobin | Weak negative | Weak (indirect) | HTN → CKD → EPO deficiency → anemia (mediated by eGFR decline) | Anemia in CKD |
| Creatinine | Hemoglobin | Hb = 14.8 − 1.2 × max(0, Scr − 1) | Inverse | Peritubular EPO-producing cells destroyed as CKD progresses | Anemia of CKD |
| Hemoglobin | eGFR | eGFR ↑ = +0.85 per g/dL | Positive | Low Hb → renal hypoxia → tubular damage → worsens GFR | Nelson [R8] |

---

## 4. Probability Causal Model — How It Works

### Architecture: Conditional Gaussian Bayesian Network (KBBN)

The network is a **Knowledge-Based Bayesian Network (KBBN)**:
- **Structure** (DAG edges) = from medical literature (causal direction confirmed by papers above)
- **Parameters** (conditional distributions) = fitted to published population norms
- **Inference** = forward-pass Gaussian belief propagation

### Step-by-step mechanism:

**Step 1 — Each feature node has a conditional distribution:**
```
P(Xi | parents(Xi)) ~ Normal(μ_i(parents), σ_i²)

μ_i = expected value computed from parent values using the published equation
σ_i = population standard deviation around that expected value
```

**Step 2 — Z-score = how far the observed value deviates from expected:**
```
z = (observed − μ_expected) / σ

|z| ≤ 1.5  → within normal range   (probability > 13%) → no flag
|z| > 1.5  → atypical combination  (probability < 13%) → warning
|z| > 2.5  → highly atypical       (probability < 1%)  → critical alert
```

**Step 3 — When any feature changes, the network propagates forward:**
```
Propagation order (topological sort of DAG):
  age, weight, sex  →  MAP
  age, weight, sex, MAP  →  creatinine
  creatinine  →  eGFR  →  potassium
  weight, MAP, eGFR  →  urineOutput
  DM  →  hemoglobin
  creatinine  →  hemoglobin
```

**Step 4 — Pairwise hard rules (non-Gaussian checks):**
Some relationships are non-linear or threshold-based and are checked as explicit pairwise rules:
```
K⁺ < 4.5 with eGFR < 10   → critical (excretion is physiologically impossible)
UO > 800 mL/day with eGFR < 5  → critical (filtrate volume is impossible)
MAP < 50 with UO > 500     → critical (autoregulation collapsed)
Scr < 1.2 with MAP < 55    → warning  (AKI expected but creatinine normal)
Age < 35 with MAP > 108    → warning  (secondary HTN must be excluded)
Age ≥ 70 with Scr < 0.65  → warning  (sarcopenia masking CKD)
UO > weight × 2.5 × 24    → warning  (polyuria definition)
Female with Scr > 1.25 and eGFR > 55  → warning (sex-creatinine discordance)
```

**What the model does NOT do:**
- It does NOT perform full Bayesian posterior update (no backwards inference from child to parent)
- It does NOT handle cycles (DM ↔ HTN bidirectional requires loopy belief propagation)
- The coefficients are literature-derived, not trained on local patient data

---

## 5. Normal Ranges for All Features

| Feature | Normal Range | Unit | Notes |
|---|---|---|---|
| **eGFR** | ≥ 90 (G1), 60–89 (G2), 45–59 (G3A), 30–44 (G3B), 15–29 (G4), < 15 (G5) | mL/min/1.73m² | CKD-EPI 2021; physiological maximum capped at 120 |
| **Creatinine** | Male: 0.74–1.35 / Female: 0.59–1.04 | mg/dL | Lab reference intervals |
| **MAP** | 70–100 | mmHg | < 65: hypotension / renal risk; > 105: hypertension |
| **Potassium K⁺** | 3.5–5.0 | mEq/L | > 5.5: hyperkalemia (cardiac risk); < 3.5: hypokalemia |
| **Urine Output** | 800–2000 | mL/day | < 500: oliguria (for avg adult); > 3000: polyuria |
| **Hemoglobin** | Male: 13.5–17.5 / Female: 12.0–15.5 | g/dL | < 12 (female) / < 13 (male): anemia threshold |
| **BMI** | 18.5–24.9 (normal) | kg/m² | 25–29.9: overweight; ≥ 30: obese; < 18.5: underweight |
| **Total Cholesterol** | < 200 (desirable) | mg/dL | 200–239: borderline high; ≥ 240: high |
| **HDL Cholesterol** | > 60 (protective) | mg/dL | 40–60: normal; < 40 (male) / < 50 (female): low (risk) |
| **Age** | 18–90 | years | Model validated for adult range |
| **Weight** | 40–150 | kg | Used in Cockcroft-Gault and urine output models |
| **Mean Arterial Pressure** | 70–100 | mmHg | = (SBP + 2×DBP) / 3; normal 70–100 |

### CKD Stage Classification (KDIGO)

| Stage | eGFR | Description |
|---|---|---|
| G1 | ≥ 90 | Normal or high |
| G2 | 60–89 | Mildly decreased |
| G3A | 45–59 | Mild to moderate decrease |
| G3B | 30–44 | Moderate to severe decrease |
| G4 | 15–29 | Severely decreased |
| G5 | < 15 | Kidney failure (dialysis or transplant) |

---

## 6. KEGG Pathways & GO Biological Processes

### What KEGG and GO are

**KEGG (Kyoto Encyclopedia of Genes and Genomes)**
- Maintained by Kanehisa Lab, Kyoto University
- Each pathway (e.g., `hsa04614`) is manually curated from primary molecular biology literature
- Human pathways are prefixed `hsa`
- Verifiable at: `https://www.kegg.jp/pathway/[id]`

**GO (Gene Ontology)**
- Maintained by the GO Consortium (EBI, EMBL, Sanger Institute)
- Terms describe molecular functions, biological processes, and cellular components
- Each term has a stable ID (e.g., `GO:0003094`)
- Verifiable at: `https://www.ebi.ac.uk/QuickGO/term/[id]`

**How our annotations were assigned:** Manual biological annotation based on established mechanisms in the primary literature. These are NOT derived from computational enrichment analysis (e.g., RNA-seq) — they represent the known molecular pathways that mediate each clinical relationship.

### Pathway Assignments by Clinical Edge

| Clinical Edge | KEGG Pathways | GO Biological Processes |
|---|---|---|
| Age → MAP | hsa04614 (Renin-angiotensin), hsa04022 (cGMP-PKG) | GO:0008217 (BP regulation), GO:0001974 (vessel remodeling), GO:0007568 (ageing) |
| Age → Creatinine | hsa04218 (Cellular senescence), hsa04217 (Necroptosis) | GO:0007568 (ageing), GO:0014706 (striated muscle), GO:0006544 (glycine/creatine) |
| Age → DM | hsa04930 (T2DM), hsa04910 (insulin signaling) | GO:0007568 (ageing), GO:0032869 (insulin response), GO:0006006 (glucose) |
| Age → HTN | hsa04614 (Renin-angiotensin), hsa04022 (cGMP-PKG) | GO:0007568 (ageing), GO:0008217 (BP regulation), GO:0001974 (vessel remodeling) |
| BMI → DM | hsa04910 (insulin), hsa04930 (T2DM), hsa04932 (NAFLD) | GO:0032869 (insulin response), GO:0045598 (fat cell diff.), GO:0006006 (glucose) |
| BMI → HTN | hsa04614 (Renin-angiotensin), hsa04022 (cGMP-PKG) | GO:0045598 (fat cell diff.), GO:0008217 (BP reg.), GO:0001974 (vessel remodeling) |
| BMI → HDL | hsa04979 (cholesterol), hsa01212 (fatty acid) | GO:0042157 (lipoprotein), GO:0033344 (cholesterol efflux), GO:0006629 (lipid) |
| BMI → Cholesterol | hsa01212 (fatty acid), hsa04979 (cholesterol) | GO:0008203 (cholesterol), GO:0006629 (lipid), GO:0042157 (lipoprotein) |
| DM → Creatinine | hsa04933 (AGE-RAGE), hsa04930 (T2DM), hsa04066 (HIF-1) | GO:0006006 (glucose), GO:0003094 (glomerular filtration), GO:0001822 (kidney dev.) |
| DM → HTN | hsa04614 (Renin-angiotensin), hsa04910 (insulin), hsa04933 (AGE-RAGE) | GO:0032869 (insulin), GO:0008217 (BP reg.), GO:0006006 (glucose) |
| DM → eGFR | hsa04933 (AGE-RAGE), hsa04930 (T2DM) | GO:0006006 (glucose), GO:0003094 (glom. filtration), GO:0001822 (kidney dev.) |
| DM → Hemoglobin | hsa04066 (HIF-1/EPO), hsa04630 (JAK-STAT/EPO), hsa04933 (AGE-RAGE) | GO:0030218 (erythrocyte diff.), GO:0046879 (hormone/EPO), GO:0006006 (glucose) |
| HTN → Creatinine | hsa04614 (Renin-angiotensin), hsa05417 (atherosclerosis), hsa04022 (cGMP-PKG) | GO:0008217 (BP reg.), GO:0001974 (vessel remodeling), GO:0003094 (glom. filtration) |
| HTN → eGFR | hsa04614 (Renin-angiotensin) | GO:0008217 (BP reg.), GO:0003094 (glom. filtration) |
| Creatinine → eGFR | hsa04614 (Renin-angiotensin), hsa04960 (aldosterone-Na) | GO:0003094 (glom. filtration), GO:0001822 (kidney dev.), GO:0070293 (renal absorption) |
| Creatinine → K⁺ | hsa04960 (aldosterone-Na), hsa04961 (Ca/K reabsorption) | GO:0006813 (K⁺ transport), GO:0070293 (renal absorption), GO:0003094 (glom. filtration) |
| Creatinine → Urine Output | hsa04960 (aldosterone-Na) | GO:0003094 (glom. filtration), GO:0070293 (renal absorption), GO:0001822 (kidney dev.) |
| Creatinine → Hemoglobin | hsa04066 (HIF-1/EPO), hsa04630 (JAK-STAT) | GO:0030218 (erythrocyte diff.), GO:0046879 (EPO secretion), GO:0001822 (kidney dev.) |
| Cholesterol → eGFR | hsa05417 (atherosclerosis), hsa04979 (cholesterol) | GO:0008203 (cholesterol), GO:0003094 (glom. filtration), GO:0042157 (lipoprotein) |
| Cholesterol → HTN | hsa05417 (atherosclerosis), hsa04022 (cGMP-PKG) | GO:0042157 (lipoprotein), GO:0008217 (BP reg.), GO:0001974 (vessel remodeling) |
| HDL → eGFR | hsa04979 (cholesterol), hsa05417 (atherosclerosis) | GO:0033344 (cholesterol efflux), GO:0042157 (lipoprotein), GO:0003094 (glom. filtration) |
| Hemoglobin → eGFR | hsa04066 (HIF-1 hypoxia), hsa04630 (JAK-STAT) | GO:0030218 (erythrocyte diff.), GO:0003094 (glom. filtration), GO:0001889 (liver EPO) |
| MAP → Creatinine | hsa04614 (Renin-angiotensin), hsa04022 (cGMP-PKG), hsa05417 (atherosclerosis) | GO:0008217 (BP reg.), GO:0003094 (glom. filtration), GO:0001974 (vessel remodeling) |
| MAP → Urine Output | hsa04960 (aldosterone-Na), hsa04022 (cGMP-PKG) | GO:0003094 (glom. filtration), GO:0070293 (renal absorption), GO:0008217 (BP reg.) |
| Sex → Creatinine | hsa04010 (MAPK/muscle) | GO:0007548 (sex diff.), GO:0014706 (striated muscle), GO:0006544 (glycine/creatine) |
| Sex → HDL | hsa04979 (cholesterol), hsa04915 (estrogen) | GO:0007548 (sex diff.), GO:0042157 (lipoprotein), GO:0033344 (cholesterol efflux) |

---

## 7. Gaps & Known Limitations

### Missing direct edges (present in user's tables, not yet in clinicalRelationships.js):

| Missing Edge | Status | Reason |
|---|---|---|
| Age → Hemoglobin (direct) | ❌ Indirect only | Currently modeled as Age → eGFR → Cr → Hb chain only |
| HTN → DM (reverse direction) | ⚠️ One direction only | Only DM → HTN modeled; bidirectional cycling not implemented |
| Creatinine ↔ HDL (weak inverse) | ❌ Not modeled | Indirect via Cr → eGFR → dyslipidemia pathway |
| Age → BMI (U-shaped) | ⚠️ Linear only | Network uses linear +0.35; U-shape (rise then fall) not captured |

### Modeling limitations:

| Limitation | Impact | Future fix |
|---|---|---|
| Forward-only propagation | Cannot back-propagate (e.g., observing high K⁺ cannot update creatinine estimate) | Implement loopy belief propagation |
| Cycles not handled | DM ↔ HTN bidirectional not modeled | Add virtual cycle-breaking node |
| Coefficients from general population | May not reflect local patient population | Retrain on local dataset when available |
| Gaussian assumption | Some relationships (e.g., K⁺ at extreme eGFR) are exponential, not Gaussian | Use mixture models or log-normal for extreme values |
| R2 (KDIGO 2012) not updated | May miss 2024 AKI guideline refinements | Cross-check with KDIGO 2024 |

---

*Document generated from: `egfr-network.html`, `src/utils/clinicalRelationships.js`, `src/utils/egfrCalculation.js`, `backend/main.py`, and user-provided research tables.*
