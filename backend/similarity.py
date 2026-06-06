"""
Patient similarity (k-NN) and cohort clustering (k-means) for case comparison.
"""
from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sklearn.cluster import KMeans
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

router = APIRouter()

FEATURE_ORDER: List[str] = [
    "age",
    "bmi",
    "creatinine",
    "egfr",
    "sex_female",
    "diabetes",
    "hypertension",
    "hdl",
    "total_chol",
    "hemoglobin",
    "map",
    "weight",
]


class ProgressPointIn(BaseModel):
    date: str = ""
    egfr: float = 0.0


class CaseIn(BaseModel):
    id: str
    displayName: str = ""
    features: Dict[str, float]
    planSummary: str = ""
    progress: List[ProgressPointIn] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    cohort: List[CaseIn]
    query: CaseIn
    k: int = Field(default=8, ge=1, le=50)


class NeighborOut(BaseModel):
    caseId: str
    rank: int
    distance: float
    contributions: List[Dict[str, Any]]


class ClusterOut(BaseModel):
    id: int
    label: str
    memberIds: List[str]


class AnalyzeResponse(BaseModel):
    neighbors: List[NeighborOut]
    clusters: List[ClusterOut]
    queryClusterId: int
    queryClusterLabel: str
    clusterIdByCaseId: Dict[str, int]


def _vector(features: Dict[str, float]) -> np.ndarray:
    return np.array([float(features.get(f, 0.0) or 0.0) for f in FEATURE_ORDER], dtype=np.float64)


def _cohort_matrix(cases: List[CaseIn]) -> np.ndarray:
    return np.vstack([_vector(c.features) for c in cases])


def _label_cluster(centroid: np.ndarray) -> str:
    """Human-readable label from cluster centroid (original feature scale)."""
    age, bmi, cr, egfr = float(centroid[0]), float(centroid[1]), float(centroid[2]), float(centroid[3])
    dm, htn = float(centroid[5]), float(centroid[6])
    egfr_b = []
    if egfr >= 90:
        egfr_b.append("Preserved GFR")
    elif egfr >= 60:
        egfr_b.append("Mild CKD pattern")
    elif egfr >= 45:
        egfr_b.append("Moderate CKD (G3a)")
    elif egfr >= 30:
        egfr_b.append("G3b risk pattern")
    elif egfr >= 15:
        egfr_b.append("Advanced CKD (G4)")
    else:
        egfr_b.append("G5 / kidney failure pattern")

    cardio = []
    if dm >= 0.5 and htn >= 0.5:
        cardio.append("DM + HTN overlap")
    elif dm >= 0.5:
        cardio.append("Diabetes-dominant")
    elif htn >= 0.5:
        cardio.append("Hypertension-dominant")
    else:
        cardio.append("Fewer metabolic flags")

    renal = []
    if cr >= 2.5:
        renal.append("high creatinine")
    elif cr >= 1.5:
        renal.append("borderline creatinine")

    age_b = "older" if age >= 65 else "mid-life" if age >= 45 else "younger"
    parts = [egfr_b[0], f"{age_b} · BMI~{bmi:.0f}", cardio[0]]
    if renal:
        parts.append(renal[0])
    return " · ".join(parts)


def _pick_n_clusters(n_samples: int) -> int:
    if n_samples <= 1:
        return 1
    if n_samples == 2:
        return 2
    return int(min(4, max(2, n_samples // 2)))


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_similarity(body: AnalyzeRequest) -> AnalyzeResponse:
    if not body.cohort:
        raise HTTPException(status_code=400, detail="Cohort is empty — add saved cases first.")

    cohort = body.cohort
    case_by_id = {c.id: c for c in cohort}
    C = _cohort_matrix(cohort)
    q_vec = _vector(body.query.features).reshape(1, -1)

    scaler = StandardScaler()
    C_scaled = scaler.fit_transform(C)
    Q_scaled = scaler.transform(q_vec)

    n_samples = len(cohort)
    n_clusters = _pick_n_clusters(n_samples)

    if n_samples == 1:
        labels = np.array([0], dtype=int)
        q_cluster = 0
        centroids = C
    else:
        km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = km.fit_predict(C_scaled)
        q_cluster = int(km.predict(Q_scaled)[0])
        centroids = np.array(
            [C[labels == j].mean(axis=0) for j in range(n_clusters)]
        )

    cluster_id_by_case_id: Dict[str, int] = {}
    cluster_members: Dict[int, List[str]] = {i: [] for i in range(n_clusters)}
    for i, c in enumerate(cohort):
        cid = int(labels[i])
        cluster_id_by_case_id[c.id] = cid
        cluster_members[cid].append(c.id)

    clusters_out: List[ClusterOut] = []
    for j in range(n_clusters):
        members = cluster_members.get(j, [])
        if not members:
            continue
        mask = labels == j
        if mask.any():
            cen = C[mask].mean(axis=0)
        else:
            cen = C.mean(axis=0)
        clusters_out.append(
            ClusterOut(id=j, label=_label_cluster(cen), memberIds=members)
        )

    q_label = _label_cluster(centroids[q_cluster] if q_cluster < len(centroids) else C.mean(axis=0))

    k_use = min(body.k, n_samples)
    nn = NearestNeighbors(n_neighbors=k_use, metric="euclidean")
    nn.fit(C_scaled)
    dists, idxs = nn.kneighbors(Q_scaled, return_distance=True)
    idxs_flat = idxs[0].tolist()
    dists_flat = dists[0].tolist()

    q_scaled_row = Q_scaled[0]
    neighbors_out: List[NeighborOut] = []
    for idx, dist in zip(idxs_flat, dists_flat):
        c = cohort[idx]
        if c.id == body.query.id:
            continue
        diff = np.abs(q_scaled_row - C_scaled[idx])
        contributions = [
            {"feature": FEATURE_ORDER[i], "absDelta": float(diff[i])}
            for i in range(len(FEATURE_ORDER))
        ]
        contributions.sort(key=lambda x: x["absDelta"], reverse=True)
        neighbors_out.append(
            NeighborOut(
                caseId=c.id,
                rank=len(neighbors_out) + 1,
                distance=float(dist),
                contributions=contributions[:6],
            )
        )
        if len(neighbors_out) >= body.k:
            break

    return AnalyzeResponse(
        neighbors=neighbors_out,
        clusters=clusters_out,
        queryClusterId=q_cluster,
        queryClusterLabel=q_label,
        clusterIdByCaseId=cluster_id_by_case_id,
    )
