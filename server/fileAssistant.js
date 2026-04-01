/**
 * fileAssistant.js — Controlled File Read/Write Engine
 *
 * All operations:
 *  • Pass through securityPolicy before touching disk
 *  • Are size-limited (MAX_READ_BYTES = 500 KB)
 *  • Create automatic backups before destructive writes
 *  • Are logged to SQLite for undo support
 */

import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { isPathAllowed, getSecurityViolationReason } from './securityPolicy.js';
import { logOperation, getDb } from './db_operations.js';
import crypto from 'crypto';

const MAX_READ_BYTES = 500 * 1024; // 500 KB

// ─── Internal Helpers ────────────────────────────────────────────────────────

function rejectIfBlocked(filePath) {
  const reason = getSecurityViolationReason(filePath);
  if (reason) {
    throw new Error(`Security: ${reason} (${filePath})`);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a timestamped backup copy of a file before it is overwritten.
 * Returns the backup path.
 */
async function createBackup(filePath) {
  if (!(await fileExists(filePath))) return null;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `${base}__backup_${stamp}${ext}`;
  const backupPath = path.join(dir, backupName);

  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Read the text content of a file (up to MAX_READ_BYTES).
 */
export async function readFileContent(filePath) {
  rejectIfBlocked(filePath);

  const stats = await fs.stat(filePath);
  if (stats.size > MAX_READ_BYTES) {
    throw new Error(`File too large to read (${(stats.size / 1024).toFixed(1)} KB). Limit is ${MAX_READ_BYTES / 1024} KB.`);
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return {
    success: true,
    filePath,
    sizeBytes: stats.size,
    content,
  };
}

/**
 * Write (overwrite) the content of a file. Auto-creates parent dirs.
 * Creates a backup if the file already exists.
 */
export async function writeFileContent(filePath, content) {
  rejectIfBlocked(filePath);

  const operationId = crypto.randomUUID();
  let backupPath = null;

  // Backup existing file
  if (await fileExists(filePath)) {
    backupPath = await createBackup(filePath);
  }

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  await fs.writeFile(filePath, content, 'utf-8');

  // Log for undo
  await logOperation(operationId, 'write', backupPath || '(new file)', filePath);

  return {
    success: true,
    operationId,
    filePath,
    backupPath,
    bytesWritten: Buffer.byteLength(content, 'utf-8'),
  };
}

/**
 * Append content to the end of an existing file (or create it).
 */
export async function appendToFile(filePath, content) {
  rejectIfBlocked(filePath);

  const operationId = crypto.randomUUID();

  // Backup existing file before appending
  let backupPath = null;
  if (await fileExists(filePath)) {
    backupPath = await createBackup(filePath);
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, content, 'utf-8');

  await logOperation(operationId, 'append', backupPath || '(new file)', filePath);

  return {
    success: true,
    operationId,
    filePath,
    backupPath,
    bytesAppended: Buffer.byteLength(content, 'utf-8'),
  };
}

/**
 * Create a new file. Fails if the file already exists (safety).
 */
export async function createFile(filePath, content = '') {
  rejectIfBlocked(filePath);

  if (await fileExists(filePath)) {
    throw new Error(`File already exists: ${filePath}. Use writeFileContent to overwrite.`);
  }

  const operationId = crypto.randomUUID();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');

  await logOperation(operationId, 'create', '(new file)', filePath);

  return {
    success: true,
    operationId,
    filePath,
    bytesWritten: Buffer.byteLength(content, 'utf-8'),
  };
}

/**
 * List directory contents with metadata.
 */
export async function readDirectory(dirPath) {
  rejectIfBlocked(dirPath);

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      const stats = await fs.stat(fullPath);
      items.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        sizeMB: entry.isFile() ? parseFloat((stats.size / 1024 / 1024).toFixed(2)) : null,
        modified: stats.mtime,
        extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : null,
      });
    } catch {
      // skip entries we can't stat
    }
  }

  items.sort((a, b) => {
    // Directories first, then by name
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return { success: true, dirPath, items, count: items.length };
}

/**
 * Get metadata about a single file.
 */
export async function getFileInfo(filePath) {
  rejectIfBlocked(filePath);

  const stats = await fs.stat(filePath);
  return {
    success: true,
    filePath,
    name: path.basename(filePath),
    extension: path.extname(filePath).toLowerCase(),
    sizeMB: parseFloat((stats.size / 1024 / 1024).toFixed(2)),
    sizeBytes: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
    isDirectory: stats.isDirectory(),
  };
}
