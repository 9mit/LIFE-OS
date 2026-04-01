/**
 * officeAssistant.js — Local MS Office Document Manipulation
 *
 * Excel: Uses the existing `xlsx` package (already in package.json)
 * Word:  Uses `docx` (creation) and `mammoth` (reading .docx)
 *
 * All operations enforce securityPolicy checks.
 */

import fs from 'fs/promises';
import path from 'path';
import XLSX from 'xlsx';
import { isPathAllowed, getSecurityViolationReason } from './securityPolicy.js';
import { logOperation } from './db_operations.js';
import crypto from 'crypto';

// ─── Internal Helpers ────────────────────────────────────────────────────────

function rejectIfBlocked(filePath) {
  const reason = getSecurityViolationReason(filePath);
  if (reason) {
    throw new Error(`Security: ${reason} (${filePath})`);
  }
}

// ─── Excel Operations ────────────────────────────────────────────────────────

/**
 * Read an Excel file and return its sheets as JSON.
 */
export async function readExcel(filePath) {
  rejectIfBlocked(filePath);

  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  
  const sheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  }

  return {
    success: true,
    filePath,
    sheetNames: workbook.SheetNames,
    sheets,
    totalSheets: workbook.SheetNames.length,
  };
}

/**
 * Write JSON data to an Excel file.
 * @param {string} filePath — target .xlsx path
 * @param {Object} sheetsData — { sheetName: [ {col1: val, col2: val}, ... ] }
 * @param {Object} options — { columnWidths?: number[] }
 */
export async function writeExcel(filePath, sheetsData, options = {}) {
  rejectIfBlocked(filePath);

  const operationId = crypto.randomUUID();
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, rows] of Object.entries(sheetsData)) {
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Apply column widths if provided
    if (options.columnWidths) {
      worksheet['!cols'] = options.columnWidths.map(w => ({ wch: w }));
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  await fs.writeFile(filePath, buffer);

  await logOperation(operationId, 'create_excel', '(new file)', filePath);

  return {
    success: true,
    operationId,
    filePath,
    sheetsCreated: Object.keys(sheetsData),
  };
}

/**
 * Edit a specific cell in an existing Excel file.
 */
export async function editExcelCell(filePath, sheetName, cellRef, value) {
  rejectIfBlocked(filePath);

  const operationId = crypto.randomUUID();
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
  }

  // Store old value for logging
  const oldValue = sheet[cellRef] ? sheet[cellRef].v : '(empty)';
  sheet[cellRef] = { v: value, t: typeof value === 'number' ? 'n' : 's' };

  const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  await fs.writeFile(filePath, outBuffer);

  await logOperation(operationId, 'edit_excel_cell', `${sheetName}!${cellRef}=${oldValue}`, filePath);

  return {
    success: true,
    operationId,
    filePath,
    sheet: sheetName,
    cell: cellRef,
    oldValue,
    newValue: value,
  };
}

/**
 * Add a new sheet with data to an existing Excel file.
 */
export async function addExcelSheet(filePath, sheetName, data) {
  rejectIfBlocked(filePath);

  const operationId = crypto.randomUUID();
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" already exists.`);
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  await fs.writeFile(filePath, outBuffer);

  await logOperation(operationId, 'add_excel_sheet', `(new sheet: ${sheetName})`, filePath);

  return {
    success: true,
    operationId,
    filePath,
    sheetName,
    rowCount: data.length,
  };
}

// ─── Word Operations ─────────────────────────────────────────────────────────

/**
 * Read text content from a .docx file using mammoth.
 */
export async function readWordDocument(filePath) {
  rejectIfBlocked(filePath);

  // Dynamic import to avoid issues if mammoth isn't installed yet
  const mammoth = await import('mammoth');
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  
  // Also extract raw text
  const textResult = await mammoth.extractRawText({ buffer });

  return {
    success: true,
    filePath,
    text: textResult.value,
    html: result.value,
    warnings: result.messages.map(m => m.message),
  };
}

/**
 * Create a new Word document (.docx) with the given text content.
 * Uses the `docx` package to build a proper Office Open XML document.
 */
export async function writeWordDocument(filePath, content) {
  rejectIfBlocked(filePath);

  const operationId = crypto.randomUUID();

  // Dynamic import
  const docxModule = await import('docx');
  const { Document, Packer, Paragraph, TextRun } = docxModule;

  // Split content into paragraphs by newline
  const paragraphs = content.split('\n').map(line => {
    // Detect headings: lines starting with # 
    if (line.startsWith('# ')) {
      return new Paragraph({
        children: [new TextRun({ text: line.replace(/^#+\s*/, ''), bold: true, size: 32 })],
        spacing: { after: 200 },
      });
    }
    if (line.startsWith('## ')) {
      return new Paragraph({
        children: [new TextRun({ text: line.replace(/^#+\s*/, ''), bold: true, size: 28 })],
        spacing: { after: 150 },
      });
    }
    return new Paragraph({
      children: [new TextRun({ text: line, size: 24 })],
      spacing: { after: 100 },
    });
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);

  await logOperation(operationId, 'create_word', '(new file)', filePath);

  return {
    success: true,
    operationId,
    filePath,
    paragraphCount: paragraphs.length,
  };
}

/**
 * Append paragraphs to an existing Word document.
 * Reads current content, appends new text, writes back.
 */
export async function appendToWordDocument(filePath, content) {
  rejectIfBlocked(filePath);

  const operationId = crypto.randomUUID();

  // Read existing text
  const mammoth = await import('mammoth');
  const existingBuffer = await fs.readFile(filePath);
  const { value: existingText } = await mammoth.extractRawText({ buffer: existingBuffer });

  // Combine existing + new content and rewrite
  const combinedContent = existingText + '\n\n' + content;
  
  const docxModule = await import('docx');
  const { Document, Packer, Paragraph, TextRun } = docxModule;

  const paragraphs = combinedContent.split('\n').map(line =>
    new Paragraph({
      children: [new TextRun({ text: line, size: 24 })],
      spacing: { after: 100 },
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(filePath, buffer);

  await logOperation(operationId, 'append_word', filePath, filePath);

  return {
    success: true,
    operationId,
    filePath,
    appendedLength: content.length,
  };
}
