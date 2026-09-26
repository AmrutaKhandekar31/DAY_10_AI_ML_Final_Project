import pipeline as p


def test_dataset_shape_and_target():
    df = p.generate_dataset(300)
    assert len(df) == 300 and set(df[p.TARGET].unique()) <= {0, 1}
    assert df[p.NUMERIC_FEATURES].isna().sum().sum() > 0  # has missing values to clean


def test_clean_caps_outliers():
    df, report = p.clean(p.generate_dataset(500))
    low, high = report["clip_bounds"]["temperature_c"]
    assert df["temperature_c"].dropna().between(low, high).all()


def test_feature_selection_returns_subset():
    df, _ = p.clean(p.generate_dataset(500))
    selected, info = p.select_features(df, df[p.TARGET], k=5)
    assert 0 < len(selected) <= len(p.NUMERIC_FEATURES)
    assert set(info["rfe_selected"]) <= set(selected)
