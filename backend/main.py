import os
from io import BytesIO
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from similarity import router as similarity_router

BASE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH       = os.path.join(BASE, "CatBoost_Regressor_eGFR_prediction_model.pkl")
STACK_180_PATH   = os.path.join(BASE, "best_stacking_model_Estimated_Glomerular_Filtration_Rate_180mean.pkl")
STACK_360_PATH   = os.path.join(BASE, "best_stacking_model_Estimated_Glomerular_Filtration_Rate_360mean.pkl")

app = FastAPI()
app.include_router(similarity_router, prefix="/similarity", tags=["similarity"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model         = joblib.load(MODEL_PATH)
stack_180     = joblib.load(STACK_180_PATH)
stack_360     = joblib.load(STACK_360_PATH)
CAT_FEATURES: List[str] = list(model.feature_names_)
AGE_GROUP_DUMMIES = [c for c in CAT_FEATURES if c.startswith("Age_group_")]
BASE_CAT_FEATURES = [c for c in CAT_FEATURES if c not in AGE_GROUP_DUMMIES]


def age_group_bucket(age: float) -> str:
    age = float(age)
    if age < 40:
        return "<40"
    if age < 55:
        return "40-55"
    if age < 70:
        return "55-70"
    return "70+"


def age_group_dummies(series: pd.Series) -> pd.DataFrame:
    s = series.astype(str)
    return pd.DataFrame(
        {
            "Age_group_40-55": (s == "40-55").astype(float),
            "Age_group_55-70": (s == "55-70").astype(float),
            "Age_group_70+": (s == "70+").astype(float),
        }
    )


def add_engineered_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [str(c).strip() for c in out.columns]
    if "Unnamed: 0" in out.columns:
        out = out.drop(columns=["Unnamed: 0"])

    required = [
        "AgeBaseline",
        "Body Mass Index",
        "Total Cholesterol",
        "HDL Cholesterol",
        "Hemoglobin",
        "DM_episode",
        "Hypertension_Status",
    ]
    missing = [c for c in required if c not in out.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {missing}. Found: {list(out.columns)}",
        )

    tc = out["Total Cholesterol"].astype(float)
    hdl = out["HDL Cholesterol"].astype(float)
    bmi = out["Body Mass Index"].astype(float)

    if "Age_group" not in out.columns or out["Age_group"].isna().all():
        out["Age_group"] = out["AgeBaseline"].map(age_group_bucket)
    else:
        out["Age_group"] = out["Age_group"].fillna(out["AgeBaseline"].map(age_group_bucket))

    if "Chol_HDL_ratio" not in out.columns:
        out["Chol_HDL_ratio"] = tc / hdl.replace(0, np.nan)
    if "log_Total_Cholesterol" not in out.columns:
        out["log_Total_Cholesterol"] = np.log(np.maximum(tc, 1.0))
    if "log_HDL_Cholesterol" not in out.columns:
        out["log_HDL_Cholesterol"] = np.log(np.maximum(hdl, 1.0))
    if "log_Body_Mass_Index" not in out.columns:
        out["log_Body_Mass_Index"] = np.log(np.maximum(bmi, 0.1))
    if "BMI_sq" not in out.columns:
        out["BMI_sq"] = bmi ** 2
    if "Age_BMI" not in out.columns:
        out["Age_BMI"] = out["AgeBaseline"].astype(float) * bmi
    if "Age_Hb" not in out.columns:
        out["Age_Hb"] = out["AgeBaseline"].astype(float) * out["Hemoglobin"].astype(float)
    if "DMxHTN" not in out.columns:
        out["DMxHTN"] = out["DM_episode"].astype(float) * out["Hypertension_Status"].astype(float)
    if "Age_sq" not in out.columns:
        out["Age_sq"] = out["AgeBaseline"].astype(float) ** 2

    return out


def build_catboost_matrix(df: pd.DataFrame) -> pd.DataFrame:
    df2 = add_engineered_columns(df)
    dummies = age_group_dummies(df2["Age_group"])
    X = pd.concat([df2[BASE_CAT_FEATURES].copy(), dummies], axis=1)
    try:
        X = X[CAT_FEATURES]
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Feature alignment failed: {e}") from e
    return X


def sanitize_value(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    if isinstance(v, (np.integer, np.floating)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def sanitize_record(d: Dict[str, Any]) -> Dict[str, Any]:
    return {str(k): sanitize_value(v) for k, v in d.items()}


def chart_fields_from_row(row: pd.Series) -> Dict[str, Any]:
    r = row.to_dict()
    g = float(r.get("Gender", 0) or 0)
    return {
        "age": float(r.get("AgeBaseline", 50) or 50),
        "gender": "female" if g == 1.0 else "male",
        "creatinine": float(r.get("creatinine", r.get("Creatinine", 1.0)) or 1.0),
        "bmi": float(r.get("Body Mass Index", r.get("bmi", 25)) or 25),
        "totalCholesterol": float(r.get("Total Cholesterol", 185) or 185),
        "hdlCholesterol": float(r.get("HDL Cholesterol", 52) or 52),
        "diabetes": int(float(r.get("DM_episode", 0) or 0)),
        "hypertension": int(float(r.get("Hypertension_Status", 0) or 0)),
        "dmiEpisode": int(float(r.get("DM_episode", 0) or 0)),
        "hemoglobin": float(r.get("Hemoglobin", 13.5) or 13.5),
    }


def egfr_equations(row: Dict[str, Any]) -> Dict[str, float]:
    results: Dict[str, float] = {}
    scr = float(row.get("creatinine", 1.0))
    age = float(row.get("age", 50))
    gender = row.get("gender", "male")
    is_female = 1 if str(gender).lower() == "female" or str(gender) == "1.0" else 0
    is_black = 0

    kappa = 0.7 if is_female else 0.9
    alpha = -0.329 if is_female else -0.411
    sex_factor = 1.018 if is_female else 1.0
    race_factor = 1.159 if is_black else 1.0
    results["ckd_epi_2009"] = float(
        141
        * (min(scr / kappa, 1) ** alpha)
        * (max(scr / kappa, 1) ** -1.209)
        * (0.993**age)
        * sex_factor
        * race_factor
    )

    sex_factor_mdrd = 0.742 if is_female else 1.0
    race_factor_mdrd = 1.212 if is_black else 1.0
    results["mdrd_4"] = float(
        175 * (scr**-1.154) * (age**-0.203) * sex_factor_mdrd * race_factor_mdrd
    )

    sf1 = 0.742 if is_female else 1.0
    results["jpn_eq1"] = float(0.741 * 175.0 * (scr**-1.154) * (age**-0.203) * sf1)
    sf2 = 0.782 if is_female else 1.0
    results["jpn_eq2"] = float(171.0 * (scr**-1.004) * (age**-0.287) * sf2)
    sf3 = 0.742 if is_female else 1.0
    results["jpn_eq3"] = float(0.808 * 175.0 * (scr**-1.154) * (age**-0.203) * sf3)
    sf4 = 0.739 if is_female else 1.0
    results["jpn_eq4"] = float(194.0 * (scr**-1.094) * (age**-0.287) * sf4)

    return results


def row_dict_for_equations(row: pd.Series) -> Dict[str, Any]:
    r = row.to_dict()
    g = float(r.get("Gender", 0) or 0)
    return {
        "creatinine": float(r.get("creatinine", r.get("Creatinine", 1.0)) or 1.0),
        "age": float(r.get("AgeBaseline", r.get("age", 50)) or 50),
        "gender": "female" if g == 1.0 else "male",
    }


@app.get("/health")
def health():
    return {"ok": True, "model": os.path.basename(MODEL_PATH)}


@app.post("/predict_catboost")
async def predict_catboost(file: UploadFile = File(...)):
    try:
        raw = await file.read()
        df = pd.read_csv(BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}") from e

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV has no rows")

    try:
        X = build_catboost_matrix(df)
        preds = model.predict(X)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {e}") from e

    base_records = df.to_dict(orient="records")
    out: List[Dict[str, Any]] = []
    for i, rec in enumerate(base_records):
        merged = {**rec, "egfr_pred": float(preds[i])}
        merged.update(chart_fields_from_row(pd.Series(merged)))
        out.append(sanitize_record(merged))
    return out


class FutureEGFRRequest(BaseModel):
    gender: float            # 1.0 = female, 0.0 = male
    age: float
    dm_episode: float        # 0 or 1
    hypertension_status: float  # 0 or 1
    egfr: float              # current eGFR — will be log1p-transformed internally
    bmi: float
    hemoglobin: float


# Validation residual σ (MAE / 0.7979 for normal approximation)
_SIGMA_RES_180 = 4.89 / 0.7979   # ≈ 6.13 mL/min
_SIGMA_RES_360 = 5.92 / 0.7979   # ≈ 7.42 mL/min


def _build_features(req: FutureEGFRRequest) -> pd.DataFrame:
    return pd.DataFrame([{
        "Gender":                              req.gender,
        "AgeBaseline":                         req.age,
        "DM_episode":                          req.dm_episode,
        "Hypertension_Status":                 req.hypertension_status,
        "Estimated Glomerular Filtration Rate": np.log1p(req.egfr),
        "Body Mass Index":                     req.bmi,
        "Hemoglobin":                          req.hemoglobin,
    }])


def _predict_with_ci(features: pd.DataFrame):
    pred_180 = float(stack_180.predict(features)[0])
    pred_360 = float(stack_360.predict(features)[0])

    # Ensemble spread across the 3 base estimators (epistemic uncertainty)
    base_180 = np.array([float(e.predict(features)[0]) for e in stack_180.estimators_])
    base_360 = np.array([float(e.predict(features)[0]) for e in stack_360.estimators_])
    sigma_ens_180 = float(np.std(base_180))
    sigma_ens_360 = float(np.std(base_360))

    # Combined uncertainty: ensemble + irreducible residual
    sigma_180 = float(np.sqrt(sigma_ens_180 ** 2 + _SIGMA_RES_180 ** 2))
    sigma_360 = float(np.sqrt(sigma_ens_360 ** 2 + _SIGMA_RES_360 ** 2))

    return {
        "egfr_180":       round(max(1.0, pred_180), 1),
        "egfr_180_lower": round(max(1.0, pred_180 - 1.96 * sigma_180), 1),
        "egfr_180_upper": round(pred_180 + 1.96 * sigma_180, 1),
        "sigma_180":      round(sigma_180, 2),
        "egfr_360":       round(max(1.0, pred_360), 1),
        "egfr_360_lower": round(max(1.0, pred_360 - 1.96 * sigma_360), 1),
        "egfr_360_upper": round(pred_360 + 1.96 * sigma_360, 1),
        "sigma_360":      round(sigma_360, 2),
    }


@app.post("/predict_future_egfr")
async def predict_future_egfr(req: FutureEGFRRequest):
    return _predict_with_ci(_build_features(req))


class FutureEGFRBatchRequest(BaseModel):
    rows: List[FutureEGFRRequest]


@app.post("/predict_future_egfr_batch")
async def predict_future_egfr_batch(req: FutureEGFRBatchRequest):
    return [_predict_with_ci(_build_features(r)) for r in req.rows]


@app.post("/predict_equations")
async def predict_equations(file: UploadFile = File(...)):
    try:
        raw = await file.read()
        df = pd.read_csv(BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}") from e

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV has no rows")

    out: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        eq_in = row_dict_for_equations(row)
        eq = egfr_equations(eq_in)
        merged = {**row.to_dict(), **eq}
        merged.update(chart_fields_from_row(row))
        out.append(sanitize_record(merged))
    return out
