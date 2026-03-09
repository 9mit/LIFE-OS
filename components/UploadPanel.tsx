
import React, { useState } from "react";
import { UploadCloud, ShieldCheck, Sparkles, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useIndexedDB } from "../hooks/useIndexedDB";
import { useLifeOSStore } from "../store/useLifeOSStore";
import { parseCSV } from "../utils/parseCSV";
import { parseText } from "../utils/parseText";
import { parseJSON } from "../utils/parseJSON";
import { parseExcel } from "../utils/parseExcel";
import { parsePDF } from "../utils/parsePDF";
import type { LifeOSDataRecord, LifeOSSource } from "../types/data";

export function UploadPanel() {
  const { addSource, addRecords, getAllRecords, getAllSources } = useIndexedDB();
  const { setSources, setRecords, setLoading } = useLifeOSStore();
  const [status, setStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    setStatus("Analyzing your files...");
    setLoading(true);
    setIsSuccess(false);

    try {
      for (const file of Array.from(files)) {
        const extension = file.name.split(".").pop()?.toLowerCase();
        let sourceType: LifeOSSource["type"] | null = null;

        if (extension === "csv") sourceType = "csv";
        else if (extension === "json") sourceType = "json";
        else if (["txt", "md"].includes(extension ?? "")) sourceType = "txt";
        else if (["xlsx", "xls"].includes(extension ?? "")) sourceType = "excel" as any;
        else if (extension === "pdf") sourceType = "pdf" as any;

        if (!sourceType) {
          setStatus(`Unsupported format: ${file.name}`);
          continue;
        }

        const source = await addSource(file.name, sourceType);

        let records: LifeOSDataRecord[] = [];
        if (sourceType === "csv") records = await parseCSV(file, source.id);
        if (sourceType === "json") records = await parseJSON(file, source.id);
        if (sourceType === "txt") records = await parseText(file, source.id);
        if (sourceType === ("excel" as any)) records = await parseExcel(file, source.id);
        if (sourceType === ("pdf" as any)) records = await parsePDF(file, source.id);

        await addRecords(records);
      }

      const [allSources, allRecords] = await Promise.all([
        getAllSources(),
        getAllRecords(),
      ]);

      setSources(allSources);
      setRecords(allRecords);
      setStatus("Files processed successfully.");
      setIsSuccess(true);
    } catch (error) {
      console.error("Error processing files", error);
      setStatus("Something went wrong while reading your files.");
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    await handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      {/* Main Upload Zone */}
      <div
        className={`relative overflow-hidden rounded-3xl border-2 border-dashed p-12 transition-all duration-500 ${isDragging
          ? "border-champagne-400 bg-gradient-to-br from-champagne-500/10 via-blush-500/5 to-transparent shadow-gold-glow scale-[1.02]"
          : "border-champagne-300/30 bg-gradient-to-br from-white/80 via-champagne-50/50 to-white/80 dark:from-navy-900/80 dark:via-navy-800/50 dark:to-navy-900/80 hover:border-champagne-400/50"
          } backdrop-blur-sm shadow-premium`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Decorative Background Elements */}
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br from-champagne-400/20 to-blush-400/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-gradient-to-br from-blush-400/15 to-champagne-400/10 blur-3xl" />

        <div className="relative flex flex-col items-center gap-8 text-center">
          {/* Upload Icon */}
          <div className={`relative transition-transform duration-500 ${isDragging ? "scale-110 animate-float" : ""}`}>
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-champagne-400 to-blush-500 blur-xl opacity-40" />
            <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-champagne-400 via-champagne-500 to-blush-500 shadow-premium">
              <UploadCloud className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-3">
            <h2 className="font-display text-3xl font-semibold text-navy-900 dark:text-white">
              Drop your life logs here
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-navy-600/80 dark:text-slate-300">
              Upload CSV expenses, activity trackers, JSON exports, or plain-text journals.
              LifeOS will normalize every line, extract keywords, and prepare embeddings entirely in your browser.
            </p>
          </div>

          {/* Upload Button */}
          <label className="group relative cursor-pointer">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-champagne-400 to-blush-500 blur-md opacity-50 transition-opacity group-hover:opacity-70" />
            <div className="relative inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-champagne-500 via-champagne-400 to-blush-500 px-8 py-4 text-sm font-semibold text-white shadow-premium transition-all duration-300 hover:shadow-premium-lg hover:scale-[1.02]">
              <Sparkles className="h-5 w-5" />
              Choose files to upload
            </div>
            <input
              type="file"
              accept=".csv,.json,.txt,.md,.xlsx,.xls,.pdf"
              multiple
              onChange={(event) => handleFiles(event.target.files)}
              className="hidden"
            />
          </label>

          {/* Supported Formats */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {["CSV", "JSON", "TXT", "MD", "EXCEL", "PDF"].map((format) => (
              <span
                key={format}
                className="inline-flex items-center gap-1.5 rounded-full border border-champagne-200/50 bg-white/60 px-3 py-1.5 text-xs font-medium text-navy-600 dark:border-champagne-500/20 dark:bg-navy-800/50 dark:text-champagne-300"
              >
                <FileText className="h-3 w-3" />
                {format}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-start gap-4 rounded-2xl border border-emerald-200/50 bg-gradient-to-r from-emerald-50/80 via-white/80 to-emerald-50/80 px-6 py-5 shadow-sm backdrop-blur dark:border-emerald-500/20 dark:from-emerald-900/20 dark:via-navy-900/50 dark:to-emerald-900/20">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-md">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Your privacy is sacred
          </p>
          <p className="mt-1 text-sm leading-relaxed text-emerald-600/80 dark:text-emerald-400/70">
            Files never leave the browser. LifeOS stores normalized data in IndexedDB so you can work offline and clear everything with a single click.
          </p>
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div className={`flex items-center gap-3 rounded-2xl border px-6 py-4 shadow-sm backdrop-blur animate-slide-up ${isSuccess
          ? "border-champagne-200/50 bg-gradient-to-r from-champagne-50/80 to-white/80 dark:border-champagne-500/20 dark:from-champagne-900/20 dark:to-navy-900/50"
          : "border-blush-200/50 bg-gradient-to-r from-blush-50/80 to-white/80 dark:border-blush-500/20 dark:from-blush-900/20 dark:to-navy-900/50"
          }`}>
          {isSuccess ? (
            <CheckCircle2 className="h-5 w-5 text-champagne-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-blush-500" />
          )}
          <span className={`text-sm font-medium ${isSuccess ? "text-champagne-700 dark:text-champagne-300" : "text-blush-700 dark:text-blush-300"
            }`}>
            {status}
          </span>
        </div>
      )}
    </div>
  );
}
