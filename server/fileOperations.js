import fs from 'fs/promises';
import path from 'path';

import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { isSafeDirectoryLegacy as isSafePath } from './securityPolicy.js';


async function robustMove(sourcePath, destPath) {
    try {
        // Fast path: same device
        await fs.rename(sourcePath, destPath);
    } catch (err) {
        if (err.code === 'EXDEV') {
            // Slow path: cross device (e.g., C:\ to N:\)
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
 * Moves a file from source to a destination directory.
 * If the destination directory doesn't exist, it is created.
 */
export async function moveFile(sourcePath, destinationDir) {
    if (!isSafePath(sourcePath) || !isSafePath(destinationDir)) {
        throw new Error(`Path failed safety checks: ${sourcePath} -> ${destinationDir}`);
    }

    try {
        await fs.access(sourcePath); // Ensure source exists
        
        // Ensure destination dir exists
        await fs.mkdir(destinationDir, { recursive: true });
        
        const fileName = path.basename(sourcePath);
        const destPath = path.join(destinationDir, fileName);
        
        await robustMove(sourcePath, destPath);
        
        return { success: true, path: destPath };
    } catch (error) {
        console.error(`Failed to move file ${sourcePath}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Safe Soft Delete: Moves a file to LifeOS/.trash instead of permanently deleting it.
 */
export async function softDeleteFile(sourcePath, baseDir) {
    if (!isSafePath(sourcePath)) {
         throw new Error(`Path failed safety checks: ${sourcePath}`);
    }

    try {
        await fs.access(sourcePath);
        
        const trashDir = path.join(baseDir, '.trash');
        await fs.mkdir(trashDir, { recursive: true });
        
        const fileName = path.basename(sourcePath);
        // Create a unique subfolder per trash operation to prevent name collisions
        // while keeping the ACTUAL filename exactly identical.
        const operationTrashDir = path.join(trashDir, `${Date.now()}_${Math.floor(Math.random() * 1000)}`);
        await fs.mkdir(operationTrashDir, { recursive: true });
        
        const destPath = path.join(operationTrashDir, fileName);
        
        await robustMove(sourcePath, destPath);
        
        return { success: true, path: destPath };
    } catch (error) {
        console.error(`Failed to soft-delete file ${sourcePath}:`, error);
        return { success: false, error: error.message };
    }
}
