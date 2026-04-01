
export type DataSourceType = "csv" | "json" | "txt" | "xlsx" | "pdf";

export type LifeOSSource = {
  id: string;
  name: string;
  type: DataSourceType;
  addedAt: number;
  description?: string;
};

export type LifeOSDataRecord = {
  id: string;
  sourceId: string;
  timestamp: number;
  summary: string;
  numericFields: Record<string, number>;
  categoricalFields: Record<string, string>;
  textFields: string[];
  keywords: string[];
  embedding: number[];
  raw: Record<string, unknown>;
};

export type LifeOSChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type TimeframeFilter = "week" | "month" | "all";

export type CategoryDatum = {
  label: string;
  value: number;
};

export type TimeSeriesDatum = {
  label: string;
  value: number;
};

export type InsightSummary = {
  totalRecords: number;
  activeSources: number;
  keywords: string[];
  moodWords: string[];
  numericHighlights: Array<{ field: string; total: number; average: number }>;
  categoryBreakdown: CategoryDatum[];
  timeSeries: TimeSeriesDatum[];
  forecasts: Array<{ field: string; forecast: number }>;
  narrative: string;
};
