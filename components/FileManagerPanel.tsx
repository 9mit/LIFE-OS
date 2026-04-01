import React, { useState, useEffect } from 'react';
import { Bot, Terminal, FileText, Search, Loader2, HardDrive, CheckCircle2, ChevronDown, ChevronRight, CheckSquare, Square, Trash2, FolderOutput, RotateCcw, Sparkles } from 'lucide-react';
import { parseQuery, executeScan, executeAction, executeSemanticSearch, undoAction, fetchScanInsight, ParseResponse, ScanResponse, FileMetadata } from '../utils/fileManagerApi';

export const FileManagerPanel: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parsedIntent, setParsedIntent] = useState<ParseResponse | null>(null);
  const [scanResults, setScanResults] = useState<ScanResponse | null>(null);
  const [scanInsight, setScanInsight] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showJson, setShowJson] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionMessage, setExecutionMessage] = useState<string>('');
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);

  const toggleSelection = (filePath: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(filePath)) {
      newSelection.delete(filePath);
    } else {
      newSelection.add(filePath);
    }
    setSelectedFiles(newSelection);
  };

  const toggleAll = () => {
    if (!scanResults) return;
    if (selectedFiles.size === scanResults.files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(scanResults.files.map(f => f.path)));
    }
  };

  const handleExecute = async () => {
    if (!parsedIntent || selectedFiles.size === 0) return;

    // Determine the underlying intent (suggest_cleanup -> delete, organize -> move)
    let actionType: 'delete' | 'move' | null = null;
    if (parsedIntent.action === 'delete' || parsedIntent.action === 'suggest_cleanup') {
      actionType = 'delete';
    } else if (parsedIntent.action === 'organize') {
      actionType = 'move';
    }

    if (!actionType) return;

    setIsExecuting(true);
    setErrorMsg('');
    setExecutionMessage('');
    setLastOperationId(null);

    try {
      const response = await executeAction({
        action: actionType,
        filePaths: Array.from(selectedFiles),
        destinationDir: parsedIntent.directory,
        organizeBy: parsedIntent.organizeBy
      });

      const successCount = response.results.filter(r => r.success).length;
      setExecutionMessage(`Successfully executed action on ${successCount} files.`);
      setLastOperationId(response.operationId);

      // Remove successfully processed files from the current UI results
      if (scanResults) {
        const successfulPaths = new Set(response.results.filter(r => r.success).map(r => r.filePath));
        const remainingFiles = scanResults.files.filter(f => !successfulPaths.has(f.path));
        setScanResults({
          ...scanResults,
          files: remainingFiles
        });
        setSelectedFiles(new Set());
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to execute file operations.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUndo = async () => {
    if (!lastOperationId) return;

    setIsUndoing(true);
    setErrorMsg('');

    try {
      await undoAction(lastOperationId);
      setExecutionMessage('');
      setLastOperationId(null);

      // For a robust UI, we should rescan the directory so the files reappear, 
      // but for this MVP, we just trigger a generic success message.
      if (parsedIntent?.directory) {
        const results = await executeScan(parsedIntent.directory, parsedIntent.filter);
        setScanResults(results);
        setSelectedFiles(new Set());
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to undo the previous action.");
    } finally {
      setIsUndoing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsProcessing(true);
    setErrorMsg('');
    setParsedIntent(null);
    setScanResults(null);
    setScanInsight(null);
    setShowJson(true);

    try {
      // 1. Natural Language -> JSON Intent
      const intent = await parseQuery(prompt);
      setParsedIntent(intent);

      // 2. Validate intention before scanning
      const validActions = ['scan', 'organize', 'suggest_cleanup', 'delete'];
      if (!validActions.includes(intent.action)) {
        throw new Error(`Unsupported action in MVP: ${intent.action}.`);
      }

      if (!intent.directory) {
        throw new Error('LLM could not determine a target directory from your prompt.');
      }

      if (intent.directory === 'auto') {
        setExecutionMessage('Scanning locations:\n• Desktop\n• Documents\n• Downloads');
      } else {
        setExecutionMessage(`Scanning location:\n• ${intent.directory}`);
      }

      // 3. JSON Intent -> File System Scan
      const results = await executeScan(intent.directory, intent.query, intent.filter, intent.cleanupType, intent.timeFilter, intent.scanDepth);

      if (intent.directory === 'auto') {
        setExecutionMessage('');
      }

      setScanResults(results);

      // Auto-select files when a new scan completes for an action intent
      if (intent.action === 'delete') {
        // Auto-select all files if it's a generic delete command like "Delete all txt files"
        setSelectedFiles(new Set(results.files.map(f => f.path)));
      } else if (intent.action === 'suggest_cleanup') {
        // If it's a smart cleanup, only auto-select the ones flagged as safe options (e.g. copies, large ones)
        setSelectedFiles(new Set(results.files.filter(f => f.isDuplicateOption).map(f => f.path)));
      } else if (intent.action === 'organize') {
        setSelectedFiles(new Set(results.files.map(f => f.path)));
      } else {
        setSelectedFiles(new Set());
      }
      setExecutionMessage('');

      // 4. Generate AI Insight for the scan results
      try {
        if (!results.files || results.files.length === 0) {
            setScanInsight("No files found matching criteria.");
        } else {
            const totalFiles = results.files.length;
            const duplicates = results.files.filter((f: FileMetadata) => f.type === 'duplicate').length;
            const largeFiles = results.files.filter((f: FileMetadata) => f.sizeMB >= 50).length;
            const potentialSavingsMB = results.files
            .filter((f: FileMetadata) => f.isDuplicateOption || f.sizeMB >= 50)
            .reduce((acc: number, f: FileMetadata) => acc + f.sizeMB, 0).toFixed(2);

            const insightRes = await fetchScanInsight({ totalFiles, duplicates, largeFiles, potentialSavingsMB });
            setScanInsight(insightRes.insight);
        }
      } catch (insightErr) {
        console.error("Failed to fetch scan insight:", insightErr);
        setScanInsight("Scan completed. AI insight unavailable due to a connection error.");
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An unexpected error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent relative drop-shadow-sm text-slate-800">
      
      {/* Top Header - Kept subtle, mostly empty like ChatGPT, but indicating the AI context */}
      <div className="p-4 flex items-center justify-between sticky top-0 bg-transparent z-10 transition-all duration-300 pointer-events-none">
        <div className="text-sm font-semibold text-slate-400 tracking-wide flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/50 backdrop-blur border border-white/20 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
           <Bot className="w-5 h-5 text-indigo-400" />
           Local Brain OS
        </div>
        <div className="text-xs bg-emerald-50/80 backdrop-blur text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100/50 flex items-center gap-1.5 font-medium shadow-sm pointer-events-auto">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
           Offline
        </div>
      </div>

      {/* Main Conversation Thread Area */}
      <div className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 space-y-8 overflow-y-auto pb-48">
        
        {/* Storage Insights (Zero State) */}
        {!scanResults && !isProcessing && (
          <div className="space-y-4 mt-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
             <div className="flex flex-col items-center justify-center py-12 text-center opacity-90">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-indigo-100/50">
                   <Bot className="w-10 h-10 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3 font-display">How can I help you manage your files?</h2>
                <p className="text-sm text-slate-500 max-w-md leading-relaxed">Use natural language to find large files, delete duplicates, or organize your downloads securely on your device.</p>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                 <button 
                   onClick={() => setPrompt("Find files larger than 500MB directly")}
                   className="w-full flex items-center gap-4 p-4 bg-white/80 backdrop-blur hover:bg-white border border-slate-200/60 hover:border-purple-300 rounded-3xl transition-all duration-300 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg group text-left"
                 >
                     <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 group-hover:bg-purple-100 transition-all duration-300">
                         <HardDrive className="w-5 h-5" />
                     </div>
                     <div>
                         <p className="text-[15px] font-semibold text-slate-800 group-hover:text-purple-700 transition-colors">Large Files</p>
                         <p className="text-xs text-slate-500 mt-1">Detect files over 500MB</p>
                     </div>
                 </button>
                 <button 
                   onClick={() => setPrompt("Find untouched files older than 6 months")}
                   className="w-full flex items-center gap-4 p-4 bg-white/80 backdrop-blur hover:bg-white border border-slate-200/60 hover:border-amber-300 rounded-3xl transition-all duration-300 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg group text-left"
                 >
                     <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 group-hover:bg-amber-100 transition-all duration-300">
                         <FileText className="w-5 h-5" />
                     </div>
                     <div>
                         <p className="text-[15px] font-semibold text-slate-800 group-hover:text-amber-700 transition-colors">Unused Files</p>
                         <p className="text-xs text-slate-500 mt-1">Inactive for 180+ days</p>
                     </div>
                 </button>
             </div>
          </div>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 text-sm text-rose-700 shadow-sm flex items-center gap-3 animate-fade-in">
             <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
             <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Intent JSON View */}
        {parsedIntent && (
          <div className="space-y-0 border border-slate-200/60 rounded-3xl overflow-hidden bg-white shadow-sm animate-fade-in transition-all">
             <button 
               onClick={() => setShowJson(!showJson)}
               className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-50 transition-colors text-xs font-semibold tracking-wide text-slate-500 border-b border-slate-100"
             >
               <span className="flex items-center gap-2">
                 <Terminal className="w-4 h-4 text-indigo-500" />
                 LLM Parsed Intent Analysis
               </span>
               {showJson ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
             </button>
             
             {showJson && (
               <div className="p-5 text-sm font-mono text-indigo-700 overflow-x-auto whitespace-pre bg-indigo-50/30">
                 {JSON.stringify(parsedIntent, null, 2)}
               </div>
             )}
          </div>
        )}

        {/* Scan Results View */}
        {scanResults && (
           <div className="space-y-5 mt-8 animate-slide-up">
             {/* AI Insight Panel */}
             {scanInsight && (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-100/80 rounded-3xl p-6 mb-8 shadow-sm animate-fade-in">
                    <div className="flex items-center gap-2 mb-4 text-indigo-700 font-bold text-sm tracking-wide">
                       <Sparkles className="w-5 h-5 bg-indigo-100 text-indigo-600 p-0.5 rounded-lg" />
                       AI Insight
                    </div>
                    <p className="text-[15px] text-slate-700 leading-relaxed font-medium">
                       {scanInsight}
                    </p>
                </div>
             )}
             {parsedIntent?.action === 'suggest_cleanup' && parsedIntent?.cleanupType === 'duplicates' && scanResults.files.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-100/80 rounded-3xl p-6 mb-8 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-indigo-700 font-bold text-sm tracking-wide">
                       <Bot className="w-5 h-5 bg-indigo-100 text-indigo-600 p-0.5 rounded-lg" />
                       AI Insight Result
                    </div>
                    <p className="text-[15px] text-slate-700 leading-relaxed font-medium">
                       Found <strong className="text-indigo-900 bg-indigo-100/50 px-1 rounded">{scanResults.files.filter(f => f.type === 'duplicate').length} duplicate files</strong>. 
                       Deleting the suggested copies will free <strong className="text-emerald-700 bg-emerald-50 px-1 rounded">
                         {scanResults.files.filter(f => f.type === 'duplicate')
                                           .reduce((acc, f) => acc + f.sizeMB, 0)
                                           .toFixed(2)} MB
                       </strong> of storage.
                    </p>
                    
                    {scanResults.files.find(f => f.type === 'original') && (
                        <div className="mt-5 p-4 bg-white rounded-2xl flex items-start gap-4 border border-indigo-100/50 shadow-sm transition-all hover:shadow-md">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Original Safely Preserved At:</p>
                                <p className="text-[13px] text-slate-700 font-mono truncate cursor-crosshair font-medium" title={scanResults.files.find(f => f.type === 'original')?.path}>
                                   {scanResults.files.find(f => f.type === 'original')?.path}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
             )}

             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
               <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Search className="w-4 h-4 text-slate-300" />
                  Detected Files
               </span>
               <div className="flex items-center gap-4">
                 <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold tracking-wide">{scanResults.files.length} items</span>
                 {(parsedIntent?.action === 'delete' || parsedIntent?.action === 'suggest_cleanup' || parsedIntent?.action === 'organize') && scanResults.files.length > 0 && (
                   <button onClick={toggleAll} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-all shadow-sm font-semibold text-[13px] hover:shadow-md">
                      {selectedFiles.size === scanResults.files.length ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                      <span>Select All</span>
                   </button>
                 )}
               </div>
             </div>
             
             <div className="text-[13px] text-slate-500 font-mono bg-white p-4 rounded-2xl border border-slate-200/80 break-all shadow-sm">
               <span className="font-bold text-slate-400 mr-3 uppercase tracking-wider text-xs">Target Directory:</span>
               {scanResults.targetDir}
             </div>

              {executionMessage && !scanResults && (
                 <div className="bg-indigo-50 border border-indigo-100/80 rounded-3xl p-6 text-sm text-indigo-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                       <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                       <span className="font-bold text-indigo-900 tracking-wide">Scan in Progress</span>
                    </div>
                    <div className="whitespace-pre-wrap font-mono text-[13px] pl-8 text-indigo-700/80 leading-relaxed">
                       {executionMessage}
                    </div>
                 </div>
              )}

              {/* Enhanced Scanning Status Visibility */}
              {isProcessing && !scanResults && (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-indigo-200 shadow-sm animate-pulse">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-20 animate-ping"></div>
                    <div className="relative flex items-center justify-center w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full shadow-inner">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Scanning Files...</h3>
                  <p className="text-sm text-slate-500 max-w-xs text-center">
                    Analyzing directories to find exactly what you're looking for.
                  </p>
                </div>
              )}

             {scanResults && scanResults.files.length === 0 ? (
               <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
                  <p className="text-[15px] font-medium text-slate-500">
                     {parsedIntent?.directory === 'auto' ? "File not located in allowed directories." : "No files found matching criteria."}
                  </p>
               </div>
             ) : (
               <div className="space-y-3 max-h-[500px] overflow-y-auto pr-3 rounded-2xl">
                 {scanResults.files.map((file, i) => {
                   const isSelected = selectedFiles.has(file.path);
                   const isActionable = parsedIntent?.action !== 'scan';

                   return (
                     <div key={i} className="relative">
                       {/* Line connector indicating duplicate file transparently */}
                       {file.type === 'duplicate' && (
                         <div className="absolute left-6 top-[-10px] w-0.5 h-6 bg-indigo-200 dark:bg-indigo-900 z-0"></div>
                       )}
                       <div 
                         onClick={() => isActionable && toggleSelection(file.path)}
                         className={`flex items-center justify-between p-4 rounded-3xl border transition-all duration-200 group relative z-10 ${isActionable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${
                           isSelected 
                             ? 'bg-indigo-50/80 border-indigo-300 shadow-sm ring-1 ring-indigo-100' 
                             : file.type === 'duplicate' 
                             ? 'bg-slate-50/50 border-slate-200 hover:border-slate-300 ml-6'
                             : 'bg-white border-slate-200 hover:border-slate-300'
                         }`}
                       >
                       <div className="flex items-start sm:items-center gap-4 overflow-hidden">
                         {isActionable && (
                             <div className="shrink-0 mt-1 sm:mt-0">
                               {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600 transition-transform scale-110" /> : <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition-colors" />}
                             </div>
                         )}

                         <FileText className={`w-12 h-12 p-2.5 rounded-2xl shrink-0 transition-all duration-300 ${isSelected ? 'text-indigo-600 bg-indigo-100 shadow-inner' : 'text-slate-500 bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`} />
                         
                         <div className="min-w-0 flex flex-col justify-center">
                           <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                             <p className="text-[15px] text-slate-800 truncate font-bold tracking-tight" title={file.name}>{file.name}</p>
                             {parsedIntent?.action === 'suggest_cleanup' && !file.isDuplicateOption && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold tracking-widest uppercase border border-blue-200/50 shadow-sm">Original</span>
                             )}
                             {parsedIntent?.action === 'suggest_cleanup' && file.isDuplicateOption && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold tracking-widest uppercase border shadow-sm ${
                                  parsedIntent.cleanupType === 'unused' 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                                    : parsedIntent.cleanupType === 'large'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200/50'
                                    : 'bg-rose-50 text-rose-700 border-rose-200/50'
                                }`}>
                                  {parsedIntent.cleanupType === 'unused' ? 'Unused' : parsedIntent.cleanupType === 'large' ? 'Large File' : 'Suggestion'}
                                </span>
                             )}
                           </div>
                           <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                               <p className="text-[12px] text-slate-500 font-medium flex items-center gap-1.5">
                                 <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                 {new Date(file.modified).toLocaleDateString()}
                               </p>
                               <p className="text-[12px] text-slate-400 font-mono break-all whitespace-normal tracking-tight">
                                 <span className="text-slate-300 mr-1.5 uppercase font-sans font-bold text-[10px]">DIR:</span>
                                 <span className="text-slate-500">{file.path}</span>
                               </p>
                           </div>
                         </div>
                       </div>
                       
                       {file.sizeMB > 0 && (
                           <div className="shrink-0 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-sm ml-2 group-hover:bg-white transition-colors">
                              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[13px] font-bold text-slate-600">{file.sizeMB} MB</span>
                           </div>
                       )}
                     </div>
                     </div>
                   );
                 })}
               </div>
             )}

             {/* Action / Execution Bar */}
             {(parsedIntent?.action === 'delete' || parsedIntent?.action === 'suggest_cleanup' || parsedIntent?.action === 'organize') && scanResults.files.length > 0 && (
                <div className="pt-8 mt-6 border-t border-slate-200/60 space-y-4">
                   {executionMessage && (
                      <div className="bg-emerald-50/80 backdrop-blur border border-emerald-200 rounded-2xl p-5 text-[15px] font-semibold text-emerald-800 flex items-center gap-3 shadow-sm animate-fade-in">
                         <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                         {executionMessage}
                      </div>
                   )}
                   
                   <button
                      onClick={handleExecute}
                      disabled={isExecuting || selectedFiles.size === 0}
                      className={`w-full flex justify-center items-center gap-3 px-6 py-4 rounded-2xl font-bold text-[16px] text-white transition-all duration-300 shadow-xl
                        ${selectedFiles.size === 0 
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                          : parsedIntent.action === 'organize' 
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-1' 
                            : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30 hover:shadow-rose-500/40 hover:-translate-y-1'
                        }
                      `}
                   >
                     {isExecuting ? (
                       <><Loader2 className="w-5 h-5 animate-spin" /> Executing Action...</>
                     ) : parsedIntent.action === 'organize' ? (
                       <><FolderOutput className="w-5 h-5" /> Organize {selectedFiles.size} Files</>
                     ) : (
                       <><Trash2 className="w-5 h-5" /> Move {selectedFiles.size} Files to Trash</>
                     )}
                   </button>
                   <p className="text-[12px] font-semibold tracking-wide flex items-center justify-center text-slate-400 px-4">
                     Requires explicit confirmation. Files are non-destructively moved to the `.trash` directory.
                   </p>
                </div>
             )}
           </div>
        )}

      </div>

      {/* Floating Chat Input Footer */}
      <div className="absolute bottom-0 inset-x-0 p-4 md:p-8 bg-gradient-to-t from-transparent via-white/80 to-white/95 pt-20 pointer-events-none">
        <div className="max-w-3xl mx-auto shadow-[0_15px_50px_-12px_rgba(0,0,0,0.15)] rounded-[2rem] bg-white border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-200 transition-all duration-300 pointer-events-auto group hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)]">
          <form onSubmit={handleSubmit} className="relative flex items-end">
             <textarea
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               placeholder="Chat with Local Brain OS to find, organize, or clean your files..."
               className="w-full bg-transparent p-5 md:p-6 min-h-[70px] max-h-[250px] text-[16px] focus:outline-none resize-none placeholder:text-slate-400 text-slate-800 font-medium leading-relaxed"
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   handleSubmit(e);
                 }
               }}
               onInput={(e) => {
                 const target = e.target as HTMLTextAreaElement;
                 target.style.height = 'auto';
                 target.style.height = `${Math.min(target.scrollHeight, 250)}px`;
               }}
             />
             <div className="p-3 md:p-4 shrink-0">
                 <button 
                   type="submit" 
                   disabled={isProcessing || !prompt.trim()}
                   className="p-3.5 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-slate-900 transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg disabled:shadow-none hover:-translate-y-0.5"
                 >
                   {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
                 </button>
             </div>
          </form>
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-5 pb-2 font-semibold tracking-wider uppercase opacity-80">
           Local Brain OS runs fully offline. Your file contents are never read or uploaded.
        </p>
      </div>
    </div>
  );
};
