"""
Standalone Python REST API for the hygiene risk model (bonus deliverable).

  pip install -r requirements.txt
  uvicorn app:app --reload --port 8000
  -> POST http://localhost:8000/predict   (docs at /docs)

The deployed web app exposes the same contract at /api/public/predict.
"""
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_PATH = Path(__file__).parent.parent / "ml" / "outputs" / "hygiene_model.joblib"
model = joblib.load(MODEL_PATH)

app = FastAPI(title="Smart Hygiene Risk Prediction API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Inputs(BaseModel):
    cleaning_frequency_per_day: float = Field(ge=0, le=10)
    staff_trained_pct: float = Field(ge=0, le=100)
    waste_disposal_score: float = Field(ge=1, le=10)
    water_quality_score: float = Field(ge=1, le=10)
    pest_sightings: float = Field(ge=0, le=20)
    temperature_c: float = Field(ge=-10, le=60)
    humidity_pct: float = Field(ge=0, le=100)
    days_since_last_inspection: float = Field(ge=0, le=1000)
    previous_violations: float = Field(ge=0, le=50)


class PredictRequest(BaseModel):
    facility_type: Literal["Restaurant", "Hospital", "School", "Hotel", "Office"]
    inputs: Inputs


class PredictResponse(BaseModel):
    risk_level: Literal["High", "Low"]
    probability: float
    confidence: float
    model_version: str


def predict(req: PredictRequest) -> PredictResponse:
    row = pd.DataFrame([{**req.inputs.model_dump(), "facility_type": req.facility_type}])
    proba = float(model.predict_proba(row)[0, 1])
    level = "High" if proba >= 0.5 else "Low"
    return PredictResponse(risk_level=level, probability=round(proba, 4),
                           confidence=round(proba if level == "High" else 1 - proba, 4),
                           model_version="Logistic Regression v1.0.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict_endpoint(req: PredictRequest) -> PredictResponse:
    return predict(req)
