# Whitebox Architecture & Technical Specification

> **Project:** AI-Based OSS Developer Recommendation & Issue Assignment  
> **Audience:** Developers, Architects, Technical Evaluators, Evaluators wanting deep-dive implementation details.

---

## 1. Executive Technical Summary

This system solves the **Open-Source Software (OSS) issue triage bottleneck** by applying semantic retrieval, multi-criteria decision analysis (MCDA), and LLM explanation synthesis to historical Git footprints.

Instead of manual triage or naive keyword searches, the platform:
1. Ingests raw repository contribution graphs (commits, changed file paths, merged PRs, author identities).
2. Compiles dense **768-dimensional developer semantic profiles** stored in PostgreSQL using the `pgvector` extension.
3. Ingests incoming GitHub issues, generates issue vector representations, and executes cosine similarity searches.
4. Computes a multi-signal rank score: **60% Semantic Similarity + 25% Activity Recency + 15% Contribution Volume**.
5. Prompts an LLM (local Ollama `llama3.2` or cloud `gemini-3.8-flash`) to generate a natural language rationale.
6. Enforces **Human-in-the-Loop** confirmation before triggering external side effects (Octokit GitHub assignment and Resend email dispatch).

---

## 2. System Architecture & Component Diagram

```
                       ┌────────────────────────────────────────────────────────┐
                       │                   GitHub REST API                      │
                       │   (Contributors, Issues, PRs, Commits, Changed Files)   │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Next.js App Router (Fullstack Node.js Engine)                                                  │
│                                                                                                │
│  ┌─────────────────────────┐     ┌─────────────────────────┐     ┌──────────────────────────┐  │
│  │ Collector Service       │ ──> │ Embedding Service       │ ──> │ Recommendation Engine   │  │
│  │ (Octokit Ingestion)     │     │ (Profile Builder)       │     │ (MCDA Scorer + Explainer)│  │
│  └───────────┬─────────────┘     └───────────┬─────────────┘     └────────────┬─────────────┘  │
│              │                               │                                │                │
│              ▼                               ▼                                ▼                │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Database Layer: Drizzle ORM (Connection Pool: postgres-js)                               │  │
│  └───────────────────────────────────────────┬──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────┼─────────────────────────────────────────────────┘
                                               │
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL 16 + pgvector (Docker Container: port 5432)                                         │
│                                                                                                │
│  - developers               (GitHub profile metadata, total commits, total PRs)                │
│  - developer_embeddings     (768-dim vector, source summary text, provider, model)             │
│  - issues                   (GitHub issues, title, body, labels, assignees)                    │
│  - pull_requests            (PR metadata, closes_issue_id, author_id)                          │
│  - commits                  (sha, commit message, author_id, committed_at)                     │
│  - changed_files            (filePath, additions, deletions, commit_id, pr_id)                 │
│  - issue_recommendations    (cached ranked recommendation array, LLM rationale, state)        │
└──────────────────────────────────────────────▲─────────────────────────────────────────────────┘
                                               │
                                               │ Vector Embeddings & Chat Completions
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Dual AI Provider Abstraction (`AIProvider` Interface)                                          │
│                                                                                                │
│  ┌──────────────────────────────────────────────┐  ┌─────────────────────────────────────────┐ │
│  │ Local Provider: OllamaProvider               │  │ Cloud Provider: GoogleAIProvider        │ │
│  │ - Embedding: nomic-embed-text (768-dim)      │  │ - Embedding: gemini-embedding-001/    │ │
│  │ - Chat: llama3.2                             │  │              text-embedding-004(768-dim)│ │
│  │ - Base URL: http://localhost:11434           │  │ - Chat: gemini-3.8-flash                │ │
│  └──────────────────────────────────────────────┘  └─────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Who Are the Developers? (Data Model & Ingestion)

### 3.1 Developer Discovery
Developers are **not manually registered**. They are discovered programmatically from the Git history of the target repository:
1. `getContributors()` queries GitHub REST endpoint `GET /repos/{owner}/{repo}/contributors` via Octokit.
2. Bot accounts (e.g., `dependabot[bot]`) and anonymous authors are filtered out.
3. For each developer, the system extracts and upserts:
   - `githubId`, `login` (e.g., `ayushbin07`)
   - `avatarUrl`, `profileUrl`
   - `totalCommits`

### 3.2 Contribution Footprint
The collector links the developer to their concrete contributions across three relational tables:
- **`commits`**: Linked by `author_id`. Stores SHA, commit message, and commit timestamp.
- **`pull_requests`**: Linked by `author_id`. Stores PR title, description body, merged status, merged timestamp, and `closes_issue_id`.
- **`changed_files`**: Captures file paths touched (e.g., `src/auth/jwt.ts`, `docs/setup.md`), additions, and deletions.

### 3.3 Relational Schema (`src/lib/db/schema.ts`)

```typescript
// developers table
export const developers = pgTable("developers", {
  id: serial("id").primaryKey(),
  githubId: integer("github_id").notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  profileUrl: text("profile_url"),
  bio: text("bio"),
  location: text("location"),
  company: text("company"),
  totalCommits: integer("total_commits").notNull().default(0),
  totalPrs: integer("total_prs").notNull().default(0),
  totalIssuesClosed: integer("total_issues_closed").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// developer_embeddings table (with pgvector custom type)
export const developerEmbeddings = pgTable("developer_embeddings", {
  id: serial("id").primaryKey(),
  developerId: integer("developer_id").notNull().unique().references(() => developers.id),
  sourceText: text("source_text").notNull(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  provider: text("provider").notNull(), // 'ollama' | 'google'
  model: text("model").notNull(),       // 'nomic-embed-text' | 'gemini-embedding-001'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

---

## 4. How Developer Semantic Profiles Are Built

Located in `src/lib/services/embedding.service.ts`:

1. **Context Extraction**: For each developer in the database, the system queries:
   - Up to **50 recent commit messages** (`commits` table).
   - Up to **30 authored PR titles and description excerpts** (`pull_requests` table).
   - Up to **100 unique touched file paths** (`changed_files` table).
2. **Text Synthesis (`buildDeveloperSummary`)**:
   ```
   Developer: ayushbin07
   Total commits: 15
   Total PRs: 2

   Recent commit messages:
   - Fix OAuth token refresh race condition
   - Implement rate limiter middleware for /api/v1
   - Add unit tests for JWT verification

   Pull requests authored:
   - feat: Add Redis session caching
     Introduces distributed redis caching layer for API gateway

   Files touched:
   - src/middleware/rateLimiter.ts
   - src/auth/tokenService.ts
   - tests/auth.test.ts
   ```
3. **Token Capping**: Text is truncated to `MAX_SUMMARY_CHARS = 4000` to prevent token overflow.
4. **Embedding Generation**: The text is passed to `ai.embed(summary)`:
   - Local: `POST http://localhost:11434/api/embeddings` with `nomic-embed-text`.
   - Cloud: Google Gemini embedding endpoint with `gemini-embedding-001`.
5. **Upsert**: Stored in `developer_embeddings` with dimension `768`.

---

## 5. How Are We Choosing the Developer? (The Recommendation Algorithm)

The recommendation pipeline (`src/lib/services/recommendation.service.ts`) executes a multi-stage scoring algorithm:

### Step 1: Issue Vectorization
When an issue is selected:
1. `buildIssueText(issue)` concatenates:
   ```
   Title: <issue.title>
   Labels: <label1, label2>
   Description: <issue.body (first 1500 chars)>
   ```
2. The AI provider generates a 768-dimensional issue embedding vector $V_{\text{issue}}$.

### Step 2: Vector Cosine Retrieval (Database Level)
`pgvector` performs cosine distance calculation using the `<=>` operator against all developer embeddings:

$$\text{cosine\_distance}(A, B) = A \Leftrightarrow B = 1 - \frac{A \cdot B}{\|A\| \|B\|}$$

$$\text{vector\_score} = 1 - \text{cosine\_distance}$$

A SQL query retrieves the **top 20 candidate developers** ordered by cosine distance:
```sql
SELECT
  d.id AS developer_id,
  d.login,
  d.avatar_url,
  d.total_commits,
  d.total_prs,
  de.updated_at AS last_updated,
  1 - (de.embedding <=> $1::vector) AS vector_score
FROM developer_embeddings de
JOIN developers d ON d.id = de.developer_id
ORDER BY de.embedding <=> $1::vector
LIMIT 20;
```

### Step 3: Multi-Signal Weighted Formula
Semantic similarity alone is not sufficient (a developer might have written related code 4 years ago and left the project, or might only have 1 commit). The engine blends three distinct signals:

$$\text{FinalScore} = (0.60 \times S_{\text{vector}}) + (0.25 \times S_{\text{recency}}) + (0.15 \times S_{\text{volume}})$$

#### 1. Semantic Score ($S_{\text{vector}}$, Weight = 60%)
- Direct cosine similarity between the issue text and the developer's historical profile.
- Clamped between $0.0$ and $1.0$.

#### 2. Recency Score ($S_{\text{recency}}$, Weight = 25%)
- Evaluates developer activity freshness using linear decay across a 365-day window:
$$S_{\text{recency}} = \max\left(0, 1 - \frac{\text{now} - \text{last\_updated}}{365 \times 24 \times 3600 \times 1000}\right)$$
- If the developer contributed today: $S_{\text{recency}} \approx 1.0$.
- If last contribution was > 1 year ago: $S_{\text{recency}} = 0.0$.

#### 3. Contribution Volume Score ($S_{\text{volume}}$, Weight = 15%)
- Normalizes commits and PRs relative to the most active contributor in the retrieved cohort:
$$S_{\text{volume}} = 0.5 \times \left(\frac{\text{commits}}{\max(\text{commits}_{cohort})}\right) + 0.5 \times \left(\frac{\text{PRs}}{\max(\text{PRs}_{cohort})}\right)$$

### Step 4: Top-5 Ranking & LLM Rationale Generation
1. Candidates are sorted descending by $\text{FinalScore}$ and truncated to `TOP_K = 5`.
2. For the **#1 Top Candidate**, the engine prompts the LLM to synthesize a natural language explanation:
   ```
   System Prompt:
   You are helping assign a GitHub issue to the best developer.
   Issue title: "{issue.title}"
   Issue body: "{issue.body}"
   Labels: {issue.labels}

   Top recommended developer: {dev.login}
   Semantic similarity score: {dev.vectorScore}%
   Activity recency score: {dev.recencyScore}%
   Contribution volume score: {dev.volumeScore}%

   Write a single concise sentence (max 30 words) explaining why {dev.login}
   is the best match for this issue based on the scores above.
   ```
3. Fallback: If the LLM call times out, a deterministic template string is rendered:  
   `"{login} has high semantic similarity ({vectorScore}%) to this issue based on historical contributions."`

---

## 6. Execution Lifecycle & Runtime Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Maintainer
    participant UI as Next.js Dashboard
    participant API as /api/issues/[id]/recommend
    participant AI as AI Provider (Ollama / Gemini)
    participant DB as Postgres + pgvector
    participant GH as GitHub REST (Octokit)

    User->>UI: Visits /sync and clicks "Start Sync"
    UI->>GH: Ingest contributors, commits, PRs, file changes
    GH-->>DB: Upsert relational records
    UI->>AI: Generate 768-dim embeddings for all developers
    AI-->>DB: Store vectors in developer_embeddings

    User->>UI: Selects Issue on /issues/[id]
    User->>UI: Clicks "Calculate AI Recommendation"
    UI->>API: POST /api/issues/[id]/recommend
    API->>AI: embed(issue.title + issue.body + labels)
    AI-->>API: 768-dim issue vector
    API->>DB: Cosine distance query (<=>) LIMIT 20
    DB-->>API: 20 candidate rows
    API->>API: Compute multi-signal scores (60% vector + 25% recency + 15% volume)
    API->>AI: Prompt LLM for #1 candidate rationale
    AI-->>API: Concise explanation sentence
    API->>DB: Cache recommendation in issue_recommendations
    API-->>UI: Return Top 5 candidates with scores & rationale
    UI-->>User: Displays Hero Card, Score Meters & Top Match
```

---

## 7. Configuration & Environment Variables Reference

| Variable | Description | Sample Value |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string with pgvector support | `postgresql://postgres:password@localhost:5432/ai_dev_recommender` |
| `AI_PROVIDER` | Backend provider switcher | `ollama` (default local) or `google` (cloud) |
| `OLLAMA_BASE_URL` | Local Ollama endpoint | `http://localhost:11434` |
| `OLLAMA_EMBED_MODEL` | Embedding model (must output 768 dims) | `nomic-embed-text` |
| `OLLAMA_CHAT_MODEL` | Generation model for rationales | `llama3.2` |
| `GOOGLE_AI_API_KEY` | Google Gemini API key (if `AI_PROVIDER=google`) | `AIzaSy...` |
| `GITHUB_TOKEN` | GitHub Personal Access Token (classic with `repo` scope) | `ghp_...` |
| `GITHUB_REPO_OWNER` | Target repository owner or organization | `ayushbin07` |
| `GITHUB_REPO_NAME` | Target repository name | `Samaj` |
| `RESEND_API_KEY` | (Optional Stage 2) Email notification key | `re_...` (can be empty) |
