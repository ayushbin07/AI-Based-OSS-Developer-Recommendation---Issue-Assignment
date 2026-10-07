# Decision Log

> Short records of architectural and technical choices.
> Format: **D-NNN · Title** | Date | Status | Why

---

## D-001 · Framework: Next.js + TypeScript

**Date:** 2026-10-04 | **Status:** Accepted

Next.js App Router gives us server API routes + UI in one codebase.
Deploys to Vercel without a permanent server. TypeScript enforces the AI provider contract.

---

## D-002 · Database: PostgreSQL + pgvector

**Date:** 2026-10-04 | **Status:** Accepted

One database handles both relational data and vector similarity search.
Avoids a separate vector store (Pinecone etc.) which adds cost and operational complexity.
pgvector cosine similarity is sufficient at university-project scale.

---

## D-003 · ORM: Drizzle ORM

**Date:** 2026-10-04 | **Status:** Accepted

Type-safe, lightweight, works well with Next.js serverless.
Migrations are plain SQL — inspectable and version-controlled.
Supports pgvector via `customType`.

---

## D-004 · AI Provider Abstraction (no LangChain)

**Date:** 2026-10-04 | **Status:** Accepted

Custom `AIProvider` interface with two implementations: `OllamaProvider` and `GoogleAIProvider`.
Selected via `AI_PROVIDER` environment variable.
Avoids LangChain — a thin custom abstraction is simpler and more transparent for a university project.

---

## D-005 · Embedding Strategy: One per Developer (Upsert)

**Date:** 2026-10-04 | **Status:** Accepted

Generate one summary embedding per developer from their concatenated contribution history.
Upsert (regenerate) on new contributions.
Simpler than per-commit embeddings aggregated at query time. Sufficient at this scale.

---

## D-006 · Assignment: Human-in-the-Loop

**Date:** 2026-10-04 | **Status:** Accepted

AI recommends, a human confirms before GitHub assignment and email are sent.
Keeps the system auditable and within appropriate scope for a university project.

---

## D-007 · Email: Resend API

**Date:** 2026-10-04 | **Status:** Accepted

Simple REST API, free tier sufficient for demos.
Works as a single serverless function call — no mail server needed.

---

## D-008 · GitHub Integration: Octokit + Webhooks

**Date:** 2026-10-04 | **Status:** Accepted

Official, well-typed GitHub client. Webhooks trigger the recommendation workflow on new issues without polling.

---

## D-009 · Embedding Dimension: 768

**Date:** 2026-10-04 | **Status:** Accepted

768 is compatible with both `nomic-embed-text` (Ollama, local) and `gemini-embedding-001` (Google, cloud).
Switching providers does not require a schema change or re-embedding if the same dimension is maintained.
