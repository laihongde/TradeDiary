import yfinance as yf

stocks = ["3081.TW","6672.TW","8358.TW","6414.TW","6197.TW",
          "2603.TW","6435.TW","3455.TW","2317.TW","8131.TW","2382.TW"]

for sym in stocks:
    t = yf.Ticker(sym)
    h = t.history(start="2026-04-28", end="2026-05-06", auto_adjust=True)
    if h.empty:
        print(f"{sym}: NO DATA")
    else:
        print(f"{sym}:")
        for d, row in h.iterrows():
            print(f"  {d.date()}  close={row['Close']:.2f}  vol={int(row['Volume'])}")
