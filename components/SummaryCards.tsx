import React from "react";
import type { InsightSummary } from "../types/data";
import { formatNumber } from "../utils/utils";
import { Database, Layers, Tag, FileText, TrendingUp } from "lucide-react";

const FALLBACK_SUMMARY: InsightSummary = {
  totalRecords: 0,
  activeSources: 0,
  keywords: [],
  moodWords: [],
  numericHighlights: [],
  categoryBreakdown: [],
  timeSeries: [],
  forecasts: [],
  narrative: "Upload your personal analytics to unlock tailored insights.",
};

type SummaryCardsProps = {
  summary?: InsightSummary | null;
};

const CARD_CONFIG = [
  { key: "records", label: "Records Indexed", icon: Database, gradient: "from-champagne-400 to-champagne-500" },
  { key: "sources", label: "Active Sources", icon: Layers, gradient: "from-blush-400 to-blush-500" },
  { key: "keywords", label: "Top Keywords", icon: Tag, gradient: "from-navy-400 to-navy-500" },
  { key: "narrative", label: "Narrative", icon: FileText, gradient: "from-champagne-500 to-blush-500", large: true },
  { key: "forecast", label: "Forecast", icon: TrendingUp, gradient: "from-blush-500 to-champagne-500" },
];

export function SummaryCards({ summary = FALLBACK_SUMMARY }: SummaryCardsProps) {
  const currentSummary = summary ?? FALLBACK_SUMMARY;

  const getCardValue = (key: string): string | number => {
    switch (key) {
      case "records":
        return formatNumber(currentSummary.totalRecords);
      case "sources":
        return formatNumber(currentSummary.activeSources);
      case "keywords":
        return currentSummary.keywords.length ? currentSummary.keywords.join(", ") : "—";
      case "narrative":
        return currentSummary.narrative;
      case "forecast":
        return currentSummary.forecasts.length
          ? currentSummary.forecasts
            .map((forecast) => `${forecast.field}: ${forecast.forecast.toFixed(2)}`)
            .join(" · ")
          : "Add consistent data to surface predictive signals.";
      default:
        return "—";
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-5">
      {CARD_CONFIG.map((config, index) => {
        const value = getCardValue(config.key);
        return (
          <Card
            key={config.key}
            title={config.label}
            value={value}
            icon={config.icon}
            gradient={config.gradient}
            large={config.large}
            index={index}
          />
        );
      })}
    </div>
  );
}

function Card({
  title,
  value,
  icon: Icon,
  gradient,
  large,
  index,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  large?: boolean;
  index: number;
  key?: string;
}) {
  return (
    <div
      style={{ animationDelay: `${index * 100}ms` }}
      className={`group relative overflow-hidden rounded-3xl border border-champagne-200/50 bg-gradient-to-br from-white/95 via-champagne-50/20 to-white/95 p-6 shadow-premium backdrop-blur transition-all duration-300 hover:shadow-premium-lg hover:scale-[1.02] animate-fade-in dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/40 dark:to-navy-900/90 ${large ? "md:col-span-2" : ""
        }`}
    >
      {/* Decorative Gradient Orb */}
      <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-xl transition-opacity group-hover:opacity-30`} />

      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-champagne-500 dark:text-champagne-400">
            {title}
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-navy-700 line-clamp-4 dark:text-champagne-100/90">
          {value}
        </p>
      </div>
    </div>
  );
}
