# 🏠 Property Witch 3.0

> AI-powered Portuguese real estate assistant with natural language search, intelligent analysis, and scheduled indexing.

![Version](https://img.shields.io/badge/version-3.0-blue)
![AI](https://img.shields.io/badge/AI-Groq%20Llama%203.3-green)
![Listings](https://img.shields.io/badge/listings-8000%2B-orange)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Setup & Installation](#setup--installation)
5. [Deployment](#deployment)
6. [API Reference](#api-reference)
7. [AI Analysis System](#ai-analysis-system)
8. [Scheduled Indexer](#scheduled-indexer)
9. [Configuration](#configuration)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

Property Witch is an AI-powered real estate search assistant focused on Portuguese properties. It uses natural language processing to understand user queries, fetches listings from OLX Portugal, and provides intelligent analysis of each property.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| 🗣️ Natural Language Search | "Find me a 2-bedroom apartment in Lisbon under €200k" |
| 🤖 AI Intent Detection | Understands context, follow-ups, and refinements |
| 📊 Smart Analysis | Detailed property analysis for ≤10 results, brief for >10 |
| 🔄 Scheduled Indexing | Auto-indexes 8,000+ listings every 4 hours |
| 🇵🇹 Portugal Expertise | Understands "urbano" vs "rústico" land classifications |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│                    propertywitchtest.com                        │
│         Hostinger Static Hosting (147.93.73.224:65002)          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js/Express)                    │
│              property-witch-api.onrender.com                    │
│                     Render.com (Free Tier)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Chat API    │  │  RAG System  │  │  Scheduled Indexer   │  │
│  │  /api/chat   │  │  8000+ docs  │  │  Every 4 hours       │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────┘  │
│         │                                                       │
│  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ AI Service   │  │  OLX Adapter │  │  Search Service      │  │
│  │ Groq API     │  │  API Calls   │  │  Filter & Rank       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| AI Provider | Groq API (llama-3.3-70b-versatile) |
| Data Source | OLX Portugal API |
| Hosting (Frontend) | Hostinger |
| Hosting (Backend) | Render.com |

---

## ✨ Features

### 1. AI-Powered Intent Detection

The system uses AI to understand user intent, not hardcoded regex patterns:

```typescript
// User says: "narrow down within 60m2 range"
// AI detects:
{
  intent: "pick_from_results",
  extractedFilters: { area: 60 },
  selectionCriteria: "filter by area closest to 60m2"
}
```

**Supported Intents:**
- `search` - New property search
- `refine_search` - Modify previous search
- `pick_from_results` - Select from current results
- `conversation` - General chat/questions
- `follow_up` - Questions about shown listings

### 2. Adaptive Analysis Depth

| Results Count | Analysis Type | Description |
|---------------|---------------|-------------|
| ≤ 10 listings | **Detailed** | 4-6 sentences covering price, location, features, pros/cons |
| > 10 listings | **Brief** | 2-3 sentences with key match info |

### 3. Portuguese Land Classification

Critical for construction queries:
- **Urbano** (Urban) → ✅ Can build
- **Rústico** (Rural) → ❌ Cannot build (agricultural only)

The AI automatically detects and warns about land types.

### 4. Auto-Expanding Input

The chat textarea automatically grows as you type, with a max height of 200px.

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Local Development

```bash
# Clone the repository
git clone https://github.com/eduartgeorgia/propertywitch.git
cd propertywitch

# Setup backend
cd server
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
npm install
npm run dev

# In another terminal - setup frontend
cd web
npm install
npm run dev
```

Open `http://localhost:5173`

### Environment Variables

```env
# server/.env
PORT=3001
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
NODE_ENV=development

# Optional: Ollama fallback
OLLAMA_URL=http://localhost:11434
```

---

## 🌐 Deployment

### Backend (Render.com)

1. Connect GitHub repo to Render
2. Create new Web Service
3. Settings:
   - Build Command: `cd server && npm install && npm run build`
   - Start Command: `cd server && node dist/server.js`
   - Add env var: `GROQ_API_KEY`

### Frontend (Hostinger)

```bash
# Build frontend
cd web
npm run build

# Deploy to Hostinger
sshpass -p 'YOUR_PASSWORD' scp -P 65002 -r dist/* \
  u805002786@147.93.73.224:~/domains/propertywitchtest.com/public_html/
```

---

## 📡 API Reference

### POST `/api/chat`

Main chat endpoint for all interactions.

**Request:**
```json
{
  "message": "apartments in lisbon under 300k",
  "mode": "auto",
  "threadId": "uuid-thread-id",
  "userLocation": {
    "lat": 38.7223,
    "lng": -9.1393,
    "city": "Lisbon",
    "currency": "EUR"
  }
}
```

**Response:**
```json
{
  "type": "search",
  "intentDetected": "search",
  "message": "I found 35 apartments in Lisbon...",
  "searchResult": {
    "listings": [...],
    "matchType": "exact",
    "appliedPriceRange": { "min": 0, "max": 300000 }
  },
  "threadId": "uuid-thread-id"
}
```

### GET `/api/chat/ai/health`

Check AI backend status.

### GET `/api/rag/status`

Get RAG system statistics (indexed listings count).

### POST `/api/rag/initialize`

Manually trigger RAG reindexing.

---

## 🧠 AI Analysis System

### Analysis Flow

```
User Query
    │
    ▼
┌─────────────────────┐
│  AI Intent Detection │ ← Groq llama-3.3-70b
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  OLX API Search     │ ← Fetch listings
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  filterListingsByRelevance() │
│  - If ≤10: Detailed prompt   │
│  - If >10: Brief prompt      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  getRelevantListings()       │
│  - Re-analyze if filtered    │
│    from many → few           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  pickBestListings()  │ ← For "narrow down" queries
│  - Per-listing analysis      │
│  - Updates aiReasoning field │
└──────────────────────┘
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `detectIntent()` | AI-powered intent classification |
| `filterListingsByRelevance()` | Analyze listings with AI |
| `buildAnalysisPrompt()` | Create detailed or brief prompts |
| `analyzeListingsLocally()` | Fallback when AI unavailable |
| `pickBestListings()` | Handle "narrow down" / "choose X" |
| `getRelevantListings()` | Re-analyze when results shrink |

### Analysis Config

```typescript
const AI_ANALYSIS_CONFIG = {
  maxListingsForAI: 20,        // Skip AI if more than this
  analysisTimeoutMs: 60000,    // 60 second timeout
  enableAIAnalysis: true,
  detailedAnalysisThreshold: 10 // Detailed if ≤ this
};
```

---

## ⏰ Scheduled Indexer

Automatically indexes listings every 4 hours.

### Coverage

**Cities (10):**
- Lisbon, Porto, Faro, Braga, Coimbra
- Setúbal, Aveiro, Leiria, Évora, Funchal

**Query Types (9):**
- Apartments, Houses, Land, Rooms
- Commercial, Farms, Garages, Offices, Warehouses

### Filters

- **Max Age:** 3 months (filters out old listings)
- **Deduplication:** By listing ID

### Stats

Current index: **~8,500 listings**

### Manual Trigger

```bash
curl -X POST https://property-witch-api.onrender.com/api/rag/initialize
```

---

## ⚙️ Configuration

### Frontend Config (`web/src/App.tsx`)

```typescript
const API_URL = "https://property-witch-api.onrender.com";
```

### CORS Config (`server/src/index.ts`)

```typescript
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://propertywitchtest.com",
    "https://www.propertywitchtest.com"
  ]
};
```

---

## 🔧 Troubleshooting

### "Waking up server..."

**Cause:** Render free tier sleeps after 15 min inactivity.
**Solution:** The frontend has retry logic with exponential backoff.

### AI Analysis Too Short

**Check:**
1. Is the listing count ≤ 10? (triggers detailed mode)
2. Is `pickBestListings()` being used? (for "narrow down" queries)
3. Check server logs: `[AI Analysis] Mode: DETAILED/BRIEF`

### "fetch failed" Errors

**Cause:** OLX API rate limiting or network issues.
**Solution:** Built-in retry with exponential backoff (up to 3 retries).

### Input Not Clearing

**Fixed in v3.0:** Input clears immediately on submit, not in `finally` block.

### m² vs € Confusion

**Fixed in v3.0:** AI distinguishes area (m²) from price (€) contextually.

---

## 📁 Project Structure

```
aipa/
├── server/
│   ├── src/
│   │   ├── index.ts           # Express app entry
│   │   ├── routes/
│   │   │   ├── chat.ts        # Main chat endpoint
│   │   │   └── rag.ts         # RAG management
│   │   ├── services/
│   │   │   ├── aiService.ts   # AI analysis (★ main logic)
│   │   │   ├── searchService.ts
│   │   │   ├── scheduledIndexer.ts
│   │   │   └── rag/           # RAG system
│   │   └── adapters/
│   │       └── olxAdapter.ts  # OLX API integration
│   └── data/
│       └── rag/               # Indexed listings JSON
├── web/
│   ├── src/
│   │   ├── App.tsx            # Main React component
│   │   ├── styles.css         # Tailwind + custom styles
│   │   └── types.ts
│   └── index.html
└── README.md                  # This file
```

---

## 📊 Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | Feb 2025 | AI intent detection, adaptive analysis, pickBestListings fix |
| 2.0 | Jan 2025 | Scheduled indexer, RAG system, Groq integration |
| 1.0 | Dec 2024 | Initial release, OLX adapter, basic search |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test locally
5. Submit a pull request

---

## 📜 License

MIT License - See LICENSE file for details.

---

**Built with 🧙‍♂️ magic by Property Witch Team**
