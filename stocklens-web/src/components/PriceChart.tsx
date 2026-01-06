"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi } from "lightweight-charts";
import { Loader2 } from "lucide-react";

interface ChartDataPoint {
  time: string;
  value: number;
}

interface PriceChartProps {
  symbol: string;
  height?: number;
}

export default function PriceChart({ symbol, height = 300 }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let isMounted = true;

    const fetchAndRenderChart = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch historical data from our API
        const response = await fetch(`/api/historical?symbol=${symbol}&range=3mo`);
        const result = await response.json();

        if (!isMounted) return;

        if (!result.success || !result.data || result.data.length === 0) {
          throw new Error(result.error || "No chart data available");
        }

        setCurrentPrice(result.currentPrice);

        // Create chart
        if (!chartContainerRef.current) return;
        
        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "#1e222d" },
            textColor: "#787b86",
          },
          grid: {
            vertLines: { color: "#2a2e39" },
            horzLines: { color: "#2a2e39" },
          },
          width: chartContainerRef.current.clientWidth,
          height: height,
          rightPriceScale: {
            borderColor: "#2a2e39",
          },
          timeScale: {
            borderColor: "#2a2e39",
            timeVisible: true,
            secondsVisible: false,
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: "#787b86",
              width: 1,
              style: 2,
            },
            horzLine: {
              color: "#787b86",
              width: 1,
              style: 2,
            },
          },
        });

        chartRef.current = chart;

        // Determine color based on price change
        const isPositive = result.changePercent >= 0;
        const lineColor = isPositive ? "#26a69a" : "#ef5350";
        const topColor = isPositive ? "rgba(38, 166, 154, 0.3)" : "rgba(239, 83, 80, 0.3)";

        // Add area series
        const areaSeries = chart.addAreaSeries({
          lineColor: lineColor,
          topColor: topColor,
          bottomColor: "rgba(0, 0, 0, 0)",
          lineWidth: 2,
        });

        seriesRef.current = areaSeries;

        // Set data
        areaSeries.setData(result.data);

        // Fit content
        chart.timeScale().fitContent();

        setIsLoading(false);

        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
          }
        };

        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load chart");
          setIsLoading(false);
        }
      }
    };

    fetchAndRenderChart();

    return () => {
      isMounted = false;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, height]);

  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-card rounded-lg border border-border"
        style={{ height }}
      >
        <div className="text-center text-text-secondary">
          <p className="mb-2">Unable to load chart</p>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-card z-10"
          style={{ height }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      )}
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
