
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  InsightSummary,
  LifeOSChatMessage,
  LifeOSDataRecord,
  LifeOSSource,
  TimeframeFilter,
} from "../types/data";

export type LifeOSView = "upload" | "insights" | "chat" | "reports";
export type Theme = "light" | "dark";

type LifeOSState = {
  view: LifeOSView;
  sources: LifeOSSource[];
  records: LifeOSDataRecord[];
  summary: InsightSummary | null;
  timeframe: TimeframeFilter;
  chatHistory: LifeOSChatMessage[];
  isLoading: boolean;
  theme: Theme;
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
        })),
    }),
    {
      name: "lifeos-state",
      partialize: (state) => ({
        view: state.view,
        timeframe: state.timeframe,
        theme: state.theme,
      }),
    }
  )
);
