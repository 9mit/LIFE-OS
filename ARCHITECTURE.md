# LifeOS — Architecture Documentation

## Overview

LifeOS is a **fully offline, privacy-first personal intelligence hub** with an integrated **AI-powered OS assistant**. It runs as a React frontend + Node.js backend, using Ollama for local AI inference. The OS assistant can read, write, and create files and Office documents via natural language commands — all within strict security boundaries. Zero data ever leaves the user's machine.

---

## Project Structure

```
LIFE_OS/
├── index.html              # HTML entrypoint with Tailwind config & global styles
├── index.tsx               # React root mount point
├── App.tsx                 # Main application shell, routing, layout
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite dev server configuration
├── tsconfig.json           # TypeScript compiler options
├── metadata.json           # App metadata (name, description)
├── .gitignore              # Git exclusion rules
│
├── components/             # React UI components
│   ├── ChatAssistant.tsx   # Ollama-powered conversational AI chat
│   ├── FileManagerPanel.tsx# Natural language file search & management
│   ├── InsightsDashboard.tsx# Data visualization: charts, graphs, trends
│   ├── KnowledgeGraph.tsx  # 3D force-directed knowledge graph
│   ├── NavBar.tsx          # Sidebar navigation
│   ├── NumericHighlights.tsx# Numeric data summary cards
│   ├── OSAssistantPanel.tsx# [NEW] AI OS assistant panel (command bar, activity feed)
│   ├── ReportsPanel.tsx    # PDF report generation
│   ├── SummaryCards.tsx    # Summary stat cards
│   ├── ThemeToggle.tsx     # Light/dark mode switcher
│   └── UploadPanel.tsx     # File upload & parsing interface
│
├── hooks/                  # Custom React hooks
│   ├── useIndexedDB.ts     # IndexedDB CRUD operations (Dexie wrapper)
│   ├── useLocalStorage.ts  # Typed localStorage persistence
│   ├── useTheme.ts         # Theme detection & application
│   └── useWhisper.ts       # Voice-to-text via Whisper.cpp
│
├── utils/                  # Utility functions
│   ├── analyzeData.ts      # Statistical analysis & summarization engine
│   ├── embeddings.ts       # Text embedding & cosine similarity (Xenova)
│   ├── fileManagerApi.ts   # Frontend API client for file manager endpoints
│   ├── osAssistantApi.ts   # [NEW] Frontend API client for OS assistant + SSE events
│   ├── parseCSV.ts         # CSV file parser (PapaParse)
│   ├── parseExcel.ts       # Excel file parser (xlsx)
│   ├── parseJSON.ts        # JSON file parser
│   ├── parsePDF.ts         # PDF text extraction (pdf.js)
│   ├── parseText.ts        # Plain text parser with embeddings
│   ├── pdfExport.ts        # PDF report generation (jsPDF)
│   ├── utils.ts            # General utility functions
│   ├── whisperWorker.ts    # Web Worker for Whisper inference
│   └── worker.ts           # Web Worker for embedding generation
│
├── server/                 # Node.js/Express backend
│   ├── index.js            # Express API server (routes, middleware, SSE, security)
│   ├── ollama.js           # Ollama LLM integration (parse, chat, insights, assistant intent)
│   ├── scanner.js          # Filesystem scanner with caching & fuzzy search
│   ├── fileOperations.js   # Safe file move & soft-delete operations
│   ├── db_operations.js    # SQLite operation history (undo support)
│   ├── securityPolicy.js   # [NEW] Centralized security enforcement (allow/blocklist)
│   ├── fileAssistant.js    # [NEW] Controlled file read/write engine with backups
│   ├── officeAssistant.js  # [NEW] MS Office document manipulation (Excel/Word)
│   ├── taskExecutor.js     # [NEW] NL → structured action pipeline (hybrid AI)
│   ├── processWatcher.js   # [NEW] Windows application detection service
│   └── operations.db       # [RUNTIME] SQLite database for undo history
│
├── storage/                # Browser-side persistence
│   └── db.ts               # Dexie (IndexedDB) schema definition
│
├── store/                  # State management
│   └── useLifeOSStore.ts   # Zustand store (app state, theme, chat)
│
├── types/                  # TypeScript type definitions
│   └── data.ts             # Core data types (records, sources, messages)
│
├── screenshots/            # README screenshot assets
│   ├── ask-lifeos.png
│   ├── dark-mode.png
│   ├── data-studio.png
│   ├── insight-lab.png
│   └── reports.png
│
├── .trash/                 # [RUNTIME] Soft-deleted files (recoverable)
└── dist/                   # [BUILD] Vite production output
```

---

## Database Files Explained

| File | Type | Purpose | Created By |
|------|------|---------|------------|
| `server/operations.db` | SQLite | Stores file operation history (moves, deletes) so they can be **undone**. Each operation gets a unique `operation_id` that groups batch actions. | `server/db_operations.js` at runtime |
| Browser `lifeos-db` | IndexedDB | Stores uploaded data sources, parsed records (with embeddings), and chat messages. Lives entirely in the browser. | `storage/db.ts` via Dexie |

> **Privacy Note**: Both databases are local-only. No data is transmitted externally.

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (Frontend)                   │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Upload   │  │  Chat        │  │ File Manager      │  │
│  │ Panel    │  │  Assistant   │  │ Panel             │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│       │               │                   │              │
│       ▼               │                   │              │
│  ┌─────────┐          │                   │              │
│  │ Parsers │          │                   │              │
│  │ CSV/JSON│          │                   │              │
│  │ XLS/PDF │          │                   │              │
│  └────┬────┘          │                   │              │
│       │               │                   │              │
│       ▼               │                   │              │
│  ┌─────────────┐      │                   │              │
│  │ IndexedDB   │      │                   │              │
│  │ (lifeos-db) │      │                   │              │
│  └─────────────┘      │                   │              │
│                       │                   │              │
└───────────────────────┼───────────────────┼──────────────┘
                        │                   │
                   POST /api/chat      POST /api/scan
                   POST /api/insights  POST /api/execute
                        │                   │
┌───────────────────────┼───────────────────┼──────────────┐
│                  NODE.JS BACKEND (port 3001)              │
│                       │                   │              │
│  ┌────────────────────▼───┐  ┌────────────▼──────────┐  │
│  │     ollama.js          │  │     scanner.js         │  │
│  │  • parseIntent()       │  │  • scanDirectory()     │  │
│  │  • generateChat()      │  │  • buildCache()        │  │
│  │  • generateInsight()   │  │  • searchCache()       │  │
│  └────────────┬───────────┘  └────────────────────────┘  │
│               │                                          │
│               ▼                                          │
│  ┌────────────────────────┐  ┌────────────────────────┐  │
│  │   Ollama (phi3 model)  │  │   operations.db        │  │
│  │   localhost:11434      │  │   (SQLite undo log)    │  │
│  └────────────────────────┘  └────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Purpose |
|-----------|---------|
| `ChatAssistant` | Ollama-powered chat with full conversation context. Persists to IndexedDB. |
| `FileManagerPanel` | Natural language file search → AI intent parsing → filesystem scan → action execution (move/delete/undo). |
| `OSAssistantPanel` | **[NEW]** AI OS assistant with NL command bar, live activity feed, file/directory preview, app detection toasts, process watcher toggle. |
| `InsightsDashboard` | Renders charts and trend analysis from uploaded data records. |
| `UploadPanel` | Drag-and-drop file upload with automatic parsing and embedding generation. |
| `ReportsPanel` | Generates shareable PDF reports from current insights. |
| `KnowledgeGraph` | Interactive 3D visualization of data relationships. |
| `NavBar` | Left sidebar navigation between all views. |
| `ThemeToggle` | Toggles light/dark mode with system preference detection. |

---

## Security Measures

| Measure | Implementation |
|---------|---------------|
| **Body Size Limit** | `express.json({ limit: '1mb' })` prevents payload bombs |
| **Security Headers** | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection` |
| **Rate Limiting** | 30 req/min per IP on `/api/chat`, `/api/insights`, `/api/assistant/execute` |
| **Request Timeouts** | 60s `AbortController` on all Ollama fetch calls |
| **Path Safety** | Centralized `securityPolicy.js` — allow-list (Desktop/Documents/Downloads) + block-list (system dirs, dangerous extensions, protected files) |
| **File Type Blocklist** | `.exe`, `.dll`, `.sys`, `.bat`, `.cmd`, `.ps1`, `.reg`, `.msi`, `.vbs`, `.com`, `.scr`, `.lnk`, and more |
| **File Size Limit** | 500 KB max per file for AI read/write operations |
| **Automatic Backups** | Files are backed up before any destructive write via `fileAssistant.js` |
| **Soft Deletes** | Files go to `.trash/` — never permanently deleted |
| **Undo Support** | All file operations logged to SQLite with full rollback capability |
| **Air-Gapped** | Zero external network requests — all AI runs via local Ollama on `127.0.0.1:11434` |

---

## Privacy-by-Design Principles

1. **Zero Cloud Dependencies** — All AI inference via local Ollama (`127.0.0.1:11434`)
2. **No Telemetry** — No analytics, tracking, or external API calls
3. **User-Controlled Persistence** — Chat history stored in browser IndexedDB, permanently deletable via "New Chat"
4. **Local-Only Databases** — SQLite operations log and IndexedDB never leave the machine
5. **Safe Deletion** — `.trash/` directory for recoverable soft-deletes
6. **Minimal Data Retention** — No user data stored beyond what the user explicitly uploads

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (frontend on port 3000) |
| `npm run build` | Production build to `dist/` |
| `npm run server` | Start Express backend (API on port 3001) |
| `npm run preview` | Preview production build locally |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 19 + TypeScript |
| Styling | Tailwind CSS (CDN in dev) |
| State Management | Zustand |
| Browser Storage | Dexie (IndexedDB) |
| Charts | Chart.js + react-chartjs-2 |
| 3D Visualization | force-graph / react-force-graph-3d |
| PDF Export | jsPDF + html2canvas |
| Backend | Node.js + Express 5 |
| AI/LLM | Ollama (phi3 model) |
| Audio Transcription | Xenova/transformers (Whisper) |
| Text Embeddings | Xenova/transformers |
| File Parsing | PapaParse (CSV), xlsx, pdf.js |
| Office Documents | docx (Word creation), mammoth (Word reading), xlsx (Excel) |
| Operation History | SQLite (via `sqlite3`) |
| Real-time Events | Server-Sent Events (SSE) |

---

## OS Assistant Architecture

### Hybrid Intelligence Model

```
┌──────────────────────────────────────────────────────────┐
│                  USER (Natural Language)                  │
│          "Create a budget spreadsheet in Documents"       │
└────────────────────────┬─────────────────────────────────┘
                         │
                    POST /api/assistant/execute
                         │
┌────────────────────────▼─────────────────────────────────┐
│           OLLAMA (phi3) — Intent Classification           │
│                                                           │
│  Input:  NL prompt + structured system prompt             │
│  Output: JSON intent (action, fileName, directory, etc.)  │
│  Role:   Classification ONLY — never executes anything    │
│  Temp:   0.1 (near-deterministic)                         │
│  Tokens: 512 max output                                   │
└────────────────────────┬─────────────────────────────────┘
                         │ Structured JSON
┌────────────────────────▼─────────────────────────────────┐
│           TASK EXECUTOR (taskExecutor.js)                  │
│                                                           │
│  Deterministic routing: maps JSON action → handler fn     │
│  12 supported actions: create_file, write_file,           │
│    append_file, read_file, list_directory, file_info,     │
│    create_excel, edit_excel, read_excel,                   │
│    create_word, append_word, read_word                     │
└──────┬──────────┬──────────────┬─────────────────────────┘
       │          │              │
       ▼          ▼              ▼
 ┌──────────┐ ┌──────────┐ ┌──────────────┐
 │ fileAs-  │ │ officeAs-│ │ security-    │
 │ sistant  │ │ sistant  │ │ Policy       │
 │ .js      │ │ .js      │ │ .js          │
 │          │ │          │ │              │
 │ read     │ │ Excel:   │ │ Allow-list   │
 │ write    │ │  create  │ │ Block-list   │
 │ append   │ │  edit    │ │ File types   │
 │ create   │ │  read    │ │ Protected    │
 │ dir list │ │ Word:    │ │  files       │
 │ file info│ │  create  │ │              │
 │          │ │  append  │ │ ALL checks   │
 │ +backup  │ │  read    │ │ centralized  │
 │ +undo    │ │          │ │ here         │
 └──────────┘ └──────────┘ └──────────────┘
```

### Security Sandbox

| Layer | Enforcement |
|-------|------------|
| **Allowed Directories** | Desktop, Documents, Downloads (configurable) |
| **Blocked Directories** | Windows, System32, Program Files, AppData, .ssh, .gnupg, .git, node_modules, boot, recovery, $Recycle.Bin, EFI |
| **Blocked Extensions** | .exe, .dll, .sys, .bat, .cmd, .ps1, .reg, .msi, .vbs, .com, .scr, .lnk, .cpl, .inf, .drv, .ocx, .pif, .hta |
| **Protected Files** | ntuser.dat, boot.ini, bootmgr, pagefile.sys, swapfile.sys, hiberfil.sys |
| **Root Paths** | All root drive access (C:\, D:\, /) blocked |

### Process Watcher (Optional)

- Polls `tasklist /FO CSV /NH` every 3 seconds
- Detects newly launched applications (Notepad, Word, Excel, VS Code, etc.)
- Emits events via Server-Sent Events (SSE) to all connected frontend clients
- **Disabled by default** — toggle via UI or API
- CPU overhead: ~0.1% per poll cycle
