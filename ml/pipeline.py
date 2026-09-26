"""
Smart Hygiene Risk Prediction System — end-to-end ML pipeline.

Steps
  1. Data generation / loading       -> data/hygiene_inspections.csv
  2. Preprocessing                   (missing values, outliers, encoding, scaling)
  3. Exploratory data analysis (EDA) -> outputs/eda_*.png, outputs/eda.json
  4. Feature selection               (mutual information + RFE)
  5. Model training & evaluation     (LogReg, RandomForest, GradientBoosting, 5-fold CV)
  6. Prediction                      (sample predictions)
  7. Visualisation / export          -> outputs/*.png, model artifacts for the web app & API

Run:  python pipeline.py
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import RFE, mutual_info_classif
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score, precision_score,
    recall_score, roc_auc_score, roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
OUT_DIR = ROOT / "outputs"
APP_EXPORT = ROOT.parent.parent.parent / "src" / "data"  # web app consumes these JSON files
RANDOM_STATE = 42

NUMERIC_FEATURES = [
    "cleaning_frequency_per_day", "handwash_stations", "staff_trained_pct",
    "waste_disposal_score", "water_quality_score", "pest_sightings",
    "temperature_c", "humidity_pct", "daily_footfall",
    "days_since_last_inspection", "previous_violations",
]
CATEGORICAL_FEATURES = ["facility_type"]
FACILITY_TYPES = ["Restaurant", "Hospital", "School", "Hotel", "Office"]
TARGET = "high_risk"


# 1. DATA ----------------------------------------------------------------------
def generate_dataset(n_rows: int = 2000) -> pd.DataFrame:
    """Synthetic but realistic inspection records with a known risk mechanism,
    plus injected missing values and outliers so preprocessing is meaningful."""
    rng = np.random.default_rng(RANDOM_STATE)
    facility = rng.choice(FACILITY_TYPES, n_rows, p=[0.35, 0.15, 0.2, 0.15, 0.15])
    df = pd.DataFrame({
        "facility_id": [f"F-{1000 + i}" for i in range(n_rows)],
        "facility_type": facility,
        "cleaning_frequency_per_day": rng.poisson(3, n_rows).clip(0, 10),
        "handwash_stations": rng.integers(0, 12, n_rows),
        "staff_trained_pct": rng.normal(70, 18, n_rows).clip(0, 100).round(1),
        "waste_disposal_score": rng.integers(1, 11, n_rows),
        "water_quality_score": rng.integers(1, 11, n_rows),
        "pest_sightings": rng.poisson(1.2, n_rows),
        "temperature_c": rng.normal(24, 4, n_rows).round(1),
        "humidity_pct": rng.normal(60, 12, n_rows).clip(20, 100).round(1),
        "daily_footfall": rng.lognormal(5.3, 0.7, n_rows).round(),
        "days_since_last_inspection": rng.integers(5, 400, n_rows),
        "previous_violations": rng.poisson(1.5, n_rows),
    })
    type_risk = {"Restaurant": 0.6, "Hospital": 0.3, "School": 0.2, "Hotel": 0.1, "Office": -0.5}
    logit = (
        -0.55 * df.cleaning_frequency_per_day - 0.12 * df.handwash_stations
        - 0.035 * df.staff_trained_pct - 0.25 * df.waste_disposal_score
        - 0.2 * df.water_quality_score + 0.9 * df.pest_sightings
        + 0.06 * (df.temperature_c - 24) + 0.03 * (df.humidity_pct - 60)
        + 0.0008 * df.daily_footfall + 0.004 * df.days_since_last_inspection
        + 0.45 * df.previous_violations + df.facility_type.map(type_risk) + 4.3
    )
    prob = 1 / (1 + np.exp(-logit))
    df[TARGET] = (rng.random(n_rows) < prob).astype(int)

    # inject data-quality problems
    for col in ["staff_trained_pct", "humidity_pct", "water_quality_score", "temperature_c"]:
        df.loc[rng.random(n_rows) < 0.04, col] = np.nan
    df.loc[rng.choice(n_rows, 15, replace=False), "temperature_c"] = 85.0  # sensor glitch
    df.loc[rng.choice(n_rows, 10, replace=False), "daily_footfall"] = 50000
    return df


# 2. PREPROCESSING -------------------------------------------------------------
def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    report = {"rows_raw": len(df), "missing_before": df.isna().sum().to_dict()}
    df = df.drop_duplicates(subset="facility_id").copy()
    clip_bounds = {}
    for col in NUMERIC_FEATURES:  # IQR-based outlier capping
        q1, q3 = df[col].quantile([0.25, 0.75])
        low, high = q1 - 3 * (q3 - q1), q3 + 3 * (q3 - q1)
        clip_bounds[col] = [float(low), float(high)]
        df[col] = df[col].clip(low, high)
    report["rows_clean"] = len(df)
    report["clip_bounds"] = clip_bounds
    return df, report


def build_preprocessor(numeric: list[str]) -> ColumnTransformer:
    return ColumnTransformer([
        ("num", Pipeline([("impute", SimpleImputer(strategy="median")),
                          ("scale", StandardScaler())]), numeric),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
    ])


# 3. EDA -----------------------------------------------------------------------
def run_eda(df: pd.DataFrame) -> dict:
    OUT_DIR.mkdir(exist_ok=True)
    sns.set_theme(style="whitegrid", palette=["#5b8a6b", "#c9a54a"])

    fig, axes = plt.subplots(3, 4, figsize=(16, 10))
    for ax, col in zip(axes.flat, NUMERIC_FEATURES):
        sns.histplot(data=df, x=col, hue=TARGET, ax=ax, bins=25, element="step")
    axes.flat[-1].axis("off")
    fig.tight_layout(); fig.savefig(OUT_DIR / "eda_distributions.png", dpi=110); plt.close(fig)

    corr = df[NUMERIC_FEATURES + [TARGET]].corr()
    fig, ax = plt.subplots(figsize=(11, 9))
    sns.heatmap(corr, cmap="RdYlGn_r", center=0, annot=True, fmt=".2f", ax=ax)
    fig.tight_layout(); fig.savefig(OUT_DIR / "eda_correlation.png", dpi=110); plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 4))
    df.groupby("facility_type")[TARGET].mean().sort_values().plot.barh(ax=ax, color="#5b8a6b")
    ax.set_xlabel("High-risk rate"); fig.tight_layout()
    fig.savefig(OUT_DIR / "eda_risk_by_type.png", dpi=110); plt.close(fig)

    histograms = {}
    for col in NUMERIC_FEATURES:
        s = df[col].dropna()
        counts, edges = np.histogram(s, bins=12)
        low_c, _ = np.histogram(df.loc[df[TARGET] == 0, col].dropna(), bins=edges)
        histograms[col] = [
            {"bin": round(float(edges[i]), 1), "low": int(low_c[i]), "high": int(counts[i] - low_c[i])}
            for i in range(len(counts))
        ]
    return {
        "rows": int(len(df)),
        "high_risk_rate": round(float(df[TARGET].mean()), 3),
        "class_counts": {"low": int((df[TARGET] == 0).sum()), "high": int((df[TARGET] == 1).sum())},
        "summary": df[NUMERIC_FEATURES].describe().round(2).to_dict(),
        "correlation_with_target": corr[TARGET].drop(TARGET).round(3).to_dict(),
        "correlation_matrix": {"features": list(corr.columns), "values": corr.round(2).values.tolist()},
        "risk_by_type": df.groupby("facility_type")[TARGET].mean().round(3).to_dict(),
        "histograms": histograms,
    }


# 4. FEATURE SELECTION ---------------------------------------------------------
def select_features(X: pd.DataFrame, y: pd.Series, k: int = 8) -> tuple[list[str], dict]:
    X_num = X[NUMERIC_FEATURES].fillna(X[NUMERIC_FEATURES].median())
    mi = mutual_info_classif(X_num, y, random_state=RANDOM_STATE)
    mi_scores = dict(sorted(zip(NUMERIC_FEATURES, mi.round(4)), key=lambda t: -t[1]))
    rfe = RFE(LogisticRegression(max_iter=1000), n_features_to_select=k)
    rfe.fit(StandardScaler().fit_transform(X_num), y)
    rfe_selected = [f for f, keep in zip(NUMERIC_FEATURES, rfe.support_) if keep]
    top_mi = list(mi_scores)[:k]
    selected = [f for f in NUMERIC_FEATURES if f in set(rfe_selected) | set(top_mi)]
    return selected, {
        "mutual_information": {k_: float(v) for k_, v in mi_scores.items()},
        "rfe_selected": rfe_selected,
        "selected": selected,
        "dropped": [f for f in NUMERIC_FEATURES if f not in selected],
    }


# 5. TRAINING & EVALUATION -----------------------------------------------------
def evaluate(model, X_test, y_test) -> dict:
    proba = model.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    fpr, tpr, _ = roc_curve(y_test, proba)
    idx = np.linspace(0, len(fpr) - 1, 25).astype(int)
    return {
        "accuracy": round(accuracy_score(y_test, pred), 4),
        "precision": round(precision_score(y_test, pred), 4),
        "recall": round(recall_score(y_test, pred), 4),
        "f1": round(f1_score(y_test, pred), 4),
        "roc_auc": round(roc_auc_score(y_test, proba), 4),
        "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
        "roc_curve": [{"fpr": round(float(fpr[i]), 3), "tpr": round(float(tpr[i]), 3)} for i in idx],
    }


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True); OUT_DIR.mkdir(exist_ok=True); APP_EXPORT.mkdir(parents=True, exist_ok=True)
    raw = generate_dataset()
    raw.to_csv(DATA_DIR / "hygiene_inspections.csv", index=False)
    print(f"[1] dataset: {raw.shape}")

    df, prep_report = clean(raw)
    print(f"[2] cleaned rows: {len(df)}")

    eda = run_eda(df)
    print(f"[3] EDA done — high-risk rate {eda['high_risk_rate']}")

    X, y = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES], df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)
    selected, fs_report = select_features(X_train, y_train)
    print(f"[4] selected features: {selected}")

    candidates = {
        "Logistic Regression": LogisticRegression(max_iter=2000, C=1.0),
        "Random Forest": RandomForestClassifier(n_estimators=300, max_depth=8, random_state=RANDOM_STATE),
        "Gradient Boosting": GradientBoostingClassifier(random_state=RANDOM_STATE),
    }
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    results, fitted = {}, {}
    for name, clf in candidates.items():
        pipe = Pipeline([("prep", build_preprocessor(selected)), ("clf", clf)])
        cv_scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="roc_auc")
        pipe.fit(X_train, y_train)
        results[name] = {"cv_roc_auc_mean": round(cv_scores.mean(), 4),
                         "cv_roc_auc_std": round(cv_scores.std(), 4), **evaluate(pipe, X_test, y_test)}
        fitted[name] = pipe
        print(f"[5] {name}: AUC={results[name]['roc_auc']} F1={results[name]['f1']}")

    # Deploy the interpretable linear model (portable to the web app & API).
    deployed_name = "Logistic Regression"
    best = fitted[deployed_name]
    joblib.dump(best, OUT_DIR / "hygiene_model.joblib")

    prep, clf = best.named_steps["prep"], best.named_steps["clf"]
    num_pipe = prep.named_transformers_["num"]
    cat_names = list(prep.named_transformers_["cat"].get_feature_names_out(CATEGORICAL_FEATURES))
    coefs = clf.coef_[0]
    model_export = {
        "name": deployed_name,
        "version": "1.0.0",
        "threshold": 0.5,
        "numeric_features": selected,
        "medians": dict(zip(selected, num_pipe.named_steps["impute"].statistics_.round(4).tolist())),
        "means": dict(zip(selected, num_pipe.named_steps["scale"].mean_.round(6).tolist())),
        "stds": dict(zip(selected, num_pipe.named_steps["scale"].scale_.round(6).tolist())),
        "clip_bounds": {f: prep_report["clip_bounds"][f] for f in selected},
        "coefficients": dict(zip(selected, coefs[: len(selected)].round(6).tolist())),
        "facility_type_coefficients": {n.replace("facility_type_", ""): round(float(c), 6)
                                       for n, c in zip(cat_names, coefs[len(selected):])},
        "intercept": round(float(clf.intercept_[0]), 6),
    }

    rf = fitted["Random Forest"]
    rf_names = selected + cat_names
    importance = dict(sorted(zip(rf_names, rf.named_steps["clf"].feature_importances_.round(4).tolist()),
                             key=lambda t: -t[1]))

    # 6. sample predictions
    sample = X_test.head(5)
    sample_pred = best.predict_proba(sample)[:, 1].round(3).tolist()
    print(f"[6] sample predictions: {sample_pred}")

    # 7. visualisation
    fig, ax = plt.subplots(figsize=(6, 5))
    for name, r in results.items():
        ax.plot([p["fpr"] for p in r["roc_curve"]], [p["tpr"] for p in r["roc_curve"]],
                label=f"{name} (AUC {r['roc_auc']})")
    ax.plot([0, 1], [0, 1], "--", color="grey"); ax.legend(); ax.set_xlabel("FPR"); ax.set_ylabel("TPR")
    fig.tight_layout(); fig.savefig(OUT_DIR / "model_roc.png", dpi=110); plt.close(fig)
    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(results[deployed_name]["confusion_matrix"], annot=True, fmt="d", cmap="Greens", ax=ax,
                xticklabels=["Low", "High"], yticklabels=["Low", "High"])
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    fig.tight_layout(); fig.savefig(OUT_DIR / "model_confusion.png", dpi=110); plt.close(fig)

    metrics = {
        "deployed_model": deployed_name, "train_rows": len(X_train), "test_rows": len(X_test),
        "models": results, "feature_importance": importance, "feature_selection": fs_report,
        "preprocessing": {"rows_raw": prep_report["rows_raw"], "rows_clean": prep_report["rows_clean"],
                          "missing_before": {k: int(v) for k, v in prep_report["missing_before"].items() if v}},
    }
    for name, payload in [("model.json", model_export), ("metrics.json", metrics), ("eda.json", eda)]:
        text = json.dumps(payload, indent=2, default=float)
        (OUT_DIR / name).write_text(text)
        (APP_EXPORT / name).write_text(text)
    print("[7] artifacts exported")


if __name__ == "__main__":
    main()
