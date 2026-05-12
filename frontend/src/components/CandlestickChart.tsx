import { useQuery } from "@tanstack/react-query";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";
import type { CandlestickData, Time } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { getCandles } from "../api/client";
import { Loading } from "./ui";

interface AnalysisMarker {
  analysisDate: string;
  direction: string;
}

interface Props {
  symbol: string;
  analyses: AnalysisMarker[];
  days?: number;
}

function calcMA(data: { close: number }[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0);
    return parseFloat((sum / period).toFixed(2));
  });
}

export function CandlestickChart({ symbol, analyses, days = 30 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ohlcRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["candles", symbol, days],
    queryFn: () => getCandles(symbol, days),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!containerRef.current || !data?.candles?.length) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = containerRef.current;
    const bgColor = isDark ? "#0d1117" : "#ffffff";
    const textColor = isDark ? "#9ca3af" : "#374151";
    const gridColor = isDark ? "#1e2530" : "#f3f4f6";
    const borderColor = isDark ? "#374151" : "#e5e7eb";

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    const candles = data.candles;

    // ── K 線 ──────────────────────────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444",
      downColor: "#22c55e",
      borderUpColor: "#ef4444",
      borderDownColor: "#22c55e",
      wickUpColor: "#ef4444",
      wickDownColor: "#22c55e",
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // ── MA5 ───────────────────────────────────────────────────────────────────
    const ma5 = calcMA(candles, 5);
    const ma5Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    ma5Series.setData(
      candles
        .map((c, i) => ({ time: c.time as Time, value: ma5[i] }))
        .filter((d) => d.value !== null) as { time: Time; value: number }[]
    );

    // ── MA10 ──────────────────────────────────────────────────────────────────
    const ma10 = calcMA(candles, 10);
    const ma10Series = chart.addSeries(LineSeries, {
      color: "#10b981",
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    ma10Series.setData(
      candles
        .map((c, i) => ({ time: c.time as Time, value: ma10[i] }))
        .filter((d) => d.value !== null) as { time: Time; value: number }[]
    );

    // ── MA20 ──────────────────────────────────────────────────────────────────
    const ma20 = calcMA(candles, 20);
    const ma20Series = chart.addSeries(LineSeries, {
      color: "#6366f1",
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    ma20Series.setData(
      candles
        .map((c, i) => ({ time: c.time as Time, value: ma20[i] }))
        .filter((d) => d.value !== null) as { time: Time; value: number }[]
    );

    // ── 成交量 (子圖) ─────────────────────────────────────────────────────────
    const volSeries = chart.addSeries(HistogramSeries, {
      color: "#93c5fd",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? "#fca5a5" : "#86efac",
      }))
    );

    // ── 分析標記 ──────────────────────────────────────────────────────────────
    const candleDates = new Set(candles.map((c) => c.time));
    const markerData = analyses
      .filter((a) => candleDates.has(a.analysisDate.split("T")[0]))
      .map((a) => ({
        time: a.analysisDate.split("T")[0] as Time,
        position: "belowBar" as const,
        color: a.direction === "BULLISH" ? "#ef4444" : "#22c55e",
        shape: a.direction === "BULLISH" ? ("arrowUp" as const) : ("arrowDown" as const),
        text: a.direction === "BULLISH" ? "▲" : "▼",
        size: 1,
      }));
    if (markerData.length) {
      createSeriesMarkers(candleSeries, markerData);
    }

    // ── Crosshair OHLC 顯示 ───────────────────────────────────────────────────
    const volumeMap = new Map(candles.map((c) => [c.time, c.volume]));
    const ma5Map = new Map(candles.map((c, i) => [c.time, ma5[i]]));
    const ma10Map = new Map(candles.map((c, i) => [c.time, ma10[i]]));
    const ma20Map = new Map(candles.map((c, i) => [c.time, ma20[i]]));
    const lastCandle = candles[candles.length - 1];

    const fmtVol = (v: number) => {
      if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
      if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
      return String(v);
    };

    const setOHLC = (c: { time: string; open: number; high: number; low: number; close: number } | null) => {
      if (!ohlcRef.current) return;
      const src = c ?? lastCandle;
      const isUp = src.close >= src.open;
      const color = isUp ? "#ef4444" : "#22c55e";
      const vol = volumeMap.get(src.time) ?? 0;
      const v5 = ma5Map.get(src.time);
      const v10 = ma10Map.get(src.time);
      const v20 = ma20Map.get(src.time);
      ohlcRef.current.innerHTML = `
        <span class="font-medium" style="color:${color}">${src.time}</span>
        <span>開 <b>${src.open.toFixed(2)}</b></span>
        <span>高 <b>${src.high.toFixed(2)}</b></span>
        <span>低 <b>${src.low.toFixed(2)}</b></span>
        <span>收 <b style="color:${color}">${src.close.toFixed(2)}</b></span>
        <span>量 <b>${fmtVol(vol)}</b></span>
        <span class="ml-2 border-l border-gray-300 pl-2" style="color:#f59e0b">MA5 <b>${v5 != null ? v5.toFixed(2) : "-"}</b></span>
        <span style="color:#10b981">MA10 <b>${v10 != null ? v10.toFixed(2) : "-"}</b></span>
        <span style="color:#6366f1">MA20 <b>${v20 != null ? v20.toFixed(2) : "-"}</b></span>
      `;
    };

    setOHLC(null); // 預設顯示最後一根

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setOHLC(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      if (bar) {
        setOHLC({ time: param.time as string, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
      } else {
        setOHLC(null);
      }
    });

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, analyses, isDark]);

  if (isLoading) return <Loading />;
  if (isError || !data?.candles?.length)
    return <p className="py-4 text-center text-sm text-gray-400">無法載入 K 線資料</p>;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#0d1117]">
      {/* 標題列 + 圖例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{symbol} 日 K 線</span>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded" style={{ background: "#f59e0b" }} />
            MA5
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded" style={{ background: "#10b981" }} />
            MA10
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded" style={{ background: "#6366f1" }} />
            MA20
          </span>
          <span className="flex items-center gap-1 text-red-500">▲ 看多</span>
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">▼ 看空</span>
        </div>
      </div>
      {/* OHLC 資訊列 */}
      <div
        ref={ohlcRef}
        className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-5 py-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700 min-h-[32px]"
      />
      {/* 圖表 */}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
