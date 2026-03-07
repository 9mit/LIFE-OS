import React, { useRef } from "react";
import { exportDashboardToPDF } from "../utils/pdfExport";
import { useLifeOSStore } from "../store/useLifeOSStore";
import { Download, FileText, Sparkles, Target, MessageSquare } from "lucide-react";

export function ReportsPanel() {
  const { summary } = useLifeOSStore();
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!dashboardRef.current || !summary) return;
    await exportDashboardToPDF(dashboardRef.current, summary);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl border border-champagne-200/50 bg-gradient-to-r from-white/95 via-champagne-50/30 to-white/95 px-8 py-6 shadow-premium backdrop-blur dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/50 dark:to-navy-900/90">
        {/* Decorative Elements */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-champagne-400/20 to-blush-400/10 blur-2xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-champagne-400 to-blush-500 shadow-premium">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-navy-900 dark:text-white">
                Report Composer
              </h2>
              <p className="mt-1 text-sm text-navy-600/80 dark:text-slate-300">
                Freeze your current dashboard view into a polished PDF you can archive or share.
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={!summary}
            className="group relative inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-champagne-500 via-champagne-400 to-blush-500 px-6 py-4 text-sm font-semibold text-white shadow-premium transition-all duration-300 hover:shadow-premium-lg hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            <Download className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Report Preview */}
      <div
        ref={dashboardRef}
        className="rounded-3xl border border-champagne-200/50 bg-gradient-to-br from-white/98 via-champagne-50/40 to-white/98 p-10 shadow-premium-lg backdrop-blur dark:border-champagne-500/20 dark:from-navy-900/95 dark:via-navy-800/60 dark:to-navy-900/95"
      >
        {/* Report Header */}
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-champagne-200/50 dark:border-champagne-500/20">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-champagne-400 to-champagne-500 shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-champagne-500 dark:text-champagne-400">
              Executive Summary
            </h3>
            <p className="font-display text-xl font-semibold text-navy-900 dark:text-white">
              LifeOS Intelligence Report
            </p>
          </div>
        </div>

        {/* Narrative */}
        <p className="text-base leading-relaxed text-navy-700/90 dark:text-champagne-100/90 mb-8">
          {summary?.narrative ?? "Surface a report-ready narrative by uploading your first dataset."}
        </p>

        {/* Report Blocks */}
        <div className="grid gap-6 md:grid-cols-3">
          <ReportBlock
            title="Keywords"
            icon={<Target className="h-4 w-4" />}
            value={summary?.keywords.join(", ") ?? "—"}
          />
          <ReportBlock
            title="Mood Signals"
            icon={<MessageSquare className="h-4 w-4" />}
            value={summary?.moodWords.join(", ") ?? "—"}
          />
          <ReportBlock
            title="Forecast"
            icon={<Sparkles className="h-4 w-4" />}
            value={
              summary?.forecasts.length
                ? summary.forecasts
                  .map((forecast) =>
                    `${forecast.field}: ${forecast.forecast.toFixed(2)}`
                  )
                  .join(" · ")
                : "Gather more history to generate confident projections."
            }
          />
        </div>
      </div>
    </div>
  );
}

function ReportBlock({
  title,
  value,
  icon
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-champagne-200/40 bg-gradient-to-br from-champagne-50/50 via-white/80 to-champagne-50/30 px-6 py-5 shadow-sm transition-all hover:shadow-md dark:border-champagne-500/15 dark:from-navy-800/50 dark:via-navy-900/40 dark:to-navy-800/50">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-champagne-500 dark:text-champagne-400">
          {icon}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-champagne-500 dark:text-champagne-400">
          {title}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-navy-600 dark:text-champagne-100/80">
        {value}
      </p>
    </div>
  );
}
