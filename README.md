# Day 10 — Final Project: Smart Hygiene Risk Prediction System (AI/ML path)

A working system that predicts whether a facility (restaurant, hospital, school, hotel, office) is at
**high hygiene risk**. It covers every required stage: preprocessing, EDA, feature selection,
model training and evaluation, prediction, and visualisation. It also **exposes predictions through a REST API** (bonus).

```
day-10/
└── final-project/
    ├── frontend/   → web dashboard (source lives in the repo's /src, see frontend/README.md)
    ├── backend/    → Python FastAPI prediction service + tests
    ├── database/   → PostgreSQL schema (facilities, predictions) + seed data
    ├── ml/         → pipeline.py (the full ML workflow), dataset, charts, model artifacts, tests
    └── README.md
```

## 1. ML pipeline (`ml/pipeline.py`)
| Stage | What it does |
|---|---|
| Data | 2,000 synthetic inspection records with 12 features and a known risk mechanism (`data/hygiene_inspections.csv`). Missing values and sensor outliers are added on purpose. |
| Preprocessing | Removes duplicates, caps outliers using IQR, fills gaps with the median, scales numbers with StandardScaler, and one-hot encodes facility type (sklearn `Pipeline` + `ColumnTransformer`). |
| EDA | Summary stats, distributions by class, correlation heatmap, risk rate by facility type (`outputs/eda_*.png`, `eda.json`). |
| Feature selection | Mutual information + Recursive Feature Elimination; the union is kept (9 of 11 features). Dropped: handwash stations and daily footfall. |
| Training | Logistic Regression, Random Forest, Gradient Boosting; stratified 80/20 split + 5-fold CV. |
| Evaluation | Accuracy, precision, recall, F1, ROC-AUC, confusion matrix, ROC curves (`metrics.json`, `model_roc.png`, `model_confusion.png`). |
| Deployment | Logistic Regression had the best score (ROC-AUC ≈ 0.86) and is easy to interpret. It is saved as `hygiene_model.joblib` and also exported to `model.json` so the web app can run it. |

```bash
cd ml && pip install -r requirements.txt && python pipeline.py && pytest -q
```

## 2. Backend / REST API
* **Deployed:** `POST /api/public/predict` on the web app (validation with Zod → `422` on bad input). A live "try it" page is at `/api-docs`.
* **Python:** `backend/app.py` (FastAPI + Pydantic validation) serves the joblib model.
```bash
cd backend && pip install -r requirements.txt && uvicorn app:app --reload   # docs at :8000/docs
pytest -q
```
Example:
```bash
curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -d '{"facility_type":"Restaurant","inputs":{"cleaning_frequency_per_day":1,"staff_trained_pct":40,"waste_disposal_score":3,"water_quality_score":5,"pest_sightings":4,"temperature_c":28,"humidity_pct":75,"days_since_last_inspection":300,"previous_violations":3}}'
```

## 3. Database (`database/schema.sql`)
`facilities (1) ──< predictions (N)`. Each prediction row stores the inputs (jsonb), probability, risk level, confidence and model version. Row-level security allows public reads. Writes happen only through the server, after validation.

## 4. Frontend
Pages: Dashboard, New Assessment (validated form + explanation of the verdict), Prediction History (search/filter), Facilities (add + latest risk), Analytics (EDA, feature selection, model comparison, ROC, confusion matrix), REST API. Built from reusable components (`AppShell`, `StatCard`, `RiskBadge`, `PageHeader`). The layout adapts to phone screens and uses a collapsible sidebar.

## 5. Testing
* `ml/test_pipeline.py` — data generation, outlier capping, feature selection (3 tests)
* `backend/test_app.py` — health, low/high risk cases, validation (4 tests)
* `src/lib/risk-model.test.ts` — web inference + input validation (5 tests, `bunx vitest run`)

## Notes
The dataset is synthetic, so real inspection data could replace `generate_dataset()` without changing the rest of the pipeline. Scores above 50% probability are classed as High risk.
