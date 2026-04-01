/**
 * Parses a natural language instruction into a JSON object using local Ollama instance.
 */
export async function parseIntent(promptText) {
  const systemPrompt = `You are a strict file system intent parser.
Convert the user instruction into JSON. Returning ONLY valid JSON.
Do not wrap it in markdown block quotes (e.g. \`\`\`json). Just output the raw JSON string.

Allowed actions: "scan", "organize", "delete", "suggest_cleanup"
Allowed organizeBy values (only for "organize" action): "month", "year", "extension", "size"
Allowed cleanupType values (only for "suggest_cleanup" action): "duplicates", "large", "unused"

CRITICAL TARGET DIRECTORY RULES:
1. If the user specifies a directory (e.g. "Downloads", "Documents", "Desktop"), set "directory" to that path.
2. If the user DOES NOT specify a directory (e.g. "Where is the file named antigravity located?", "Find my resume"), YOU MUST output EXACTLY: "directory": "auto".

CRITICAL QUERY RULES:
1. If the user is searching for a specific file by name, extract that name into the "query" field.
2. YOU MUST STRIP all conversational filler words from the extracted query. For example, remove words like "file", "named", "called", "the", "a". If the user asks "Where is the file named antigravity located?", the query MUST be EXACTLY "antigravity", NOT "file named antigravity".

CRITICAL TIME AWARENESS RULES:
1. If the user asks for files modified recently, output a "timeFilter".
2. Allowed "timeFilter" values: "today", "week", "month", "year".

CRITICAL DEPTH RULES:
1. If the user specifically asks to ONLY look in the current folder, or NOT to look in subfolders, or specifically asks for "single files" in a folder (implying no subdirectories), output "scanDepth": 0.
2. Otherwise, do not output "scanDepth".

Example 1:
User: "Organize my Downloads folder by month"
Output:
{
 "action": "organize",
 "directory": "~/Downloads",
 "organizeBy": "month"
}

Example 2:
User: "Find duplicate photos on my Desktop"
Output:
{
 "action": "suggest_cleanup",
 "directory": "~/Desktop",
 "cleanupType": "duplicates",
 "filter": {
   "extension": "jpg"
 }
}

Example 3:
User: "Suggest large files to delete in Documents"
Output:
{
 "action": "suggest_cleanup",
 "directory": "~/Documents",
 "cleanupType": "large"
}

Example 4:
User: "Where is the file named antigravity located?"
Output:
{
 "action": "scan",
 "query": "antigravity",
 "directory": "auto"
}

Example 4b:
User: "Find single files in N:\\merefiles but don't check folders"
Output:
{
 "action": "scan",
 "directory": "N:\\merefiles",
 "scanDepth": 0
}

Example 5:
User: "Show files I downloaded this week"
Output:
{
 "action": "scan",
 "directory": "~/Downloads",
 "timeFilter": "week"
}

Example 6:
User: "Find unused files on my Desktop that I haven't opened in a long time"
Output:
{
 "action": "suggest_cleanup",
 "directory": "~/Desktop",
 "cleanupType": "unused"
}

Return ONLY valid JSON.

User instruction:
"${promptText}"`;

    // --- Standard LLM Parsing for Metadata ---
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "phi3",
                prompt: systemPrompt,
                stream: false,
                format: "json"
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (!response.ok) {
           const errText = await response.text();
           console.error(`Ollama Error HTTP ${response.status}: ${errText}`);
           throw new Error("Failed to connect to Ollama. Please ensure it is running.");
        }
        
        const data = await response.json();
        const textOutput = data.response.trim();
        
        let parsedParams;
        try {
            parsedParams = JSON.parse(textOutput);
        } catch(e) {
            console.error("Failed to parse Ollama output as JSON. Output was:", textOutput);
            throw new Error("Invalid output format from LLM.");
        }
        return parsedParams;
    } catch (err) {
        console.error("LLM Error:", err);
        if (err.message && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED'))) {
            throw new Error("Local AI (Ollama) is offline or unreachable. Please ensure Ollama is running on port 11434.");
        }
        throw err;
    }
}

/**
 * Parses a natural language OS assistant command into a structured JSON task.
 * Used by the taskExecutor module.  The LLM only classifies — it never executes.
 */
export async function parseAssistantIntent(promptText) {
  const systemPrompt = `You are a strict OS assistant intent parser.
Convert the user instruction into a JSON task object. Return ONLY valid JSON.
Do not wrap it in markdown block quotes. Just output the raw JSON string.

Allowed actions:
- "create_file"    → Create a new text file.       Fields: fileName, directory, content
- "write_file"     → Overwrite a file.              Fields: filePath OR (fileName + directory), content
- "append_file"    → Append to a file.              Fields: filePath OR (fileName + directory), content
- "read_file"      → Read file contents.            Fields: filePath OR (fileName + directory)
- "list_directory" → List folder contents.          Fields: directory
- "file_info"      → Get file details.              Fields: filePath OR (fileName + directory)
- "create_excel"   → Create spreadsheet.            Fields: fileName, directory, data (array of row objects), sheetsData (optional)
- "edit_excel"     → Edit a cell.                   Fields: filePath OR (fileName + directory), sheet, cell, value
- "read_excel"     → Read spreadsheet.              Fields: filePath OR (fileName + directory)
- "create_word"    → Create Word document.          Fields: fileName, directory, content
- "append_word"    → Append to Word doc.            Fields: filePath OR (fileName + directory), content
- "read_word"      → Read Word document.            Fields: filePath OR (fileName + directory)

DIRECTORY RULES:
- If user says "Desktop", output "directory": "Desktop"
- If user says "Documents", output "directory": "Documents"
- If user says "Downloads", output "directory": "Downloads"
- If no directory is mentioned, default to "directory": "Desktop"

FILENAME RULES:
- Always include appropriate file extension (.txt, .xlsx, .docx, etc.)
- Clean up the filename to be filesystem-safe (no special chars except - and _)

CONTENT RULES:
- For create_excel, generate the "data" field as an array of row objects matching the user's description.
  Example: [{"Date": "", "Item": "", "Amount": 0}]
- For create_word and create_file, put the text in the "content" field.
- If user wants specific content, include it. If they just want a blank template, use minimal defaults.

Example 1:
User: "Create a file called notes.txt on my Desktop with the text Hello World"
Output:
{
  "action": "create_file",
  "fileName": "notes.txt",
  "directory": "Desktop",
  "content": "Hello World"
}

Example 2:
User: "Create a budget spreadsheet in Documents with columns Date, Item, Amount"
Output:
{
  "action": "create_excel",
  "fileName": "budget.xlsx",
  "directory": "Documents",
  "data": [{"Date": "", "Item": "", "Amount": 0}]
}

Example 3:
User: "What's in my Downloads folder?"
Output:
{
  "action": "list_directory",
  "directory": "Downloads"
}

Example 4:
User: "Write a letter to my landlord about rent increase"
Output:
{
  "action": "create_word",
  "fileName": "letter-to-landlord.docx",
  "directory": "Documents",
  "content": "Dear Landlord,\\n\\nI am writing to discuss the recent rent increase.\\n\\nI would like to request a meeting to discuss this matter further.\\n\\nSincerely,\\n[Your Name]"
}

Example 5:
User: "Read the file report.txt from my Desktop"
Output:
{
  "action": "read_file",
  "fileName": "report.txt",
  "directory": "Desktop"
}

Return ONLY valid JSON.

User instruction:
"${promptText}"`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "phi3",
                prompt: systemPrompt,
                stream: false,
                format: "json",
                options: {
                    temperature: 0.1,      // Low temp for more deterministic parsing
                    num_predict: 512,       // Limit token output for speed
                }
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Ollama Assistant Parse Error HTTP ${response.status}: ${errText}`);
            throw new Error("Failed to connect to Ollama for assistant parsing.");
        }

        const data = await response.json();
        const textOutput = data.response.trim();

        let parsed;
        try {
            parsed = JSON.parse(textOutput);
        } catch (e) {
            console.error("Failed to parse Ollama assistant output as JSON. Output was:", textOutput);
            throw new Error("Invalid output format from LLM.");
        }
        return parsed;
    } catch (err) {
        console.error("LLM Assistant Parse Error:", err);
        if (err.message && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED'))) {
            throw new Error("Local AI (Ollama) is offline or unreachable. Please ensure Ollama is running on port 11434.");
        }
        throw err;
    }
}

/**
 * Generates a conversational response for the Chat Assistant using Ollama.
 */
export async function generateChatResponse(messages) {
    try {
         const controller = new AbortController();
         const timeout = setTimeout(() => controller.abort(), 60000);
         const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "phi3",
                messages: messages,
                stream: false
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
           throw new Error("Failed to connect to Ollama for chat.");
        }

        const data = await response.json();
        return data.message.content;
    } catch (err) {
        console.error("LLM Chat Error:", err);
        return "I am currently offline or unable to reach my language engine. Please ensure Ollama is running locally.";
    }
}

/**
 * Generates a short 1-2 sentence AI insight describing scan results.
 */
export async function generateScanInsight(scanSummary) {
    const prompt = `You are a helpful file system assistant.
Summarize the following scan results in 1-2 short, encouraging sentences.
Make it sound actionable if there are duplicates or large files.

Total Files: ${scanSummary.totalFiles}
Duplicates: ${scanSummary.duplicates}
Large Files (>50MB): ${scanSummary.largeFiles}
Potential Space Savings: ${scanSummary.potentialSavingsMB} MB

Provide ONLY the sentences. Do not include any other text.`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "phi3",
                prompt: prompt,
                stream: false
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
           throw new Error("Failed to connect to Ollama for insights.");
        }

        const data = await response.json();
        return data.response.trim();
    } catch (err) {
        console.error("LLM Insight Error:", err);
        // Fallback string if Ollama is unavailable
        if (scanSummary.duplicates > 0 || scanSummary.largeFiles > 0) {
            return `${scanSummary.duplicates} duplicate(s) and ${scanSummary.largeFiles} large file(s) detected. Handling them could free ~${scanSummary.potentialSavingsMB} MB.`;
        }
        return `Scan complete! ${scanSummary.totalFiles} files analyzed successfully.`;
    }
}
