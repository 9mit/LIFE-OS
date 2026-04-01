
import { useState, useEffect, useRef, FormEvent } from "react";
import { nanoid } from "nanoid";
import { useLifeOSStore, ActivityLogEntry } from "../store/useLifeOSStore";
import {
  executeAssistantTask,
  toggleProcessWatcher,
  getWatcherStatus,
  subscribeToEvents,
  type SSEEvent,
} from "../utils/osAssistantApi";
import {
  Monitor,
  Send,
  Sparkles,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  FileText,
  FileSpreadsheet,
  FolderOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Cpu,
  Mic,
  MicOff,
  Clock,
  Zap,
  Terminal,
  ChevronRight,
} from "lucide-react";
import { useWhisper } from "../hooks/useWhisper";

// ─── Activity Icon Mapping ───────────────────────────────────────────────────

function getActivityIcon(entry: ActivityLogEntry) {
  if (entry.type === "app_detected")
    return <Monitor className="h-4 w-4 text-blue-400" />;
  if (entry.type === "task_complete" && entry.success)
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (entry.type === "task_complete" && !entry.success)
    return <XCircle className="h-4 w-4 text-red-400" />;
  if (entry.type === "file_written")
    return <FileText className="h-4 w-4 text-champagne-400" />;
  if (entry.type === "office_written")
    return <FileSpreadsheet className="h-4 w-4 text-emerald-400" />;
  if (entry.type === "error")
    return <AlertTriangle className="h-4 w-4 text-red-400" />;
  return <Zap className="h-4 w-4 text-champagne-400" />;
}

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Component ───────────────────────────────────────────────────────────────

const OSAssistantPanel = () => {
  const [input, setInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [watcherLoading, setWatcherLoading] = useState(false);

  const {
    processWatcherEnabled,
    setProcessWatcherEnabled,
    assistantActivityLog,
    addActivityLogEntry,
    clearActivityLog,
  } = useLifeOSStore();

  const feedRef = useRef<HTMLDivElement>(null);

  const {
    isRecording,
    isTranscribing,
    transcription,
    startRecording,
    stopRecording,
  } = useWhisper();

  // Auto-fill input with transcription
  useEffect(() => {
    if (transcription) {
      setInput((prev) =>
        prev.trim() ? prev + " " + transcription : transcription
      );
    }
  }, [transcription]);

  // Subscribe to SSE events
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event: SSEEvent) => {
      if (event.type === "connected") return;

      const entry: ActivityLogEntry = {
        id: nanoid(),
        type: event.type as ActivityLogEntry["type"],
        message:
          event.message ||
          (event.type === "app_detected"
            ? `${event.displayName} detected`
            : `File operation completed`),
        action: event.action,
        success: event.success,
        processName: event.processName,
        displayName: event.displayName,
        filePath: event.filePath,
        timestamp: event.timestamp || Date.now(),
      };

      addActivityLogEntry(entry);
    });

    return unsubscribe;
  }, [addActivityLogEntry]);

  // Scroll to top of feed on new entries
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [assistantActivityLog]);

  // Sync process watcher status on mount
  useEffect(() => {
    getWatcherStatus()
      .then((status) => setProcessWatcherEnabled(status.enabled))
      .catch(() => {});
  }, [setProcessWatcherEnabled]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;

    const prompt = input.trim();
    setInput("");
    setIsExecuting(true);
    setLastResult(null);

    // Log the command
    addActivityLogEntry({
      id: nanoid(),
      type: "info",
      message: `Command: "${prompt}"`,
      timestamp: Date.now(),
    });

    try {
      const result = await executeAssistantTask(prompt);
      setLastResult(result);

      addActivityLogEntry({
        id: nanoid(),
        type: "task_complete",
        message: result.message,
        action: result.action,
        success: result.success,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      addActivityLogEntry({
        id: nanoid(),
        type: "error",
        message: error.message || "Unknown error occurred",
        success: false,
        timestamp: Date.now(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToggleWatcher = async () => {
    setWatcherLoading(true);
    try {
      const newState = !processWatcherEnabled;
      await toggleProcessWatcher(newState);
      setProcessWatcherEnabled(newState);
      addActivityLogEntry({
        id: nanoid(),
        type: "info",
        message: `Process watcher ${newState ? "enabled" : "disabled"}`,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      addActivityLogEntry({
        id: nanoid(),
        type: "error",
        message: `Failed to toggle watcher: ${error.message}`,
        timestamp: Date.now(),
      });
    } finally {
      setWatcherLoading(false);
    }
  };

  // Quick command helpers
  const quickCommands = [
    { label: "📁 List Desktop", command: "What's on my Desktop?" },
    { label: "📊 Create Spreadsheet", command: "Create a budget spreadsheet in Documents with columns Date, Item, Amount, Category" },
    { label: "📝 Create Note", command: "Create a file called notes.txt on my Desktop with the text: Quick notes" },
    { label: "📄 Write Letter", command: "Write a professional letter in Documents" },
  ];

  return (
    <div className="flex h-screen flex-col gap-0 animate-fade-in">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-champagne-200/50 bg-gradient-to-r from-white/95 via-champagne-50/30 to-white/95 px-8 py-6 shadow-premium backdrop-blur dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/50 dark:to-navy-900/90">
        {/* Decorative */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-champagne-400/20 to-blush-400/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-gradient-to-br from-blush-400/15 to-champagne-400/10 blur-2xl" />

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-champagne-400 via-champagne-500 to-blush-500 shadow-gold-glow">
              <Terminal className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold text-navy-900 dark:text-white">
                  OS Assistant
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Cpu className="h-3 w-3" /> Local AI
                </span>
              </div>
              <p className="text-xs text-navy-500 dark:text-slate-400">
                AI-powered OS control — read, write, create files & Office docs with natural language
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Security Badge */}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/50 bg-emerald-50/80 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-900/20">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Sandboxed
              </span>
            </div>

            {/* Process Watcher Toggle */}
            <button
              onClick={handleToggleWatcher}
              disabled={watcherLoading}
              className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                processWatcherEnabled
                  ? "border-blue-300/50 bg-blue-50/80 text-blue-600 hover:border-blue-400 dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-400"
                  : "border-champagne-200/50 bg-white/60 text-navy-500 hover:border-champagne-400 dark:border-champagne-500/20 dark:bg-navy-800/50 dark:text-slate-400"
              }`}
            >
              {watcherLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : processWatcherEnabled ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              App Watcher
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Content Area ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ─── Activity Feed (Center) ─────────────────────── */}
        <div className="flex flex-1 flex-col min-h-0 bg-gradient-to-b from-white/50 via-champagne-50/20 to-white/50 dark:from-navy-950/50 dark:via-navy-900/30 dark:to-navy-950/50">
          {/* Quick Commands */}
          <div className="flex items-center gap-2 overflow-x-auto px-6 py-4 border-b border-champagne-100/50 dark:border-champagne-500/10">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-navy-400 dark:text-slate-500 shrink-0">
              Quick:
            </span>
            {quickCommands.map((qc) => (
              <button
                key={qc.label}
                onClick={() => setInput(qc.command)}
                className="shrink-0 rounded-lg border border-champagne-200/50 bg-white/70 px-3 py-1.5 text-xs font-medium text-navy-600 transition-all hover:border-champagne-400 hover:bg-champagne-50 dark:border-champagne-500/20 dark:bg-navy-800/50 dark:text-champagne-300 dark:hover:border-champagne-400/50"
              >
                {qc.label}
              </button>
            ))}
          </div>

          {/* Live Activity Feed */}
          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto px-6 py-4"
          >
            {assistantActivityLog.length > 0 ? (
              <div className="space-y-3">
                {assistantActivityLog.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-3 rounded-2xl border border-champagne-200/30 bg-gradient-to-r from-white/90 to-champagne-50/30 px-4 py-3 shadow-sm transition-all hover:border-champagne-300/50 hover:shadow-md dark:border-champagne-500/10 dark:from-navy-800/80 dark:to-navy-900/50 dark:hover:border-champagne-500/20 animate-slide-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-100 to-champagne-100/50 dark:from-navy-700/80 dark:to-navy-800/50">
                      {getActivityIcon(entry)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy-700 dark:text-champagne-100 leading-relaxed">
                        {entry.message}
                      </p>
                      {entry.filePath && (
                        <p className="mt-1 text-[11px] text-navy-400 dark:text-slate-500 truncate">
                          <FolderOpen className="inline h-3 w-3 mr-1 -mt-0.5" />
                          {entry.filePath}
                        </p>
                      )}
                      {entry.action && (
                        <span className="mt-1 inline-block rounded-md bg-champagne-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-champagne-600 dark:bg-champagne-900/30 dark:text-champagne-400">
                          {entry.action}
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="shrink-0 text-[10px] text-navy-300 dark:text-slate-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center py-16">
                <div className="relative mb-8">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-champagne-400/20 to-blush-400/20 blur-2xl animate-pulse-soft" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-champagne-100 to-blush-100 dark:from-champagne-900/30 dark:to-blush-900/30">
                    <Terminal className="h-12 w-12 text-champagne-400" />
                  </div>
                </div>
                <h3 className="text-xl font-display font-semibold text-navy-900 dark:text-white mb-3">
                  Your AI OS Assistant
                </h3>
                <p className="text-sm text-navy-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
                  Tell me what to do in plain English. I can create files, build spreadsheets,
                  write Word documents, read your folders, and more — all locally and securely.
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-lg">
                  {[
                    { icon: <FileText className="h-4 w-4" />, title: "Create & Edit Files", desc: "Text files, notes, configs" },
                    { icon: <FileSpreadsheet className="h-4 w-4" />, title: "Excel Spreadsheets", desc: "Budgets, trackers, data" },
                    { icon: <Sparkles className="h-4 w-4" />, title: "Word Documents", desc: "Letters, reports, essays" },
                    { icon: <Shield className="h-4 w-4" />, title: "100% Secure", desc: "Sandboxed, undoable, local" },
                  ].map((feature) => (
                    <div
                      key={feature.title}
                      className="flex items-start gap-3 rounded-2xl border border-champagne-200/30 bg-white/60 p-4 dark:border-champagne-500/10 dark:bg-navy-800/40"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-champagne-400/20 to-blush-400/10 text-champagne-500">
                        {feature.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-navy-700 dark:text-champagne-200">
                          {feature.title}
                        </p>
                        <p className="text-[10px] text-navy-400 dark:text-slate-500">
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Result Preview (if last command produced readable output) */}
          {lastResult?.result?.content && (
            <div className="border-t border-champagne-200/50 bg-gradient-to-r from-navy-900/95 to-navy-950/95 dark:from-navy-950 dark:to-obsidian-950 px-6 py-4 max-h-48 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="h-3.5 w-3.5 text-champagne-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-champagne-400">
                  File Contents
                </span>
              </div>
              <pre className="text-xs text-emerald-300 font-mono whitespace-pre-wrap leading-relaxed">
                {lastResult.result.content.slice(0, 2000)}
                {lastResult.result.content.length > 2000 && "\n... (truncated)"}
              </pre>
            </div>
          )}

          {/* List Directory Preview */}
          {lastResult?.result?.items && (
            <div className="border-t border-champagne-200/50 bg-gradient-to-r from-navy-900/95 to-navy-950/95 dark:from-navy-950 dark:to-obsidian-950 px-6 py-4 max-h-56 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="h-3.5 w-3.5 text-champagne-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-champagne-400">
                  Directory: {lastResult.result.dirPath} ({lastResult.result.count} items)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {lastResult.result.items.slice(0, 30).map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg bg-navy-800/50 px-3 py-1.5 text-xs"
                  >
                    {item.isDirectory ? (
                      <FolderOpen className="h-3.5 w-3.5 text-champagne-400 shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="text-slate-200 truncate">{item.name}</span>
                    {item.sizeMB !== null && (
                      <span className="ml-auto text-[10px] text-slate-500 shrink-0">
                        {item.sizeMB < 1 ? `${(item.sizeMB * 1024).toFixed(0)} KB` : `${item.sizeMB} MB`}
                      </span>
                    )}
                  </div>
                ))}
                {lastResult.result.items.length > 30 && (
                  <div className="text-xs text-slate-500 px-3 py-1.5">
                    ... and {lastResult.result.items.length - 30} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Command Bar ──────────────────────────────── */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 border-t border-champagne-200/50 bg-gradient-to-r from-white/95 via-champagne-50/30 to-white/95 px-6 py-4 dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/50 dark:to-navy-900/90"
          >
            {/* Voice input */}
            <button
              type="button"
              disabled={isTranscribing}
              onClick={isRecording ? stopRecording : startRecording}
              className={`group flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-all hover:scale-105 disabled:opacity-50 ${
                isRecording
                  ? "bg-red-500 shadow-red-500/30 animate-pulse text-white"
                  : "bg-champagne-100 text-champagne-600 hover:bg-champagne-200 dark:bg-navy-800 dark:text-champagne-300 dark:hover:bg-navy-700"
              }`}
              title={isRecording ? "Stop Recording" : "Voice Input"}
            >
              {isTranscribing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            {/* Text input */}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-2xl border border-champagne-200/50 bg-white/80 px-5 py-3.5 text-sm text-navy-700 outline-none transition-all placeholder:text-navy-400/50 focus:border-champagne-400 focus:ring-2 focus:ring-champagne-400/20 dark:border-champagne-500/20 dark:bg-navy-900/80 dark:text-champagne-100 dark:placeholder:text-slate-500 dark:focus:border-champagne-400/50"
              placeholder={
                isRecording
                  ? "Listening..."
                  : isTranscribing
                  ? "Transcribing..."
                  : 'Tell me what to do — "Create a budget spreadsheet in Documents"'
              }
              disabled={isExecuting || isRecording || isTranscribing}
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={isExecuting || !input.trim()}
              className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-champagne-500 to-blush-500 shadow-lg shadow-champagne-500/30 transition-all hover:shadow-champagne-500/50 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isExecuting ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Send className="h-5 w-5 text-white transition-transform group-hover:translate-x-0.5" />
              )}
            </button>

            {/* Clear log */}
            {assistantActivityLog.length > 0 && (
              <button
                type="button"
                onClick={clearActivityLog}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blush-200/50 bg-blush-50/80 text-blush-500 transition-all hover:bg-blush-100 dark:border-blush-500/20 dark:bg-blush-900/20 dark:text-blush-400"
                title="Clear Activity Log"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export { OSAssistantPanel };
