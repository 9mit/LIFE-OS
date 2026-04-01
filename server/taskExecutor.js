/**
 * taskExecutor.js — Natural Language → Deterministic Action Pipeline
 *
 * Architecture (Hybrid Intelligence):
 *   1. Ollama parses NL into a structured JSON task   (AI responsibility)
 *   2. This module maps the JSON to backend functions  (deterministic)
 *   3. Backend functions execute safely                (deterministic)
 *
 * The LLM never executes anything directly — it only classifies intent.
 */

import os from 'os';
import path from 'path';
import { parseAssistantIntent } from './ollama.js';
import { readFileContent, writeFileContent, appendToFile, createFile, readDirectory, getFileInfo } from './fileAssistant.js';
import { readExcel, writeExcel, editExcelCell, addExcelSheet, readWordDocument, writeWordDocument, appendToWordDocument } from './officeAssistant.js';
import { isPathAllowed, getSecurityViolationReason, getAllowedDirectories } from './securityPolicy.js';

// ─── Directory Resolution ────────────────────────────────────────────────────

function resolveUserPath(dirString) {
  if (!dirString) return null;
  const home = os.homedir();

  if (dirString.startsWith('~')) {
    return path.join(home, dirString.slice(1));
  }

  const lower = dirString.toLowerCase();
  if (lower === 'downloads' || lower === 'download') return path.join(home, 'Downloads');
  if (lower === 'desktop') return path.join(home, 'Desktop');
  if (lower === 'documents') return path.join(home, 'Documents');

  if (!path.isAbsolute(dirString)) {
    return path.join(home, dirString);
  }
  return dirString;
}

// ─── Task Execution Router ──────────────────────────────────────────────────

/**
 * Main entry point.  Takes a raw English prompt, parses it via Ollama,
 * then routes the structured intent to the appropriate handler.
 *
 * Returns { success, action, result, message }
 */
export async function executeTask(prompt) {
  let intent;

  try {
    intent = await parseAssistantIntent(prompt);
  } catch (err) {
    return {
      success: false,
      action: 'parse_error',
      result: null,
      message: `Failed to understand the command: ${err.message}`,
    };
  }

  if (!intent || !intent.action) {
    return {
      success: false,
      action: 'unknown',
      result: null,
      message: 'I could not determine what you want me to do. Please rephrase your request.',
    };
  }

  try {
    switch (intent.action) {
      case 'create_file':
        return await handleCreateFile(intent);
      case 'write_file':
        return await handleWriteFile(intent);
      case 'append_file':
        return await handleAppendFile(intent);
      case 'read_file':
        return await handleReadFile(intent);
      case 'list_directory':
        return await handleListDirectory(intent);
      case 'file_info':
        return await handleFileInfo(intent);
      case 'create_excel':
        return await handleCreateExcel(intent);
      case 'edit_excel':
        return await handleEditExcel(intent);
      case 'read_excel':
        return await handleReadExcel(intent);
      case 'create_word':
        return await handleCreateWord(intent);
      case 'append_word':
        return await handleAppendWord(intent);
      case 'read_word':
        return await handleReadWord(intent);
      default:
        return {
          success: false,
          action: intent.action,
          result: null,
          message: `Action "${intent.action}" is not supported yet.`,
        };
    }
  } catch (error) {
    return {
      success: false,
      action: intent.action,
      result: null,
      message: `Error executing task: ${error.message}`,
    };
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleCreateFile(intent) {
  const filePath = resolveFilePath(intent);
  const result = await createFile(filePath, intent.content || '');
  return {
    success: true,
    action: 'create_file',
    result,
    message: `Created file: ${path.basename(filePath)}`,
  };
}

async function handleWriteFile(intent) {
  const filePath = resolveFilePath(intent);
  const result = await writeFileContent(filePath, intent.content || '');
  return {
    success: true,
    action: 'write_file',
    result,
    message: `Wrote ${result.bytesWritten} bytes to ${path.basename(filePath)}${result.backupPath ? ' (backup created)' : ''}`,
  };
}

async function handleAppendFile(intent) {
  const filePath = resolveFilePath(intent);
  const result = await appendToFile(filePath, intent.content || '');
  return {
    success: true,
    action: 'append_file',
    result,
    message: `Appended ${result.bytesAppended} bytes to ${path.basename(filePath)}`,
  };
}

async function handleReadFile(intent) {
  const filePath = resolveFilePath(intent);
  const result = await readFileContent(filePath);
  return {
    success: true,
    action: 'read_file',
    result,
    message: `Read ${result.sizeBytes} bytes from ${path.basename(filePath)}`,
  };
}

async function handleListDirectory(intent) {
  const dirPath = resolveUserPath(intent.directory || 'Desktop');
  const result = await readDirectory(dirPath);
  return {
    success: true,
    action: 'list_directory',
    result,
    message: `Found ${result.count} items in ${path.basename(dirPath)}`,
  };
}

async function handleFileInfo(intent) {
  const filePath = resolveFilePath(intent);
  const result = await getFileInfo(filePath);
  return {
    success: true,
    action: 'file_info',
    result,
    message: `${result.name}: ${result.sizeMB} MB, last modified ${new Date(result.modified).toLocaleDateString()}`,
  };
}

async function handleCreateExcel(intent) {
  const filePath = resolveFilePath(intent, '.xlsx');
  const sheetsData = intent.sheetsData || { 'Sheet1': intent.data || [{}] };
  const result = await writeExcel(filePath, sheetsData, intent.options || {});
  return {
    success: true,
    action: 'create_excel',
    result,
    message: `Created Excel file: ${path.basename(filePath)} with sheets: ${result.sheetsCreated.join(', ')}`,
  };
}

async function handleEditExcel(intent) {
  const filePath = resolveFilePath(intent);
  const result = await editExcelCell(filePath, intent.sheet || 'Sheet1', intent.cell, intent.value);
  return {
    success: true,
    action: 'edit_excel',
    result,
    message: `Updated cell ${intent.cell} in ${path.basename(filePath)} from "${result.oldValue}" to "${result.newValue}"`,
  };
}

async function handleReadExcel(intent) {
  const filePath = resolveFilePath(intent);
  const result = await readExcel(filePath);
  return {
    success: true,
    action: 'read_excel',
    result,
    message: `Read Excel file: ${path.basename(filePath)} — ${result.totalSheets} sheet(s)`,
  };
}

async function handleCreateWord(intent) {
  const filePath = resolveFilePath(intent, '.docx');
  const result = await writeWordDocument(filePath, intent.content || '');
  return {
    success: true,
    action: 'create_word',
    result,
    message: `Created Word document: ${path.basename(filePath)} (${result.paragraphCount} paragraphs)`,
  };
}

async function handleAppendWord(intent) {
  const filePath = resolveFilePath(intent);
  const result = await appendToWordDocument(filePath, intent.content || '');
  return {
    success: true,
    action: 'append_word',
    result,
    message: `Appended text to ${path.basename(filePath)}`,
  };
}

async function handleReadWord(intent) {
  const filePath = resolveFilePath(intent);
  const result = await readWordDocument(filePath);
  return {
    success: true,
    action: 'read_word',
    result,
    message: `Read Word document: ${path.basename(filePath)}`,
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function resolveFilePath(intent, defaultExt = '') {
  let filePath = intent.filePath || intent.path;

  if (!filePath && intent.fileName && intent.directory) {
    const dir = resolveUserPath(intent.directory);
    let fileName = intent.fileName;
    if (defaultExt && !path.extname(fileName)) {
      fileName += defaultExt;
    }
    filePath = path.join(dir, fileName);
  }

  if (!filePath && intent.fileName) {
    // Default to Desktop if no directory specified
    let fileName = intent.fileName;
    if (defaultExt && !path.extname(fileName)) {
      fileName += defaultExt;
    }
    filePath = path.join(os.homedir(), 'Desktop', fileName);
  }

  if (!filePath) {
    throw new Error('Could not determine the file path. Please specify a file name and directory.');
  }

  const resolved = path.resolve(filePath);
  
  // REDUNDANT SAFETY CHECK: Ensure path is allowed before returning to handler
  const security = isPathAllowed(resolved);
  if (!security.allowed) {
    throw new Error(`Security Violation: ${security.reason}`);
  }

  return resolved;
}
