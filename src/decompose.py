import numpy as np
import pandas as pd
from clean import pettah_joined

def decompose(karat=22):
    j = pettah_joined(karat)
    d = pd.DataFrame({"date": j.date})
    d["ret_local"] = np.log(j.local).diff()
    d["ret_world"] = np.log(j.usd_oz).diff()
    d["ret_fx"] = np.log(j.lkr_per_usd).diff()
    d["ret_premium"] = j.premium.diff()
    d["resid"] = d.ret_local - (d.ret_world + d.ret_fx + d.ret_premium)
    return d.dropna().reset_index(drop=True)

if __name__ == "__main__":
    pd.set_option("display.width", 200)
    d = decompose()
    print(d.round(4))
    print("max abs residual:", d.resid.abs().max())