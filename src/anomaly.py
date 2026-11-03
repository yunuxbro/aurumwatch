import numpy as np
from decompose import decompose

K = 0.6745          # makes MAD comparable to a standard deviation
THRESHOLD = 3.5
MIN_MOVES = 5

def robust_z(x):
    x = np.asarray(x, dtype=float)
    med = np.median(x)
    mad = np.median(np.abs(x - med))
    if mad == 0:
        return np.full(len(x), np.nan)
    return K * (x - med) / mad

def flag_premium_jumps(karat=22):
    d = decompose(karat)
    d["z"] = np.nan
    d["flag"] = False
    d["status"] = "ok"
    if len(d) < MIN_MOVES:
        d["status"] = "cannot_assess"
        return d
    d["z"] = robust_z(d.ret_premium)
    d["flag"] = d.z.abs() > THRESHOLD
    return d

if __name__ == "__main__":
    import pandas as pd
    pd.set_option("display.width", 200)
    print(flag_premium_jumps()[["date", "ret_premium", "z", "flag", "status"]].round(4))