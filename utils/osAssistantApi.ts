// utils/osAssistantApi.ts — Frontend API client for the OS Assistant

const API_BASE_URL = 'http://localhost:3001/api';

async function safeJsonResponse(response: Response) {
  const text = await response.text();
  if (!response.ok) {
    let errorObj: any = {};
    try { errorObj = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
    throw new Error(errorObj.error || `HTTP Error ${response.status}`);
  }
  try { return text ? JSON.parse(text) : {}; }
  catch { throw new Error('Backend returned invalid JSON format.'); }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssistantTaskResult {
  success: boolean;
  action: string;
  result: any;
  message: string;
}

export interface FileReadResult {
  success: boolean;
  filePath: string;
  sizeBytes: number;
  content: string;
}

export interface WatcherStatus {
  enabled: boolean;
  watchlist: Array<{ processName: string; displayName: string }>;
}

export interface SSEEvent {
  type: 'connected' | 'app_detected' | 'task_complete' | 'file_written' | 'office_written';
  processName?: string;
  displayName?: string;
  action?: string;
  success?: boolean;
  message?: string;
  filePath?: string;
  timestamp: number;
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Execute a natural language task via the AI pipeline.
 */
export async function executeAssistantTask(prompt: string): Promise<AssistantTaskResult> {
  const response = await fetch(`${API_BASE_URL}/assistant/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return safeJsonResponse(response);
}

/**
 * Read a file's contents.
 */
export async function readFile(filePath: string): Promise<FileReadResult> {
  const response = await fetch(`${API_BASE_URL}/assistant/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
  return safeJsonResponse(response);
}

/**
 * Write content to a file.
 */
export async function writeFile(filePath: string, content: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/assistant/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, content }),
  });
  return safeJsonResponse(response);
}

/**
 * Read an Office document (Excel/Word).
 */
export async function readOfficeDocument(filePath: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/assistant/office/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
  return safeJsonResponse(response);
}

/**
 * Write an Office document (Excel/Word).
 */
export async function writeOfficeDocument(filePath: string, data?: any, content?: string, type?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/assistant/office/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, data, content, type }),
  });
  return safeJsonResponse(response);
}

/**
 * Get the process watcher status + watchlist.
 */
export async function getWatcherStatus(): Promise<WatcherStatus> {
  const response = await fetch(`${API_BASE_URL}/assistant/watcher/status`);
  return safeJsonResponse(response);
}

/**
 * Toggle the process watcher on/off.
 */
export async function toggleProcessWatcher(enabled: boolean): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/assistant/watcher/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  return safeJsonResponse(response);
}

/**
 * Update the process watcher watchlist.
 */
export async function updateWatchlist(watchlist: Array<{ processName: string; displayName: string }>): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/assistant/watcher/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ watchlist }),
  });
  return safeJsonResponse(response);
}

/**
 * Subscribe to Server-Sent Events from the assistant backend.
 * Returns a cleanup function to close the connection.
 */
export function subscribeToEvents(callback: (event: SSEEvent) => void): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/assistant/events`);

  eventSource.onmessage = (evt) => {
    try {
      const data: SSEEvent = JSON.parse(evt.data);
      callback(data);
    } catch {
      console.warn('Failed to parse SSE event:', evt.data);
    }
  };

  eventSource.onerror = () => {
    console.warn('SSE connection error — will auto-reconnect.');
  };

  return () => eventSource.close();
}
