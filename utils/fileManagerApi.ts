// utils/fileManagerApi.ts

const API_BASE_URL = 'http://localhost:3001/api';

async function safeJsonResponse(response: Response) {
  const text = await response.text();
  
  if (!response.ok) {
    let errorObj: any = {};
    try {
      errorObj = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("Invalid error JSON:", text);
    }
    throw new Error(errorObj.error || `HTTP Error ${response.status}`);
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (err) {
    console.error("Invalid JSON response:", text);
    throw new Error("Backend returned invalid JSON format.");
  }
}

export interface ScanFilter {
  sizeMB?: number;
  extension?: string;
}

export interface ParseResponse {
  action: 'scan' | 'organize' | 'delete' | 'suggest_cleanup' | string;
  directory: string;
  query?: string;
  timeFilter?: 'today' | 'week' | 'month' | 'year';
  organizeBy?: 'month' | 'year' | 'extension' | 'size';
  cleanupType?: 'duplicates' | 'large' | 'unused';
  scanDepth?: number;
  filter?: ScanFilter;
}

export interface FileMetadata {
  name: string;
  path: string;
  sizeMB: number;
  modified: string;
  isDuplicateOption?: boolean;
  type?: 'original' | 'duplicate';
}

export interface ScanResponse {
  targetDir: string;
  files: FileMetadata[];
}

export interface ExecuteRequest {
  action: 'delete' | 'move';
  filePaths: string[];
  destinationDir?: string;
  organizeBy?: 'month' | 'year' | 'extension' | 'size';
}

export interface ExecuteResponse {
  action: string;
  operationId: string;
  results: Array<{
     filePath: string;
     success: boolean;
     path?: string;
     error?: string;
  }>;
}

/**
 * Sends a natural language prompt to the local LLM parser endpoint.
 */
export async function parseQuery(promptText: string): Promise<ParseResponse> {
  const response = await fetch(`${API_BASE_URL}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: promptText })
  });

  return safeJsonResponse(response);
}

/**
 * Sends a structured JSON intent to the local file scanner endpoint.
 */
export async function executeScan(directory: string, query?: string, filter?: ScanFilter, cleanupType?: string, timeFilter?: string, scanDepth?: number): Promise<ScanResponse> {
  const response = await fetch(`${API_BASE_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory, query, filter, cleanupType, timeFilter, scanDepth })
  });

  return safeJsonResponse(response);
}

/**
 * Sends a semantic query to the local vector DB search endpoint.
 */
export async function executeSemanticSearch(query: string, directory: string): Promise<ScanResponse> {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, directory })
  });

  return safeJsonResponse(response);
}

/**
 * Reverses a previously executed batch operation using its tracked operationId.
 */
export async function undoAction(operationId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationId })
  });

  return safeJsonResponse(response);
}

/**
 * Sends an array of file paths to the local backend to be moved or soft-deleted.
 */
export async function executeAction(request: ExecuteRequest): Promise<ExecuteResponse> {
  const response = await fetch(`${API_BASE_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  return safeJsonResponse(response);
}

/**
 * Fetches an AI-generated insight for a scan summary.
 */
export async function fetchScanInsight(scanSummary: any): Promise<{ insight: string }> {
  const response = await fetch(`${API_BASE_URL}/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanSummary })
  });
  return safeJsonResponse(response);
}

/**
 * Fetches a conversational response from the backend Chat Assistant.
 */
export async function fetchChatResponse(messages: any[]): Promise<{ message: { role: string; content: string } }> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  return safeJsonResponse(response);
}
