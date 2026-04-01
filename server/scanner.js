import fs from 'fs/promises';
import path from 'path';

let globalFileCache = [];
export let isCacheReady = false;

export async function buildCache(directories) {
    console.log(`[Cache] Building search index for ${directories.length} directories...`);
    let newCache = [];
    for (const dir of directories) {
        try {
            // Unbounded scan for cache (high depth/files)
            const files = await scanDirectory(dir, null, {}, null, null, 10, 50000);
            newCache.push(...files);
        } catch (e) {
            // Silently ignore folder errors during cache build
        }
    }
    globalFileCache = newCache;
    isCacheReady = true;
    console.log(`[Cache] Index ready. Tracking ${globalFileCache.length} files.`);
}

export function searchCache(query, filter = {}, cleanupType = null, timeFilter = null) {
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    
    let maxDiffMs = Infinity;
    if (timeFilter === 'today') maxDiffMs = msInDay;
    else if (timeFilter === 'week') maxDiffMs = msInDay * 7;
    else if (timeFilter === 'month') maxDiffMs = msInDay * 30;
    else if (timeFilter === 'year') maxDiffMs = msInDay * 365;

    let result = [];
    
    for (const file of globalFileCache) {
        const sizeMB = file.sizeMB;
        
        if (filter.sizeMB && sizeMB < filter.sizeMB) continue;
        
        // Fuzzy Matching via Levenshtein OR Substring
        if (query) {
            const qStr = query.toLowerCase();
            const fStr = file.name.toLowerCase();
            const isExactSubstring = fStr.includes(qStr);
            
            if (!isExactSubstring) {
                const distance = levenshteinDistance(qStr, fStr);
                const threshold = qStr.length <= 5 ? 1 : 2;
                if (distance > threshold) {
                    continue;
                }
            }
        }
        
        if (filter.extension) {
            const ext = path.extname(file.name).toLowerCase();
            const filterExt = filter.extension.startsWith('.') ? filter.extension : `.${filter.extension}`;
            if (ext !== filterExt.toLowerCase()) continue;
        }
        
        if (timeFilter) {
            const diffMs = now - file.modified.getTime();
            if (diffMs > maxDiffMs) continue;
        }
        
        result.push(file);
    }
    
    result.sort((a, b) => b.sizeMB - a.sizeMB);

    // Apply Cleanup intents natively on the cache
    if (cleanupType === 'duplicates') {
         const sizeMap = new Map();
         for (const f of result) {
             if (!sizeMap.has(f.exactBytes)) sizeMap.set(f.exactBytes, []);
             sizeMap.get(f.exactBytes).push(f);
         }
         const duplicateCandidates = [];
         for (const [bytes, files] of sizeMap.entries()) {
             if (files.length > 1) {
                 const nameGroups = new Map();
                 for (const f of files) {
                    const ext = path.extname(f.name);
                    const base = path.basename(f.name, ext);
                    const normalizedBase = base.replace(/(\s*\(\d+\)|\s*copy\d*|_\d+)$/i, '').trim().toLowerCase();
                    if (!nameGroups.has(normalizedBase)) nameGroups.set(normalizedBase, []);
                    nameGroups.get(normalizedBase).push(f);
                 }
                 for (const [normName, groupFiles] of nameGroups.entries()) {
                     if (groupFiles.length > 1) {
                         groupFiles.sort((a, b) => a.modified - b.modified);
                         for (let i = 0; i < groupFiles.length; i++) {
                             groupFiles[i].type = i === 0 ? 'original' : 'duplicate';
                             groupFiles[i].isDuplicateOption = (i > 0);
                         }
                         duplicateCandidates.push(...groupFiles);
                     }
                 }
             }
         }
         return duplicateCandidates;
    }

    if (cleanupType === 'large') {
        return result.filter(f => f.sizeMB >= 50).map(f => ({ ...f, isDuplicateOption: true }));
    }

    if (cleanupType === 'unused') {
        const msIn180Days = 180 * 24 * 60 * 60 * 1000;
        return result.filter(f => {
            const diffMs = now - f.modified.getTime();
            return diffMs > msIn180Days;
        }).map(f => ({ ...f, isDuplicateOption: true }));
    }

    return result;
}

/**
 * Calculates the Levenshtein edit distance between two strings.
 */
function levenshteinDistance(s, t) {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= t.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= s.length; j++) {
            arr[i][j] = i === 0 ? j : Math.min(
                arr[i - 1][j] + 1,
                arr[i][j - 1] + 1,
                arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
            );
        }
    }
    return arr[t.length][s.length];
}

/**
 * Scans a directory and returns an array of file metadata.
 * Uses a recursive approach with maxDepth and maxFiles safeguards to prevent resource exhaustion.
 */
export async function scanDirectory(dir, query = null, filter = {}, cleanupType = null, timeFilter = null, maxDepth = 5, maxFiles = 10000) {
  try {
    let result = [];
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    
    let maxDiffMs = Infinity;
    if (timeFilter === 'today') maxDiffMs = msInDay;
    else if (timeFilter === 'week') maxDiffMs = msInDay * 7;
    else if (timeFilter === 'month') maxDiffMs = msInDay * 30;
    else if (timeFilter === 'year') maxDiffMs = msInDay * 365;

    async function scanRecursive(currentDir, currentDepth) {
        if (currentDepth > maxDepth) return;
        if (result.length >= maxFiles) return;

        try {
            const files = await fs.readdir(currentDir, { withFileTypes: true });
            
            for (const file of files) {
                if (result.length >= maxFiles) break;
                const filePath = path.join(currentDir, file.name);

                if (file.isDirectory()) {
                    if (currentDepth < maxDepth) {
                        await scanRecursive(filePath, currentDepth + 1);
                    }
                } else {
                    try {
                        const stats = await fs.stat(filePath);
                        const sizeMB = parseFloat((stats.size / 1024 / 1024).toFixed(2));
                        
                        // Filters
                        if (filter.sizeMB && sizeMB < filter.sizeMB) continue;
                        
                        // Fuzzy Matching via Levenshtein OR Substring
                        if (query) {
                            const qStr = query.toLowerCase();
                            const fStr = file.name.toLowerCase();
                            const isExactSubstring = fStr.includes(qStr);
                            
                            // If it's not a substring, check the edit distance (threshold: 2-3 typos depending on length)
                            if (!isExactSubstring) {
                                const distance = levenshteinDistance(qStr, fStr);
                                const threshold = qStr.length <= 5 ? 1 : 2;
                                if (distance > threshold) {
                                    continue;
                                }
                            }
                        }
                        
                        if (filter.extension) {
                            const ext = path.extname(file.name).toLowerCase();
                            const filterExt = filter.extension.startsWith('.') ? filter.extension : `.${filter.extension}`;
                            if (ext !== filterExt.toLowerCase()) continue;
                        }
                        
                        // Temporal Filter (Recent Activity Awareness)
                        if (timeFilter) {
                            const diffMs = now - stats.mtime.getTime();
                            if (diffMs > maxDiffMs) continue;
                        }

                        result.push({
                            name: file.name,
                            path: filePath,
                            sizeMB: sizeMB,
                            modified: stats.mtime,
                            exactBytes: stats.size
                        });
                    } catch (statErr) {
                        // Silently ignore files we cannot stat (permissions, etc.)
                    }
                }
            }
        } catch (dirErr) {
             // Silently ignore directories we cannot read (permissions, etc.)
        }
    }

    await scanRecursive(dir, 0);
    
    // Sort by size descending by default for better UX
    result.sort((a, b) => b.sizeMB - a.sizeMB);

    // --- Suggest Cleanup Intent: Duplicates ---
    if (cleanupType === 'duplicates') {
        const sizeMap = new Map();
        
        // Group files by exact byte size
        for (const f of result) {
            if (!sizeMap.has(f.exactBytes)) {
                sizeMap.set(f.exactBytes, []);
            }
            sizeMap.get(f.exactBytes).push(f);
        }

        const duplicateCandidates = [];
        
        for (const [bytes, files] of sizeMap.entries()) {
            if (files.length > 1) {
                // We have multiple files with the EXACT same byte size. Let's further check names.
                // Normalize names: remove ' (1)', ' copy', '[1]' etc before comparing
                const nameGroups = new Map();
                
                for (const f of files) {
                   const ext = path.extname(f.name);
                   const base = path.basename(f.name, ext);
                   
                   // Regex removes common copy suffixes e.g: "report (1)", "report copy", "report_copy_3"
                   const normalizedBase = base.replace(/(\s*\(\d+\)|\s*copy\d*|_\d+)$/i, '').trim().toLowerCase();
                   
                   if (!nameGroups.has(normalizedBase)) {
                       nameGroups.set(normalizedBase, []);
                   }
                   nameGroups.get(normalizedBase).push(f);
                }
                
                // If a normalized name group has more than 1 file, it's a very likely duplicate
                for (const [normName, groupFiles] of nameGroups.entries()) {
                    if (groupFiles.length > 1) {
                        // Sort by modification date (oldest first is usually the "original")
                        groupFiles.sort((a, b) => a.modified - b.modified);
                        
                        // Mark all EXCPET the oldest as "duplicate options" for the UI frontend
                        // The oldest file stays false so we don't accidentally check it for deletion
                        for (let i = 0; i < groupFiles.length; i++) {
                            groupFiles[i].type = i === 0 ? 'original' : 'duplicate';
                            groupFiles[i].isDuplicateOption = (i > 0);
                        }
                        
                        duplicateCandidates.push(...groupFiles);
                    }
                }
            }
        }
        
        // Return only the isolated duplicates grouped together for cleanup intent
        return duplicateCandidates;
    }

    // --- Suggest Cleanup Intent: Large Files ---
    if (cleanupType === 'large') {
        // Find files > 50MB
        return result.filter(f => f.sizeMB >= 50).map(f => ({
             ...f,
             isDuplicateOption: true // Re-using checkbox flag to pre-select large files
        }));
    }

    // --- Suggest Cleanup Intent: Unused Files ---
    if (cleanupType === 'unused') {
        const msIn180Days = 180 * 24 * 60 * 60 * 1000;
        return result.filter(f => {
            const diffMs = now - f.modified.getTime();
            return diffMs > msIn180Days;
        }).map(f => ({
             ...f,
             isDuplicateOption: true // Re-using checkbox flag to pre-select unused files
        }));
    }

    return result;
  } catch (error) {
    console.error("Error scanning directory:", error);
    throw error;
  }
}
