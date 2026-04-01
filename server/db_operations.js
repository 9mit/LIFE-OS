import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'operations.db');

// Initialize the SQLite database
let dbInstance = null;

export async function getDb() {
    if (dbInstance) return dbInstance;

    dbInstance = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS operation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation_id TEXT NOT NULL,
            action_type TEXT NOT NULL, -- 'move' or 'trash'
            original_path TEXT NOT NULL,
            new_path TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Add an index for faster lookups by operation_id
    await dbInstance.exec(`
        CREATE INDEX IF NOT EXISTS idx_operation_id ON operation_history(operation_id);
    `);

    return dbInstance;
}

/**
 * Logs a single file operation to the database.
 */
export async function logOperation(operationId, actionType, originalPath, newPath) {
    const db = await getDb();
    await db.run(
        'INSERT INTO operation_history (operation_id, action_type, original_path, new_path) VALUES (?, ?, ?, ?)',
        [operationId, actionType, originalPath, newPath]
    );
}

/**
 * Retrieves all file movements associated with a specific operation ID.
 */
export async function getOperationLogs(operationId) {
    const db = await getDb();
    return db.all(
        'SELECT id, operation_id, action_type, original_path, new_path, timestamp FROM operation_history WHERE operation_id = ? ORDER BY id DESC',
        [operationId]
    );
}

import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

async function robustMove(sourcePath, destPath) {
    try {
        await fs.rename(sourcePath, destPath);
    } catch (err) {
        if (err.code === 'EXDEV') {
            await pipeline(
                createReadStream(sourcePath),
                createWriteStream(destPath)
            );
            await fs.unlink(sourcePath);
        } else {
            throw err;
        }
    }
}

/**
 * Reverses an operation by moving files back to their original locations.
 */
export async function undoOperation(operationId) {
    const logs = await getOperationLogs(operationId);
    if (!logs || logs.length === 0) {
        throw new Error(`No operation history found for ID: ${operationId}`);
    }

    const results = [];
    
    // Process in reverse to ensure sequential safety
    for (const log of logs) {
        try {
            // Revert: move from new_path to original_path
            await robustMove(log.new_path, log.original_path);
            
            // Cleanup empty parent directory if it was a temporary organization/trash folder
            const parentDir = path.dirname(log.new_path);
            try {
                const remaining = await fs.readdir(parentDir);
                if (remaining.length === 0) {
                    await fs.rmdir(parentDir);
                }
            } catch (cleanupErr) {
                // Silently ignore if dir is not empty or can't be deleted
            }

            // Note: We don't delete the log entry, just record success in the returned results
            // In a production system we might mark it as "undone" in the DB.
            results.push({
                originalPath: log.original_path,
                currentPath: log.new_path,
                success: true
            });
        } catch (err) {
            console.error(`Undo failed for ${log.new_path}:`, err);
            results.push({
                originalPath: log.original_path,
                currentPath: log.new_path,
                success: false,
                error: err.message
            });
        }
    }

    return results;
}
