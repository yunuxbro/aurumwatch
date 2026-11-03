import numpy as np
from anomaly import robust_z, THRESHOLD

def test_injected_spike_is_flagged():
    x = np.random.default_rng(0).normal(0, 0.01, 60)
    x[30] = 0.20
    z = robust_z(x)
    assert abs(z[30]) > THRESHOLD
    assert np.argmax(np.abs(z)) == 30

def test_quiet_series_has_few_flags():
    x = np.random.default_rng(1).normal(0, 0.01, 60)
    assert (np.abs(robust_z(x)) > THRESHOLD).sum() <= 1