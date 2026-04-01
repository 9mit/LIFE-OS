/**
 * processWatcher.js — Windows Application Detection Service
 *
 * Polls the Windows process list at a configurable interval to detect
 * when watched applications are launched.  Emits events via a callback
 * that the Express server pipes to SSE clients.
 *
 * Disabled by default.  CPU overhead is negligible (~0.1 % every 3 s).
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ─── Default Watchlist ───────────────────────────────────────────────────────

let watchlist = [
  { processName: 'notepad.exe',      displayName: 'Notepad' },
  { processName: 'WINWORD.EXE',      displayName: 'Microsoft Word' },
  { processName: 'EXCEL.EXE',        displayName: 'Microsoft Excel' },
  { processName: 'POWERPNT.EXE',     displayName: 'Microsoft PowerPoint' },
  { processName: 'Code.exe',         displayName: 'VS Code' },
  { processName: 'WindowsTerminal.exe', displayName: 'Windows Terminal' },
  { processName: 'wordpad.exe',      displayName: 'WordPad' },
];

// ─── State ───────────────────────────────────────────────────────────────────

let isEnabled = false;
let pollInterval = null;
const POLL_MS = 3000;

// Set of process names (lowercase) that were running on the last poll.
let previouslyRunning = new Set();

// Callback: (event) => void   — set by the server when SSE clients connect
let onAppDetected = null;

// ─── Internal ────────────────────────────────────────────────────────────────

async function getRunningProcesses() {
  try {
    // tasklist /FO CSV /NH is fast and outputs CSV without header
    const { stdout } = await execAsync('tasklist /FO CSV /NH', {
      windowsHide: true,
      timeout: 5000,
    });

    const names = new Set();
    for (const line of stdout.split('\n')) {
      // Each line: "name.exe","PID","Session","SessionNum","Mem Usage"
      const match = line.match(/^"([^"]+)"/);
      if (match) names.add(match[1].toLowerCase());
    }
    return names;
  } catch {
    return new Set();
  }
}

async function poll() {
  const current = await getRunningProcesses();

  for (const app of watchlist) {
    const key = app.processName.toLowerCase();
    const isRunningNow = current.has(key);
    const wasRunningBefore = previouslyRunning.has(key);

    if (isRunningNow && !wasRunningBefore) {
      // New launch detected
      const event = {
        type: 'app_detected',
        processName: app.processName,
        displayName: app.displayName,
        timestamp: Date.now(),
      };

      if (onAppDetected) {
        onAppDetected(event);
      }
    }
  }

  previouslyRunning = current;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startWatcher(callback) {
  if (isEnabled) return;
  isEnabled = true;
  onAppDetected = callback;

  // Snapshot current processes so we don't fire for already-running apps
  getRunningProcesses().then(procs => {
    previouslyRunning = procs;
    pollInterval = setInterval(poll, POLL_MS);
  });
}

export function stopWatcher() {
  isEnabled = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  onAppDetected = null;
}

export function isWatcherEnabled() {
  return isEnabled;
}

export function getWatchlist() {
  return [...watchlist];
}

export function setWatchlist(newList) {
  watchlist = newList.map(item => ({
    processName: item.processName,
    displayName: item.displayName || item.processName,
  }));
}

export function addToWatchlist(processName, displayName) {
  const exists = watchlist.some(w => w.processName.toLowerCase() === processName.toLowerCase());
  if (!exists) {
    watchlist.push({ processName, displayName: displayName || processName });
  }
}

export function removeFromWatchlist(processName) {
  watchlist = watchlist.filter(w => w.processName.toLowerCase() !== processName.toLowerCase());
}
