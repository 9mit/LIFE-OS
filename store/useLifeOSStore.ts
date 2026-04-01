
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  InsightSummary,
  LifeOSChatMessage,
  LifeOSDataRecord,
  LifeOSSource,
  TimeframeFilter,
} from "../types/data";

export type LifeOSView = "upload" | "insights" | "chat" | "reports" | "file_manager" | "os_assistant";
export type Theme = "light" | "dark";

export type ActivityLogEntry = {
  id: string;
  type: 'task_complete' | 'app_detected' | 'file_written' | 'office_written' | 'info' | 'error';
  message: string;
  action?: string;
  success?: boolean;
  processName?: string;
  displayName?: string;
  filePath?: string;
  timestamp: number;
};

type LifeOSState = {
  view: LifeOSView;
  sources: LifeOSSource[];
  records: LifeOSDataRecord[];
  summary: InsightSummary | null;
  timeframe: TimeframeFilter;
  chatHistory: LifeOSChatMessage[];
  isLoading: boolean;
  theme: Theme;
  // OS Assistant state
  processWatcherEnabled: boolean;
  assistantActivityLog: ActivityLogEntry[];
  setView: (view: LifeOSView) => void;
  setSources: (sources: LifeOSSource[]) => void;
  setRecords: (records: LifeOSDataRecord[]) => void;
  setSummary: (summary: InsightSummary) => void;
  setTimeframe: (timeframe: TimeframeFilter) => void;
  setChatHistory: (history: LifeOSChatMessage[]) => void;
  appendChatMessage: (message: LifeOSChatMessage) => void;
  updateChatMessage: (id: string, content: string) => void;
  setLoading: (value: boolean) => void;
  setTheme: (theme: Theme) => void;
  setProcessWatcherEnabled: (enabled: boolean) => void;
  addActivityLogEntry: (entry: ActivityLogEntry) => void;
  clearActivityLog: () => void;
  reset: () => void;
};

const EMPTY_SUMMARY: InsightSummary = {
  totalRecords: 0,
  activeSources: 0,
  keywords: [],
  moodWords: [],
  numericHighlights: [],
  categoryBreakdown: [],
  timeSeries: [],
  forecasts: [],
  narrative: "Upload data to generate insights.",
};

export const useLifeOSStore = create<LifeOSState>()(
  persist(
    (set) => ({
      view: "upload",
      sources: [],
      records: [],
      summary: EMPTY_SUMMARY,
      timeframe: "month",
      chatHistory: [],
      isLoading: false,
      theme: "light",
      processWatcherEnabled: false,
      assistantActivityLog: [],
      setView: (view) => set({ view }),
      setSources: (sources) => set({ sources }),
      setRecords: (records) => set({ records }),
      setSummary: (summary) => set({ summary }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setChatHistory: (history) => set({ chatHistory: history }),
      appendChatMessage: (message) =>
        set((state) => ({ chatHistory: [...state.chatHistory, message] })),
      updateChatMessage: (id, content) =>
        set((state) => ({
          chatHistory: state.chatHistory.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        })),
      setLoading: (value) => set({ isLoading: value }),
      setTheme: (theme) => set({ theme }),
      setProcessWatcherEnabled: (enabled) => set({ processWatcherEnabled: enabled }),
      addActivityLogEntry: (entry) =>
        set((state) => ({
          assistantActivityLog: [entry, ...state.assistantActivityLog].slice(0, 200),
        })),
      clearActivityLog: () => set({ assistantActivityLog: [] }),
      reset: () =>
        set((state) => ({
          view: "upload",
          sources: [],
          records: [],
          summary: EMPTY_SUMMARY,
          timeframe: "month",
          chatHistory: [],
          isLoading: false,
          theme: state.theme,
          processWatcherEnabled: false,
          assistantActivityLog: [],
        })),
    }),
    {
      name: "lifeos-state",
      partialize: (state) => ({
        view: state.view,
        timeframe: state.timeframe,
        theme: state.theme,
        processWatcherEnabled: state.processWatcherEnabled,
      }),
    }
  )
);
