import { useMemo } from "react";
import { Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler,
} from "chart.js";
import { SummaryCards } from "./SummaryCards";
import { NumericHighlights } from "./NumericHighlights";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { useLifeOSStore } from "../store/useLifeOSStore";
import { useTheme } from "../hooks/useTheme";
import { TrendingUp, PieChart, Zap } from "lucide-react";
import type { TimeframeFilter } from "../types/data";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler
);

const RANGE_LABEL: Record<TimeframeFilter, string> = {
  week: "Week",
  month: "Month",
  all: "All Time",
};

export function InsightsDashboard() {
  const { summary, timeframe, setTimeframe } = useLifeOSStore();
  const { theme } = useTheme();

  const categoryData = useMemo(() => {
    if (!summary?.categoryBreakdown?.length) return null;
    return {
      labels: summary.categoryBreakdown.map((item) => item.label),
      datasets: [
        {
          label: "Frequency",
          data: summary.categoryBreakdown.map((item) => item.value),
          backgroundColor: [
            "rgba(212, 165, 116, 0.9)",  // Champagne
            "rgba(229, 92, 123, 0.85)",   // Blush
            "rgba(59, 74, 125, 0.85)",    // Navy
            "rgba(232, 188, 130, 0.85)",  // Light champagne
            "rgba(239, 132, 158, 0.85)",  // Light blush
          ],
          borderColor: [
            "rgba(212, 165, 116, 1)",
            "rgba(229, 92, 123, 1)",
            "rgba(59, 74, 125, 1)",
            "rgba(232, 188, 130, 1)",
            "rgba(239, 132, 158, 1)",
          ],
          borderWidth: 2,
        },
      ],
    };
  }, [summary]);

  const timeSeriesData = useMemo(() => {
    if (!summary?.timeSeries?.length) return null;
    return {
      labels: summary.timeSeries.map((datum) => datum.label),
      datasets: [
        {
          label: "Activity",
          data: summary.timeSeries.map((datum) => datum.value),
          borderColor: "rgba(212, 165, 116, 1)",
          backgroundColor: "rgba(212, 165, 116, 0.15)",
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "rgba(229, 92, 123, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
        },
      ],
    };
  }, [summary]);

  const textColor = theme === "dark" ? "#FAF0E4" : "#1A2340";
  const gridColor = theme === "dark" ? "rgba(212, 165, 116, 0.1)" : "rgba(26, 35, 64, 0.1)";

  return (
    <div className="space-y-8 animate-fade-in">
      <SummaryCards summary={summary} />

      {/* Time Range Selector */}
      <div className="flex items-center gap-4 rounded-2xl border border-champagne-200/50 bg-gradient-to-r from-white/90 via-champagne-50/30 to-white/90 px-5 py-4 shadow-sm backdrop-blur dark:border-champagne-500/20 dark:from-navy-900/80 dark:via-navy-800/50 dark:to-navy-900/80">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-champagne-600 dark:text-champagne-400">
          Time Range
        </span>
        <div className="inline-flex rounded-xl border border-champagne-200/50 bg-white/80 p-1 dark:border-champagne-500/20 dark:bg-navy-900/80">
          {(Object.keys(RANGE_LABEL) as Array<keyof typeof RANGE_LABEL>).map((range) => (
            <button
              key={range}
              onClick={() => setTimeframe(range)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all duration-300 ${timeframe === range
                ? "bg-gradient-to-r from-champagne-500 to-blush-500 text-white shadow-md"
                : "text-navy-600 hover:text-champagne-600 dark:text-slate-400 dark:hover:text-champagne-300"
                }`}
            >
              {RANGE_LABEL[range]}
            </button>
          ))}
        </div>
      </div>

      <NumericHighlights summary={summary} />

      {/* Charts Grid */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Category Chart */}
        <div className="group rounded-3xl border border-champagne-200/50 bg-gradient-to-br from-white/95 via-champagne-50/30 to-white/95 p-8 shadow-premium backdrop-blur transition-all duration-300 hover:shadow-premium-lg dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/50 dark:to-navy-900/90">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-champagne-400 to-champagne-500 shadow-md">
              <PieChart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-champagne-500 dark:text-champagne-400">
                Category Pulse
              </h3>
              <p className="text-base font-display font-semibold text-navy-900 dark:text-white">
                Where your attention is clustering
              </p>
            </div>
          </div>
          {categoryData ? (
            <div className="mt-4">
              <Pie
                data={categoryData}
                options={{
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 20,
                        font: {
                          family: "'Inter', sans-serif",
                          size: 12,
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-champagne-100 dark:bg-champagne-900/30 flex items-center justify-center mb-4">
                <PieChart className="h-8 w-8 text-champagne-400" />
              </div>
              <p className="text-sm text-navy-500 dark:text-slate-400 max-w-xs">
                Add at least one dataset to unlock category intelligence.
              </p>
            </div>
          )}
        </div>

        {/* Time Series Chart */}
        <div className="group rounded-3xl border border-champagne-200/50 bg-gradient-to-br from-white/95 via-champagne-50/30 to-white/95 p-8 shadow-premium backdrop-blur transition-all duration-300 hover:shadow-premium-lg dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/50 dark:to-navy-900/90">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blush-400 to-blush-500 shadow-md shadow-blush-500/30">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-blush-500 dark:text-blush-400">
                Activity Rhythm
              </h3>
              <p className="text-base font-display font-semibold text-navy-900 dark:text-white">
                Track consistency across time
              </p>
            </div>
          </div>
          {timeSeriesData ? (
            <div className="mt-4 h-72">
              <Line
                data={timeSeriesData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: theme === "dark" ? "#1A2340" : "#fff",
                      titleColor: theme === "dark" ? "#FAF0E4" : "#1A2340",
                      bodyColor: theme === "dark" ? "#D4A574" : "#E55C7B",
                      borderColor: "rgba(212, 165, 116, 0.3)",
                      borderWidth: 1,
                      padding: 12,
                      cornerRadius: 12,
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        color: textColor,
                        font: { family: "'Inter', sans-serif" },
                      },
                      grid: { color: gridColor },
                    },
                    y: {
                      ticks: {
                        color: textColor,
                        font: { family: "'Inter', sans-serif" },
                      },
                      grid: { color: gridColor },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-blush-100 dark:bg-blush-900/30 flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-blush-400" />
              </div>
              <p className="text-sm text-navy-500 dark:text-slate-400 max-w-xs">
                Once your data includes time references, LifeOS will reveal pacing insights automatically.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3D Knowledge Graph */}
      <div className="group rounded-3xl border border-champagne-200/50 bg-gradient-to-br from-white/95 via-champagne-50/30 to-white/95 p-8 shadow-premium backdrop-blur transition-all duration-300 hover:shadow-premium-lg dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/50 dark:to-navy-900/90">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-navy-500 to-navy-700 shadow-md">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-navy-500 dark:text-champagne-400">
              Knowledge Graph
            </h3>
            <p className="text-base font-display font-semibold text-navy-900 dark:text-white">
              Interactive map of your local entity connections
            </p>
          </div>
        </div>
        <KnowledgeGraph />
      </div>

      {/* Narrative Summary */}
      <div className="relative overflow-hidden rounded-3xl border border-champagne-300/30 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 p-[1px] shadow-premium-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-champagne-500/20 via-transparent to-blush-500/20 opacity-50" />
        <div className="relative rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-navy-900/95 via-navy-950 to-navy-900/95 px-8 py-8 backdrop-blur">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-champagne-400 to-blush-500 shadow-md">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-champagne-400">
              Narrative Summary
            </h3>
          </div>
          <p className="text-lg leading-relaxed text-champagne-100/90 font-light">
            {summary?.narrative ?? "Upload your first dataset to unlock a living narrative of your routines."}
          </p>
        </div>
      </div>
    </div>
  );
}
