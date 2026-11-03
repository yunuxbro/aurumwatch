from backtest import kupiec

def test_kupiec_perfect_coverage():
    assert kupiec(5, 100, 0.05)[1] > 0.99

def test_kupiec_bad_coverage():
    assert kupiec(30, 100, 0.05)[1] < 0.001