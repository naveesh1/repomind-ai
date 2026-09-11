# RepoMind AI

> **AI-Powered Software Change Impact & Regression Risk Analyzer**

RepoMind AI is designed to analyze software repositories and determine code dependencies, change impact radii, and regression risk factors when modifying code.

---

## 🏗️ Project Structure

```text
RepoMind-AI/
├── frontend/             # React + TypeScript Web Application (Vite)
├── backend/              # Python FastAPI Application
├── tests/                # Automated Test Suites (Frontend & Backend)
├── docs/                 # Project Documentation & Specifications
├── .gitignore            # Git Ignore Rules
└── README.md             # Project Overview & Setup Instructions
```

---

## 📁 Component Overview

### 1. `frontend/`
- **Technology Stack:** React, TypeScript, Vite
- **Purpose:** User Interface for repository analysis visualization, impact reporting, and interactive dependency graphs.
- **Getting Started:**
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

### 2. `backend/`
- **Technology Stack:** Python, FastAPI, Uvicorn
- **Purpose:** Core engine for static code analysis, graph generation, impact assessment, and API endpoints.
- **Getting Started:**
  ```bash
  cd backend
  python -m venv .venv
  # On Windows:
  .venv\Scripts\activate
  # On macOS/Linux:
  source .venv/bin/activate
  pip install -r requirements.txt
  uvicorn app.main:app --reload
  ```

### 3. `tests/`
- **Purpose:** Contains test suits for backend (pytest) and frontend (unit/integration testing).

### 4. `docs/`
- **Purpose:** Technical documentation, architectural design records (ADRs), API specifications, and research notes.

---

## 📜 License

Private Repository - All Rights Reserved.
