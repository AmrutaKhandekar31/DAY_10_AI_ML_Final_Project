from fastapi.testclient import TestClient

from app import app

client = TestClient(app)
GOOD = {"cleaning_frequency_per_day": 6, "staff_trained_pct": 95, "waste_disposal_score": 9,
        "water_quality_score": 9, "pest_sightings": 0, "temperature_c": 22, "humidity_pct": 50,
        "days_since_last_inspection": 20, "previous_violations": 0}
BAD = {**GOOD, "cleaning_frequency_per_day": 0, "staff_trained_pct": 20, "waste_disposal_score": 2,
       "water_quality_score": 2, "pest_sightings": 8, "previous_violations": 6, "days_since_last_inspection": 380}


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_clean_facility_is_low_risk():
    res = client.post("/predict", json={"facility_type": "Office", "inputs": GOOD})
    assert res.status_code == 200 and res.json()["risk_level"] == "Low"


def test_poor_facility_is_high_risk():
    res = client.post("/predict", json={"facility_type": "Restaurant", "inputs": BAD})
    assert res.json()["risk_level"] == "High"


def test_validation_rejects_out_of_range():
    res = client.post("/predict", json={"facility_type": "Office", "inputs": {**GOOD, "humidity_pct": 150}})
    assert res.status_code == 422
