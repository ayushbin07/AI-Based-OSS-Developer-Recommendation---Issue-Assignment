# Journal

> Chronological log of work sessions, milestones, and notes.
> Keep entries short — one block per session.

---

## 2026-10-04 — Session 1: Project Foundation

**Goal:** Establish project structure, core data model, and AI-provider abstraction.

### Completed
- Initialised Next.js 15 (App Router, TypeScript, ESLint) via `create-next-app`.
- Scaffolded the full `src/` directory structure.
- Wrote the `AIProvider` interface (`src/lib/ai/provider.interface.ts`).
- Implemented `OllamaProvider` — local Ollama REST API.
- Implemented `GoogleAIProvider` — Google AI SDK (`@google/genai`).
- Wrote `getAIProvider()` factory: selects provider via `AI_PROVIDER` env var.
- Designed and wrote the full Drizzle ORM schema with pgvector support.
- Created `GitHubClient` wrapping Octokit with typed helpers.
- Added `drizzle.config.ts` and initial migration (`0000_enable_pgvector.sql`).
- Added `.env.example` with all required variables documented.
- Installed packages: `drizzle-orm`, `postgres`, `@octokit/rest`, `resend`, `@google/genai`, `drizzle-kit`.

### Next Session Goals
- [ ] Set up local PostgreSQL + pgvector + run `npm run db:push`.
- [ ] Write the GitHub data collection service (ingest contributors, issues, PRs, commits).
- [ ] Write the embedding generation + upsert service.
- [ ] Write the recommendation engine (vector search + scoring + LLM explanation).
- [ ] Wire up the GitHub Webhook API route (`/api/webhooks/github`).
- [ ] Build the first frontend page: issue recommendation dashboard.

### Notes
- Embedding dimension: **768** — compatible with `nomic-embed-text` (Ollama) and `gemini-embedding-001` (Google).
- OllamaProvider uses fetch (no SDK dependency) — keeps Ollama code lightweight.
- GoogleAIProvider uses the Interactions API (`client.interactions.create`) for chat, and `client.models.embedContent` for embeddings.
- The `AI_PROVIDER` env var is read at runtime so the same build can be switched between providers by changing config.
