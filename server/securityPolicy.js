/**
 * securityPolicy.js — Centralized Security Enforcement Layer
 * 
 * All file access decisions flow through this module. No other module
 * should contain inline path-safety checks.
 * 
 * Design:  Allow-list first (user-safe directories), then block-list
 *          (system/sensitive paths, dangerous extensions, protected patterns).
 */

import path from 'path';
import os from 'os';

// ─── Constants ───────────────────────────────────────────────────────────────

const HOME = os.homedir();

const ALLOWED_BASE_DIRS = [
  path.join(HOME, 'Desktop'),
  path.join(HOME, 'Documents'),
  path.join(HOME, 'Downloads'),
].map(p => path.normalize(path.resolve(p)));

const BLOCKED_DIR_SEGMENTS = [
  'windows', 'system32', 'syswow64', 'program files', 'program files (x86)',
  'programdata', 'appdata', 'application data', 'temp', 'windows.old',
  '.ssh', '.gnupg', '.git', 'node_modules', '.aws', '.config',
  'boot', 'recovery', '$recycle.bin', 'efi', 'system volume information'
];

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.sys', '.bat', '.cmd', '.ps1',
  '.reg', '.msi', '.vbs', '.com', '.scr', '.cpl',
  '.inf', '.drv', '.ocx', '.pif', '.hta', '.wsc',
  '.wsf', '.lnk'
]);

const PROTECTED_FILENAMES = new Set([
  'ntuser.dat', 'ntuser.dat.log', 'boot.ini', 'bootmgr',
  'pagefile.sys', 'swapfile.sys', 'hiberfil.sys',
  'desktop.ini', 'thumbs.db', 'iconcache.db'
]);

// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Normalizes a path and returns all its constituent parts.
 * Handles both / and \ regardless of OS.
 */
function getPathParts(targetPath) {
  const resolved = path.normalize(path.resolve(targetPath));
  return resolved.split(path.sep).filter(p => p !== '');
}

/**
 * Checks if a path is a root drive (e.g. C:\ or /).
 */
function isRootPath(targetPath) {
  const resolved = path.normalize(path.resolve(targetPath));
  const parts = getPathParts(resolved);
  // On Windows, 'C:' is one part. On Linux, '/' is zero parts after split.
  return parts.length <= 1;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Master Security Check.
 * Returns an object: { allowed: boolean, reason: string | null }
 */
export function isPathAllowed(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    return { allowed: false, reason: 'Invalid path input.' };
  }

  const resolved = path.normalize(path.resolve(targetPath));
  const parts = getPathParts(resolved);
  const lowercaseParts = parts.map(p => p.toLowerCase());
  const basename = path.basename(resolved).toLowerCase();
  const extension = path.extname(resolved).toLowerCase();

  // 1. Root Check
  if (isRootPath(resolved)) {
    return { allowed: false, reason: 'Access to system root or drive root is strictly prohibited.' };
  }

  // 2. Blocked Directory Check
  for (const blocked of BLOCKED_DIR_SEGMENTS) {
    if (lowercaseParts.includes(blocked)) {
      return { allowed: false, reason: `Path contains restricted system directory: "${blocked}"` };
    }
  }

  // 3. Blocked Extension Check
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return { allowed: false, reason: `File type "${extension}" is blocked for security.` };
  }

  // 4. Protected Filename Check
  if (PROTECTED_FILENAMES.has(basename)) {
    return { allowed: false, reason: `"${basename}" is a protected system file.` };
  }

  // 5. Allowed Workspace Check (Parent-Child verification)
  const isUnderAllowedBase = ALLOWED_BASE_DIRS.some(base => {
    const relative = path.relative(base, resolved);
    // If the path is inside the base, the relative path won't start with '..'
    // and won't be absolute.
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  });

  if (!isUnderAllowedBase) {
    return { 
      allowed: false, 
      reason: 'Path is outside of approved workspaces (Desktop, Documents, Downloads).' 
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Legacy support for simple boolean checks.
 */
export function isFileTypeAllowed(targetPath) {
  if (!targetPath) return false;
  const ext = path.extname(targetPath).toLowerCase();
  return !BLOCKED_EXTENSIONS.has(ext);
}

/**
 * Human-readable violation reason.
 */
export function getSecurityViolationReason(targetPath) {
  const result = isPathAllowed(targetPath);
  return result.reason;
}

/**
 * Legacy safe directory check (wider but still blocks system stuff).
 */
export function isSafeDirectoryLegacy(targetDir) {
  if (!targetDir) return false;
  const resolved = path.normalize(path.resolve(targetDir));
  
  // Basic block-list only, no allow-list required for legacy file manager
  if (isRootPath(resolved)) return false;
  
  const parts = getPathParts(resolved).map(p => p.toLowerCase());
  return !BLOCKED_DIR_SEGMENTS.some(blocked => parts.includes(blocked));
}

export function getAllowedDirectories() {
  return [...ALLOWED_BASE_DIRS];
}

export function addAllowedDirectory(dirPath) {
  const resolved = path.normalize(path.resolve(dirPath));
  if (!ALLOWED_BASE_DIRS.includes(resolved)) {
    ALLOWED_BASE_DIRS.push(resolved);
  }
}
