import numpy as np
from decompose import decompose

def test_identity_holds_on_every_row():
    d = decompose()
    assert len(d) > 0
    assert np.allclose(d.resid, 0, atol=1e-9)