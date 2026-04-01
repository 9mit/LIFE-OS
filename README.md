# LifeOS — Personal Intelligence Hub & AI OS Assistant

<div align="center">

<img width="1910" height="990" alt="image" src="https://github.com/user-attachments/assets/a41ccbb5-7da4-47f2-af4d-508ffef451d3" />

<img width="1908" height="988" alt="image" src="https://github.com/user-attachments/assets/2519e389-f837-4af9-8dc8-189fb36f6b75" />



**Transform your personal data into actionable insights and control your system with a beautiful, 100% offline, privacy-first AI dashboard.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Ollama](https://img.shields.io/badge/Ollama-phi3-blue?logo=ollama&logoColor=white)](https://ollama.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## ✨ Features

### 🧠 Intelligence Suite
- **📊 Insights Dashboard** - Automated statistical analysis, trend detection, and AI-generated executive summaries.
- **💬 Ask LifeOS (RAG)** - Natural language Q&A over your personal data using local WebGPU LLMs or Ollama.
- **🎙️ Edge-Voice Input** - Talk to your system natively with local Whisper models for transcription.
- **🕸️ 3D Knowledge Graphs** - Visualize entity connections and data relationships in an interactive 3D space.

### 🖥️ OS AI Assistant
- **🦾 System Automation** - Create, move, rename, or delete files across your system using natural language.
- **📄 Office Integration** - Generate or edit Excel spreadsheets and Word documents via AI commands.
- **🔍 Intelligent Search** - Search for files using semantic intent (e.g., "Find my resume from last year") across Desktop, Documents, and Downloads.
- **🔔 Process Watcher** - Automatically detects when you open apps (Notepad, Word, etc.) and offers context-aware AI assistance.

### 🛡️ Privacy & Security
- **🔒 100% Offline** - All AI inference and data processing stays on your machine. Zero cloud dependencies.
- **🏗️ Security Sandbox** - Operations are restricted to safe directories (Desktop/Documents/Downloads) with strict file-type blocklists.
- **♻️ Soft Deletes** - Files are moved to a local `.trash/` directory—never permanently deleted without your consent.
- **⏳ Operation History** - Full undo/redo support for all filesystem actions via a local SQLite transaction log.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Zustand, Tailwind CSS |
| **Backend** | Node.js, Express 5 |
| **AI Engine** | **Ollama** (phi3), **Transformers.js** (Whisper, Embeddings) |
| **Persistence** | **Dexie.js** (IndexedDB), **SQLite** (Operation History) |
| **Visualization** | Chart.js, force-graph-3d |
| **File Processing**| PapaParse (CSV), xlsx, docx, mammoth, pdf.js |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** 18.0 or higher.
- **Ollama** installed and running locally (`ollama serve`).
  - Pull the required model: `ollama pull phi3`

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/lifeos.git
cd lifeos/LIFE_OS

# Install dependencies
npm install
```

### 3. Run the App
You need to run both the frontend and the backend server:

```bash
# Terminal 1: Start the Frontend (Vite)
npm run dev

# Terminal 2: Start the Backend (Express & OS Assistant)
npm run server
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
LIFE_OS/
├── components/         # React UI (Insights, Chat, OS Assistant, Knowledge Graph)
├── hooks/             # Custom React hooks (IndexedDB, Whisper, Theme)
├── server/            # Node.js backend (Ollama integration, File Assistant, Tasks)
│   ├── ollama.js      # AI Intent parsing & generation
│   ├── taskExecutor.js# Deterministic action execution logic
│   └── index.js       # Express API & Server-Sent Events (SSE)
├── storage/           # Browser-side persistence (Dexie)
├── store/             # Zustand state management
├── utils/             # Data analysis, parsing, and AI utility functions
├── App.tsx            # Main application layout & global event handling
└── index.tsx          # Application entry point
```

---

## 🔐 Privacy-by-Design

LifeOS follows strict privacy principles:
- **Zero Third-Party APIs**: No OpenAI, Anthropic, or Google keys required.
- **Air-Gapped Potential**: Can run without an active internet connection once models are cached.
- **Minimal Footprint**: No background telemetry or usage tracking.

---

## 📝 License
MIT License - Copyright (c) 2026 LifeOS Team.



