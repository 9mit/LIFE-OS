import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { parseIntent, generateChatResponse, generateScanInsight } from './ollama.js';
import { scanDirectory, buildCache, searchCache, isCacheReady } from './scanner.js';
import { moveFile, softDeleteFile } from './fileOperations.js';
import { getDb, logOperation, undoOperation } from './db_operations.js';
import { isSafeDirectoryLegacy as isSafeDirectory } from './securityPolicy.js';
import { isPathAllowed, getSecurityViolationReason } from './securityPolicy.js';
import { executeTask } from './taskExecutor.js';
import { readFileContent, writeFileContent, readDirectory } from './fileAssistant.js';
import { readExcel, writeExcel, readWordDocument, writeWordDocument } from './officeAssistant.js';
import { startWatcher, stopWatcher, isWatcherEnabled, getWatchlist, setWatchlist } from './processWatcher.js';
import crypto from 'crypto';

// Setup __dirname equivalent for ES modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LIFE_OS_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Simple in-memory rate limiter for AI endpoints (60 req/min per IP)
const rateLimitMap = new Map();
function rateLimit(maxRequests = 60, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
    const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);
    next();
  };
}

const SEARCH_DIRECTORIES = ['Desktop', 'Documents', 'Downloads'];

// Initialize the SQLite history DB immediately on boot
getDb().then(() => console.log('SQLite Operation History DB Initialized')).catch(console.error);

// Background indexing loop
(async function initAutomatedCache() {
    const resolvedDirs = SEARCH_DIRECTORIES.map(d => resolveDirectory(d)).filter(Boolean);
    await buildCache(resolvedDirs);
    
    // Refresh the index every 15 minutes to keep it relatively current
    setInterval(async () => {
        await buildCache(resolvedDirs);
    }, 15 * 60 * 1000);
})();

// Helper to expand user queries to actual machine paths
function resolveDirectory(dirString) {
  if (!dirString) return null;
  const home = os.homedir();
  
  if (dirString.startsWith('~')) {
    return path.join(home, dirString.slice(1));
  }
  
  // Handle obvious keywords common in LLM outputs
  const lower = dirString.toLowerCase();
  if (lower === 'downloads' || lower === 'download') return path.join(home, 'Downloads');
  if (lower === 'desktop') return path.join(home, 'Desktop');
  if (lower === 'documents') return path.join(home, 'Documents');
  
  // If no prefix, assume it might be relative to home for convenience
  if (!path.isAbsolute(dirString)) {
      return path.join(home, dirString);
  }
  
  return dirString;
}

// ─── SSE: Server-Sent Events for Real-Time Notifications ─────────────────────

const sseClients = new Set();

function broadcastSSE(event) {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// ─── Existing File Manager Routes ────────────────────────────────────────────

app.post('/api/parse', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    
    const intentJSON = await parseIntent(prompt);
    res.json(intentJSON);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', rateLimit(30, 60000), async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "Missing or invalid messages array" });
    
    const responseText = await generateChatResponse(messages);
    res.json({ message: { role: "assistant", content: responseText } });
  } catch (err) {
    console.error("Chat API Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/insights', rateLimit(30, 60000), async (req, res) => {
  try {
    const { scanSummary } = req.body;
    if (!scanSummary) return res.status(400).json({ error: "Missing scanSummary" });
    
    const insightText = await generateScanInsight(scanSummary);
    res.json({ insight: insightText });
  } catch (err) {
    console.error("Insights API Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scan', async (req, res) => {
  try {
    const { directory, query, filter, cleanupType, timeFilter, scanDepth } = req.body;
    
    if (directory === 'auto') {
        if (!isCacheReady) {
             return res.status(503).json({ error: "The intelligent search cache is still building. Please try again in a few moments." });
        }
        
        const aggregatedFiles = searchCache(query, filter || {}, cleanupType, timeFilter);
        return res.json({ files: aggregatedFiles, targetDir: 'Auto (Cached Locations)' });
    }

    console.log("Scan request received");
    console.log("Directory:", directory);
    const targetDir = resolveDirectory(directory);
    
    if (!targetDir) {
       return res.status(400).json({ error: "Invalid directory specified." });
    }
    
    if (!isSafeDirectory(targetDir)) {
       return res.status(403).json({ error: "Directory access restricted for safety." });
    }
    
    console.log(`[Scan] Dir: ${targetDir} | Query: ${query || 'none'} | Filter:`, filter, `| Cleanup: ${cleanupType || 'none'} | Time: ${timeFilter || 'none'} | Depth: ${scanDepth !== undefined ? scanDepth : 'default'}`);
    const files = await scanDirectory(targetDir, query, filter || {}, cleanupType, timeFilter, scanDepth !== undefined ? scanDepth : 5);
    
    res.json({ files, targetDir });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/execute', async (req, res) => {
  try {
    const { action, filePaths, destinationDir, organizeBy } = req.body;
    
    if (!action || !filePaths || !Array.isArray(filePaths)) {
       return res.status(400).json({ error: "Missing required parameters (action, filePaths array)" });
    }

    const results = [];
    // Generate a unique ID for this batch of operations so they can be undone together
    const operationId = crypto.randomUUID();
    
    for (const filePath of filePaths) {
        try {
            if (action === 'delete') {
                const result = await softDeleteFile(filePath, LIFE_OS_ROOT);
                await logOperation(operationId, 'trash', filePath, result.path);
                results.push({ filePath, ...result });
            } else if (action === 'move') {
                if (!destinationDir) {
                    return res.status(400).json({ error: "Missing destinationDir for move action" });
                }
                const expandedDest = resolveDirectory(destinationDir);
                let finalDest = expandedDest;

                // --- Metadata-Driven Dynamic Subfolders ---
                if (organizeBy) {
                    const stats = await fs.stat(filePath);
                    if (organizeBy === 'month') {
                        const d = new Date(stats.mtime);
                        finalDest = path.join(expandedDest, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                    } else if (organizeBy === 'year') {
                        const d = new Date(stats.mtime);
                        finalDest = path.join(expandedDest, `${d.getFullYear()}`);
                    } else if (organizeBy === 'extension') {
                        const ext = path.extname(filePath).slice(1).toUpperCase() || 'OTHER';
                        finalDest = path.join(expandedDest, ext);
                    } else if (organizeBy === 'size') {
                        const mb = stats.size / 1024 / 1024;
                        let bucket = 'Small';
                        if (mb > 100) bucket = 'Large';
                        else if (mb > 10) bucket = 'Medium';
                        finalDest = path.join(expandedDest, bucket);
                    }
                }

                const result = await moveFile(filePath, finalDest);
                await logOperation(operationId, 'move', filePath, result.path);
                results.push({ filePath, ...result });
            } else {
                 return res.status(400).json({ error: `Unsupported action: ${action}` });
            }
        } catch (err) {
            console.error(`Error processing file ${filePath}:`, err);
            results.push({ filePath, success: false, error: err.message });
        }
    }
    
    res.json({ action, operationId, results });
  } catch (err) {
    console.error("Execute Endpoint Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/undo', async (req, res) => {
    try {
        const { operationId } = req.body;
        if (!operationId) {
            return res.status(400).json({ error: 'Missing operationId to undo' });
        }
        
        console.log(`[Undo] Attempting to reverse operation trace: ${operationId}`);
        const results = await undoOperation(operationId);
        
        res.json({ operationId, undone: true, results });
    } catch (err) {
        console.error("Undo Endpoint Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── OS Assistant Routes ─────────────────────────────────────────────────────

/**
 * SSE endpoint — the frontend connects once and receives real-time events.
 */
app.get('/api/assistant/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

/**
 * Execute a natural language task via the hybrid AI pipeline.
 */
app.post('/api/assistant/execute', rateLimit(30, 60000), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    console.log(`[Assistant] Executing task: "${prompt}"`);
    const result = await executeTask(prompt);

    // Broadcast to SSE clients
    broadcastSSE({
      type: 'task_complete',
      action: result.action,
      success: result.success,
      message: result.message,
      timestamp: Date.now(),
    });

    res.json(result);
  } catch (err) {
    console.error('[Assistant] Execute Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Read file contents.
 */
app.post('/api/assistant/read', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });

    const securityReason = getSecurityViolationReason(filePath);
    if (securityReason) {
      return res.status(403).json({ error: `Security: ${securityReason}` });
    }

    const result = await readFileContent(filePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Write file contents.
 */
app.post('/api/assistant/write', async (req, res) => {
  try {
    const { filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'Missing filePath or content' });
    }

    const securityReason = getSecurityViolationReason(filePath);
    if (securityReason) {
      return res.status(403).json({ error: `Security: ${securityReason}` });
    }

    const result = await writeFileContent(filePath, content);

    broadcastSSE({
      type: 'file_written',
      filePath,
      bytesWritten: result.bytesWritten,
      timestamp: Date.now(),
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Read an Office document (Excel or Word).
 */
app.post('/api/assistant/office/read', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });

    const securityReason = getSecurityViolationReason(filePath);
    if (securityReason) {
      return res.status(403).json({ error: `Security: ${securityReason}` });
    }

    const ext = path.extname(filePath).toLowerCase();
    let result;
    if (ext === '.xlsx' || ext === '.xls') {
      result = await readExcel(filePath);
    } else if (ext === '.docx') {
      result = await readWordDocument(filePath);
    } else {
      return res.status(400).json({ error: `Unsupported office format: ${ext}` });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Write an Office document (Excel or Word).
 */
app.post('/api/assistant/office/write', async (req, res) => {
  try {
    const { filePath, data, content, type } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing filePath' });

    const securityReason = getSecurityViolationReason(filePath);
    if (securityReason) {
      return res.status(403).json({ error: `Security: ${securityReason}` });
    }

    let result;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.xlsx' || type === 'excel') {
      result = await writeExcel(filePath, data || { 'Sheet1': [] });
    } else if (ext === '.docx' || type === 'word') {
      result = await writeWordDocument(filePath, content || '');
    } else {
      return res.status(400).json({ error: `Unsupported office format: ${ext}` });
    }

    broadcastSSE({
      type: 'office_written',
      filePath,
      timestamp: Date.now(),
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get process watcher status.
 */
app.get('/api/assistant/watcher/status', (req, res) => {
  res.json({
    enabled: isWatcherEnabled(),
    watchlist: getWatchlist(),
  });
});

/**
 * Toggle the process watcher on/off.
 */
app.post('/api/assistant/watcher/toggle', (req, res) => {
  try {
    const { enabled } = req.body;

    if (enabled) {
      startWatcher((event) => {
        broadcastSSE(event);
      });
    } else {
      stopWatcher();
    }

    res.json({ success: true, enabled: isWatcherEnabled() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update the process watcher watchlist.
 */
app.post('/api/assistant/watcher/config', (req, res) => {
  try {
    const { watchlist: newWatchlist } = req.body;
    if (!Array.isArray(newWatchlist)) {
      return res.status(400).json({ error: 'watchlist must be an array' });
    }

    setWatchlist(newWatchlist);
    res.json({ success: true, watchlist: getWatchlist() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Global Error Handler ────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("Global Express Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`LifeOS Backend (with OS Assistant) listening on port ${PORT}`);
});
