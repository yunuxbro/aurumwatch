import numpy as np
from decompose import decompose

K = 0.6745          # makes MAD comparable to a standard deviation
THRESHOLD = 3.5     # standard robust-z cut-off
MIN_MOVES = 5

def flag_premium_jumps(karat=22):
    d = decompose(karat)
    d["z"] = np.nan
    d["flag"] = False
    d["status"] = "ok"
    if len(d) < MIN_MOVES:
        d["status"] = "cannot_assess"
        return d
    x = d.ret_premium
    med = x.median()
    mad = (x - med).abs().median()
    if mad > 0:
        d["z"] = K * (x - med) / mad
        d["flag"] = d.z.abs() > THRESHOLD
    return d

if __name__ == "__main__":
    import pandas as pd
    pd.set_option("display.width", 200)
    print(flag_premium_jumps()[["date", "ret_premium", "z", "flag", "status"]].round(4))