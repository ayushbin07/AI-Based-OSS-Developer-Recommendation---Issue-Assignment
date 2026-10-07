<div align="center">

# 🧠 AI-Based OSS Developer Recommendation & Issue Assignment

**Autonomous GitHub Issue Triage, Vector-Based Contributor Profiling, Multi-Signal MCDA Matching, and Human-in-the-Loop Assignment**

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pgvector](https://img.shields.io/badge/pgvector-Embedding_Vector_Search-0064a5?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini_3.8_Flash-8E75C2?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev/)
[![Ollama](https://img.shields.io/badge/Ollama-Local_LLM_%2B_Embeddings-000000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com/)
[![Docker](https://img.shields.io/badge/Docker-Containerized_DB-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![GitHub Octokit](https://img.shields.io/badge/GitHub_Octokit-REST_v22-181717?style=for-the-badge&logo=github&logoColor=white)](https://octokit.github.io/rest.js/)
[![Resend](https://img.shields.io/badge/Resend-Email_Notifications-000000?style=for-the-badge&logo=resend&logoColor=white)](https://resend.com/)

<br />

<p align="center">
  <a href="#-project-overview">Overview</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-ui-walkthrough">UI Walkthrough</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-recommendation-algorithm">Algorithm</a> •
  <a href="#-dual-ai-engine">AI Providers</a> •
  <a href="#-quickstart-guide">Quickstart</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-license">License</a>
</p>

</div>

---

## 📌 Project Overview

In fast-paced Open-Source Software (OSS) projects, hundreds of issues, feature requests, and bug reports arrive each week. **Issue triage is notoriously difficult**:
- Maintainers spend hours determining who has the relevant domain expertise.
- High-priority bugs sit unassigned or end up assigned to inactive contributors.
- Keyword matching fails when issues describe symptoms rather than underlying file architecture.

**AI-Based OSS Developer Recommendation & Issue Assignment** solves this bottleneck by turning historical Git footprints into **768-dimensional semantic profiles**. When an issue arrives, the engine performs vector similarity search, evaluates contributor recency and volume signals, generates natural language rationale explaining the match, and gives maintainers a **one-click assignment workflow** with real-time GitHub syncing and email notification dispatch.

```
Incoming Issue ─────────► [pgvector Cosine Search] ─────────► [Multi-Signal Scoring]
                                                                        │
                                                                        ▼
GitHub Assign & Email ◄────── [Human Confirms] ◄────── [LLM Explains Match Rationale]
```

---

## ✨ Key Features

- 🔍 **Autonomous Git Data Ingestion**: Pulls contributors, issues, pull requests, commit messages, and touched file paths directly via the GitHub REST API.
- 🧬 **768-Dim Developer Vector Profiles**: Automatically generates dense vector representations summarizing each contributor's codebase expertise (files touched, resolved issues, commit diffs).
- 🧮 **Multi-Signal MCDA Scoring Engine**: Combines **60% Semantic Similarity**, **25% Activity Recency**, and **15% Contribution Volume** alongside specialized domain expertise keyword boosts.
- 💡 **AI Match Rationale (Explainable AI)**: Uses an LLM to generate plain-English justification for *why* the developer is the top candidate.
- 🛡️ **Human-in-the-Loop Confirmation**: Protects repository maintainers from accidental spam or false assignments by requiring 1-click confirmation before triggering external side-effects.
- 🔌 **Swappable Dual AI Architecture**: Runs 100% locally and offline via **Ollama** (`nomic-embed-text` + `llama3.2`) or in the cloud with **Google Gemini** (`gemini-embedding-001` + `gemini-3.8-flash`).
- ⚡ **Direct GitHub & Email Integration**: Immediately updates the GitHub Issue assignee via Octokit and notifies the developer via Resend.
- 🎨 **Clay-Styled Modern Interface**: Built with Next.js 16, React 19, Lucide icons, responsive navigation sidebar, repository switcher, and warm clay-tinted card metrics.

---

## 🖥️ UI Walkthrough

<div align="center">
  <h3>🎯 Intelligent Candidate Match Card & LLM Rationale</h3>
  <img src="docs/images/hero-recommendation.png" alt="Candidate Recommendation View" width="900" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);" />
  <p><em>Real-time recommendation view showing candidate ranking, score breakdowns (semantic, recency, volume, keyword bonus), AI-synthesized rationale, and 1-click human assignment.</em></p>
</div>

<br />

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <h4>📊 Repository Dashboard & Health</h4>
      <img src="docs/images/dashboard.png" alt="Dashboard View" width="100%" style="border-radius: 8px;" />
      <p><em>Live repository scope switch, contributor count, issue totals, vector embeddings, and recent triage queue.</em></p>
    </td>
    <td width="50%" align="center">
      <h4>👥 Contributors & Expertise Roster</h4>
      <img src="docs/images/developers.png" alt="Developers View" width="100%" style="border-radius: 8px;" />
      <p><em>Inspect active contributors, commit volumes, pull request track records, and editable domain tags.</em></p>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <h4>🐛 Issues Explorer & Triage Status</h4>
      <img src="docs/images/issues.png" alt="Issues Explorer" width="100%" style="border-radius: 8px;" />
      <p><em>Filter by state (open/closed) and AI triage state (AI Ready, Assigned, Unprocessed) with live search.</em></p>
    </td>
    <td width="50%" align="center">
      <h4>🔄 Sync & Vector Ingestion Center</h4>
      <img src="docs/images/sync.png" alt="Sync View" width="100%" style="border-radius: 8px;" />
      <p><em>On-demand ingestion pipeline for GitHub repositories and batch developer vector re-indexing.</em></p>
    </td>
  </tr>
</table>

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph GitHub_Ecosystem["GitHub Platform"]
        GH_REPO["GitHub Repository"]
        GH_ISSUE["New Issue Opened"]
        GH_HOOK["GitHub Webhook Event"]
        OCTOKIT_ASSIGN["Octokit Issue Assignment"]
    end

    subgraph Ingestion_Layer["Data Ingestion & Extraction"]
        COLLECTOR["Collector Service (Octokit REST)"]
        DIFF_PARSER["Commit & File Diff Extractor"]
    end

    subgraph Storage_Layer["PostgreSQL 16 + pgvector"]
        DB_RECORDS[("Relational Tables\n• developers\n• issues\n• commits\n• pull_requests\n• changed_files")]
        DB_VECTORS[("pgvector Store\n• developer_embeddings (768-dim)\n• issue_recommendations")]
    end

    subgraph AI_Provider["Dual AI Provider Abstraction"]
        PROVIDER_SELECTOR{"AI_PROVIDER"}
        OLLAMA["Ollama (Local)\n• nomic-embed-text\n• llama3.2"]
        GEMINI["Google AI (Cloud)\n• gemini-embedding-001\n• gemini-3.8-flash"]
    end

    subgraph Recommendation_Pipeline["Recommendation Engine"]
        ISSUE_VEC["Issue Vectorizer (768-dim)"]
        COSINE_SEARCH["pgvector Cosine Search (<=>)"]
        MCDA_SCORER["Multi-Signal Weighted Scorer\n(60% Vector + 25% Recency + 15% Volume)"]
        LLM_EXPLAINER["LLM Rationale Synthesizer"]
    end

    subgraph Application_UI["Next.js 16 App Router UI"]
        DASHBOARD["Dashboard & Repositories"]
        TRIAGE_VIEW["Issue Triage & Recommendation Card"]
        HUMAN_CONFIRM{{"Human Maintainer Review & Click"}}
    end

    subgraph Notification_SideEffects["Side-Effect Dispatch"]
        RESEND_MAIL["Resend Email API"]
    end

    GH_REPO --> COLLECTOR
    COLLECTOR --> DIFF_PARSER
    DIFF_PARSER --> DB_RECORDS

    DB_RECORDS --> PROVIDER_SELECTOR
    PROVIDER_SELECTOR -->|ollama| OLLAMA
    PROVIDER_SELECTOR -->|google| GEMINI
    OLLAMA & GEMINI --> DB_VECTORS

    GH_ISSUE --> GH_HOOK
    GH_HOOK --> COLLECTOR
    GH_ISSUE --> ISSUE_VEC
    ISSUE_VEC --> COSINE_SEARCH
    COSINE_SEARCH --> DB_VECTORS
    DB_VECTORS --> MCDA_SCORER
    MCDA_SCORER --> LLM_EXPLAINER
    LLM_EXPLAINER --> TRIAGE_VIEW

    TRIAGE_VIEW --> HUMAN_CONFIRM
    HUMAN_CONFIRM -->|Confirm Assignment| OCTOKIT_ASSIGN
    HUMAN_CONFIRM -->|Confirm Assignment| RESEND_MAIL
    OCTOKIT_ASSIGN --> GH_REPO
```

---

## 🔬 Recommendation Algorithm & Scoring Engine

Instead of relying purely on surface-level keyword search or opaque LLM hallucination, the engine employs a deterministic **Multi-Criteria Decision Analysis (MCDA)** scoring function supplemented with an LLM rationale generator:

```mermaid
graph LR
    subgraph Inputs
        A["Incoming Issue Text"]
        B["Git Contribution History"]
        C["Activity Timestamps"]
    end

    subgraph Signals
        D["Cosine Semantic Match<br/><b>60% Weight</b>"]
        E["Time Decay Recency<br/><b>25% Weight</b>"]
        F["Commit & PR Volume<br/><b>15% Weight</b>"]
        G["Domain Keyword Match<br/><b>+Bonus Multiplier</b>"]
    end

    subgraph Aggregator
        H["Candidate Final Score (0 - 100%)"]
    end

    subgraph Output
        I["Ranked Top-5 Candidates"]
        J["Plain-English AI Explanation"]
    end

    A --> D
    B --> D
    C --> E
    B --> F
    A --> G
    B --> G

    D --> H
    E --> H
    F --> H
    G --> H

    H --> I
    I --> J
```

### 1. Vector Cosine Similarity ($S_{\text{vector}}$, Weight = 60%)
Developer experience summaries are vectorized into 768-dimensional space. The issue is similarly embedded, and distance is measured in PostgreSQL via `pgvector`:

$$\text{Cosine Distance}(A, B) = A \Leftrightarrow B = 1 - \frac{A \cdot B}{\|A\| \|B\|}$$

$$S_{\text{vector}} = \max\left(0, 1 - (V_{\text{issue}} \Leftrightarrow V_{\text{dev}})\right)$$

### 2. Contributor Recency Score ($S_{\text{recency}}$, Weight = 25%)
A developer who built a module 4 years ago may no longer maintain it. We compute a linear time decay over a 365-day moving window:

$$S_{\text{recency}} = \max\left(0, 1 - \frac{\text{Current Time} - \text{Last Activity Date}}{365 \times 24 \times 3600 \times 1000}\right)$$

### 3. Contribution Volume Score ($S_{\text{volume}}$, Weight = 15%)
Normalizes commits and merged pull requests against the maximum activity within the retrieved cohort:

$$S_{\text{volume}} = 0.5 \times \left(\frac{\text{Commits}_{\text{dev}}}{\max(\text{Commits}_{\text{cohort}})}\right) + 0.5 \times \left(\frac{\text{PRs}_{\text{dev}}}{\max(\text{PRs}_{\text{cohort}})}\right)$$

### 4. Overall Match Score Formula

$$\text{FinalScore} = \left(0.60 \times S_{\text{vector}}\right) + \left(0.25 \times S_{\text{recency}}\right) + \left(0.15 \times S_{\text{volume}}\right) + \text{Bonus}_{\text{keywords}}$$

### 5. LLM Synthesis Rationale
The top-ranked candidate is fed into the generative LLM with issue context and score breakdown to produce a one-sentence rationale:
> *"@prateekkarna03-coder is the top match for this issue due to their high Keyword Match Score of 90% for 'ui redesign', directly matching the issue's requirement for a UI redesign."*

---

## ⚡ Dual AI Engine Comparison

You can toggle between local development and cloud deployment by modifying `AI_PROVIDER` in `.env.local`:

| Feature | Local Provider (`AI_PROVIDER=ollama`) | Cloud Provider (`AI_PROVIDER=google`) |
|:---|:---|:---|
| **Embedding Model** | `nomic-embed-text` | `gemini-embedding-001` or `text-embedding-004` |
| **Embedding Dimension**| `768` dimensions | `768` dimensions |
| **Generation Model** | `llama3.2` or `mistral` | `gemini-3.8-flash` |
| **Network Requirement**| **100% Offline** (Zero external calls) | Outbound HTTPS to Google AI Studio |
| **Cost** | Free ($0.00) | Google AI Free / Pay-As-You-Go Tier |
| **Best For** | Local evaluation, sensitive codebases, classroom demos | Production deployments, low-resource host environments |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** `>= 18.x` (Recommended: Node 20+)
- **Docker** & Docker Compose (for running PostgreSQL with `pgvector`)
- A **GitHub Personal Access Token** (`classic` token with `repo` scope)
- **Ollama** installed locally (if running local AI) or a **Google AI Studio Key**

---

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/ayushbin07/ai-dev-recommender.git
cd ai-dev-recommender
npm install
```

---

### 3. Spin Up PostgreSQL with pgvector
Run a Docker container with the official `pgvector` image:

```bash
docker run -d \
  --name pgvector \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ai_dev_recommender \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

Verify that the container is healthy:
```bash
docker ps --filter "name=pgvector"
```

---

### 4. Configure Environment Variables
Copy `.env.example` into `.env.local`:

```bash
cp .env.example .env.local
```

Populate `.env.local` with your configuration:

```env
# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_dev_recommender

# ---------------------------------------------------------------------------
# AI Provider: "ollama" or "google"
# ---------------------------------------------------------------------------
AI_PROVIDER=ollama

# Local Ollama Settings (Required if AI_PROVIDER=ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.2

# Google AI Studio Settings (Required if AI_PROVIDER=google)
# GOOGLE_AI_API_KEY=AIzaSy...
GOOGLE_EMBED_MODEL=gemini-embedding-001
GOOGLE_CHAT_MODEL=gemini-3.8-flash

# ---------------------------------------------------------------------------
# GitHub Integration
# ---------------------------------------------------------------------------
GITHUB_TOKEN=ghp_yourPersonalAccessTokenHere
GITHUB_REPO_OWNER=facebook
GITHUB_REPO_NAME=react
GITHUB_WEBHOOK_SECRET=your_webhook_hmac_secret

# ---------------------------------------------------------------------------
# Email Notifications (Resend API)
# ---------------------------------------------------------------------------
RESEND_API_KEY=re_yourResendApiKeyHere
RESEND_FROM_EMAIL=onboarding@resend.dev
```

If using Ollama, pull the embedding and chat models:
```bash
ollama pull nomic-embed-text
ollama pull llama3.2
```

---

### 5. Push Database Schema
Use Drizzle Kit to create the tables, enum types, and pgvector extension:

```bash
npm run db:push
```

*(Optional) Launch Drizzle Studio to inspect database records in your browser:*
```bash
npm run db:studio
```

---

### 6. Run the Application
Start the Next.js development server:

```bash
npm run dev
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**.

---

## 🗄️ Database Schema & Relational Design

The system couples relational Git metadata with dense vector embeddings using Drizzle ORM:

```mermaid
erDiagram
    developers ||--o{ commits : authors
    developers ||--o{ pull_requests : authors
    developers ||--o| developer_embeddings : owns
    developers ||--o{ issue_recommendations : ranked_in
    issues ||--o{ issue_recommendations : evaluated_for
    commits ||--o{ changed_files : contains
    pull_requests ||--o{ changed_files : modifies

    developers {
        serial id PK
        integer github_id UK
        text login
        text avatar_url
        integer total_commits
        integer total_prs
        timestamp updated_at
    }

    developer_embeddings {
        serial id PK
        integer developer_id FK
        text source_text
        vector embedding "768 dimensions"
        text provider
        text model
    }

    issues {
        serial id PK
        integer github_id UK
        integer number
        text repo_full_name
        text title
        text body
        text state
        text assignee_login
    }

    issue_recommendations {
        serial id PK
        integer issue_id FK
        jsonb recommendations
        text ai_rationale
        boolean confirmed
        timestamp created_at
    }
```

---

## 📡 REST API Reference

| Method | Endpoint | Description | Request Body / Query |
|:---|:---|:---|:---|
| `GET` | `/api/repos` | Returns repositories currently stored in database | None |
| `GET` | `/api/issues` | Retrieves list of ingested issues with recommendation status | `?repo=owner/repo` |
| `GET` | `/api/issues/:id` | Returns single issue details and computed recommendations | None |
| `POST` | `/api/issues/:id/recommend` | Triggers recalculation of AI developer recommendations | `{ "force": true }` |
| `POST` | `/api/assign` | Assigns confirmed developer on GitHub and triggers email | `{ "issueId": 46, "developerLogin": "ayushbin07" }` |
| `POST` | `/api/sync` | Ingests GitHub contributors, commits, issues, and PRs | `{ "repo": "owner/repo" }` |
| `POST` | `/api/webhooks/github` | Listens for incoming GitHub issue webhook payloads | GitHub HMAC signature + payload |

---

## 🔔 GitHub Webhook Automation (Autonomous Mode)

To enable automatic issue ingestion and triage without manual syncing:

1. In your GitHub repository, navigate to **Settings > Webhooks > Add webhook**.
2. **Payload URL**: `https://<your-public-domain>/api/webhooks/github`
3. **Content type**: `application/json`
4. **Secret**: Enter the value configured in `GITHUB_WEBHOOK_SECRET`.
5. **Which events would you like to trigger this webhook?**:
   - Check **Issues** (specifically `issues.opened` and `issues.edited`).
6. Click **Add webhook**.

---

## 📁 Repository Structure

```
ai-dev-recommender/
├── docs/
│   └── images/                # UI screenshots & preview assets
├── drizzle/                   # Drizzle ORM SQL migration history
├── public/                    # Static SVG assets & icons
├── src/
│   ├── app/
│   │   ├── api/               # Next.js App Router API endpoints
│   │   │   ├── assign/        # Assignment execution endpoint
│   │   │   ├── issues/        # Issue listing & recommendation endpoints
│   │   │   ├── repos/         # Repository scope management
│   │   │   ├── sync/          # GitHub data ingestion & embedding sync
│   │   │   └── webhooks/      # GitHub webhook listener
│   │   ├── developers/        # Contributor roster & expertise tags page
│   │   ├── issues/            # Issues Explorer & [id] recommendation page
│   │   ├── sync/              # Data synchronization dashboard
│   │   ├── globals.css        # Claymorphic tokens & animations
│   │   ├── layout.tsx         # Root layout with sidebar navigation
│   │   └── page.tsx           # Dashboard view with repository health cards
│   ├── components/            # Reusable UI components & shadcn primitives
│   ├── context/               # React Context for active repository scope
│   └── lib/
│       ├── ai/                # Swappable AI Provider Abstraction (Ollama & Gemini)
│       ├── db/                # Drizzle ORM schema, client & pgvector types
│       ├── github/            # Octokit client & webhook helpers
│       └── services/          # Collector, Embedding & Recommendation services
├── Blackbox.md                # Evaluation demo script & non-technical walkthrough
├── Whitebox.md                # Mathematical formulas & in-depth engineering spec
├── decisions.md               # Architectural Decision Records (ADRs)
├── drizzle.config.ts          # Drizzle Kit configuration
├── package.json               # Dependencies & scripts
└── tsconfig.json              # TypeScript compiler configuration
```

---

## 🧪 Available Scripts

| Command | Action |
|:---|:---|
| `npm run dev` | Starts the Next.js development server with hot-reload |
| `npm run build` | Builds the production Next.js bundle |
| `npm run start` | Runs the production build server |
| `npm run lint` | Runs ESLint over all TypeScript and JSX files |
| `npm run db:push` | Syncs schema changes directly to PostgreSQL |
| `npm run db:studio` | Launches Drizzle Studio GUI on `https://local.drizzle.studio` |
| `npm run db:generate` | Generates SQL migration files |

---

## 🤝 Contributing

Contributions, feedback, and pull requests are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/ayushbin07"><strong>Ayush Binwal</strong></a></p>
  <p><em>Advancing open-source collaboration through explainable artificial intelligence.</em></p>
</div>
