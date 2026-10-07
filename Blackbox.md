# Blackbox Demo Guide & User Walkthrough

> **Project:** AI-Based OSS Developer Recommendation & Issue Assignment  
> **Audience:** End-Users, Maintainers, Evaluators, Project Demonstrators.  
> **Goal:** How to present the project, explain the core concepts in plain English, and deliver an engaging live demo.

---

## 1. What is This Project? (The 30-Second Elevator Pitch)

> *"In busy open-source projects, hundreds of new issues and bug reports pile up every week. Maintainers waste hours trying to figure out: **Who is the right person to fix this bug?**"*
>
> *"Our project is an **intelligent developer recommender**. It analyzes the entire Git footprint of a repository, understands the semantic meaning of incoming bugs, and instantly recommends the top candidate with a clear, human explanation of **why** they are the best match."*

---

## 2. Who Are the Developers?

When someone asks: *"Where do you get these developers? Who are they?"*, here is your answer:

- **They are the real contributors of the repository:** The system connects to GitHub via its API and automatically discovers every developer who has pushed code or merged pull requests into the project.
- **Each developer has an AI "Skill Profile":**
  - What files have they worked on? (e.g., database, frontend, authentication, CLI)
  - What problems have they solved in their past commit messages?
  - What pull requests have they authored?
- **No manual profile creation:** Developers don't have to fill out resumes or skill tags. The AI extracts their expertise automatically from their actual code and commit history.

---

## 3. How Are We Choosing the Developer?

When someone asks: *"How does the AI pick the best developer? Is it just keyword matching?"*, here is your answer:

It is **NOT** a simple keyword match or a black-box guess. It uses an **explainable 3-signal ranking formula**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FINAL MATCH SCORE (100%)                        │
├───────────────────────────────┬────────────────────────┬───────────────┤
│    60% Semantic Match         │   25% Recency Score    │  15% Volume   │
│  (Deep contextual similarity) │  (Currently active?)   │ (Track record)│
└───────────────────────────────┴────────────────────────┴───────────────┘
```

1. **60% Semantic Experience (Context Match):**
   - The AI converts the bug report into a vector concept and checks: *Has this developer written code or solved bugs that mean the same thing?*
   - Even if the issue says *"Authentication token expired"* and the developer's commit says *"Fix JWT renewal"*, the vector engine recognizes that both mean the exact same concept.
2. **25% Recent Activity (Freshness):**
   - A developer might have written the module 3 years ago and moved on. The system favors developers who were active recently so issues don't get assigned to people who are inactive.
3. **15% Contribution Volume (Track Record):**
   - Evaluates the developer’s established volume of commits and merged PRs in the repository.

### ✨ The Explainability Feature (AI Rationale)
Along with the percentage score, an LLM generates a **concise, one-sentence plain English explanation** (e.g., *"@ayushbin07 is the top candidate due to an 85% semantic match on authentication modules and consistent recent repository commits."*).

---

## 4. Live Demo Walkthrough (Step-by-Step Script)

Use this script during your presentation or evaluation demo:

### Step 1: Show the Dashboard
- **URL:** Open `http://localhost:3000`
- **What to say:**  
  > *"Here is our main maintainer dashboard. At a glance, it shows our repository stats: total ingested developers, issues tracked, vector embeddings calculated, and completed recommendations."*
- **What to point out:** Point out the clean dark-mode UI, live statistic counters, and the recent issues list.

---

### Step 2: Show the Data Ingestion (Sync)
- **URL:** Click **Sync** in the navigation bar (`http://localhost:3000/sync`)
- **What to say:**  
  > *"Before the AI can make recommendations, it needs to understand the project history. By clicking 'Start Sync', our backend reaches out to GitHub, ingests contributors, commits, and pull requests, and converts each developer's contribution history into a 768-dimensional vector embedding stored in PostgreSQL with pgvector."*
- **What to point out:** Mention that it runs entirely locally using Ollama (`nomic-embed-text`) or seamlessly connects to Google Gemini in the cloud.

---

### Step 3: Explore Repository Issues
- **URL:** Click **Issues** in the navigation bar (`http://localhost:3000/issues`)
- **What to say:**  
  > *"Here is the Issues Explorer. We can filter issues by state (Open/Closed), search by keywords, or check which issues already have AI recommendations ready."*
- **Action:** Click on any open issue to open its detail page.

---

### Step 4: The Recommendation & Explanation (The "Wow" Moment)
- **URL:** On the Issue detail page (`/issues/[id]`)
- **Action:** Click the **Calculate AI Recommendation** button.
- **What to say:**  
  > *"Now watch: The system takes the issue title, body, and labels, converts it into an embedding vector, performs a cosine similarity search against our developer database, and applies our 3-factor ranking algorithm."*
- **What to point out on screen:**
  1. **Hero Match Card:** Highlights the #1 developer with their avatar and GitHub handle.
  2. **Score Meters:** Point to the visual breakdown bars showing **Semantic Match %**, **Activity Recency %**, and **Contribution Volume %**.
  3. **AI Rationale:** Read aloud the LLM-generated explanation sentence. Emphasize that maintainers don't have to guess *why* this developer was picked.
  4. **Alternative Candidates:** Scroll down to show the runner-up candidates (ranked 2nd to 5th).

---

### Step 5: Human-in-the-Loop Confirmation
- **Action:** Point to the **Assign Developer** button.
- **What to say:**  
  > *"We believe AI should assist humans, not act without oversight. Our system uses a Human-in-the-Loop design: maintainers review the recommendation, and with one click, the system assigns the developer directly on GitHub and dispatches a notification."*

---

## 5. FAQs & Judge Q&A Cheat Sheet

### Q1: "Why not automatically assign the issue without human confirmation?"
> **Answer:** *"In production OSS repositories, assigning someone sends notifications and sets expectations. Having a maintainer confirm with a single click prevents accidental spam, keeps the system auditable, and ensures human oversight while cutting triage time from 15 minutes down to 5 seconds."*

### Q2: "What if a developer is new or just joined?"
> **Answer:** *"The volume score is only weighted at 15%. If a new developer has made even 1 or 2 high-quality commits on the exact file related to the bug, their 60% semantic score and high recency score will still place them high on the recommendation list."*

### Q3: "Can this run completely offline without paying for cloud APIs?"
> **Answer:** *"Yes! We built a dual AI provider abstraction. In development and offline demos, it runs on local Ollama using `nomic-embed-text` for 768-dim embeddings and `llama3.2` for explanations—zero API cost and zero data leaves your machine. For production cloud deployment, flipping one environment variable switches to Google Gemini."*

### Q4: "Why use PostgreSQL + pgvector instead of a separate vector database like Pinecone?"
> **Answer:** *"Using PostgreSQL with pgvector gives us the best of both worlds in a single database. We can store standard relational tables (developers, commits, PRs) right alongside vector embeddings. This allows us to perform fast vector similarity searches joined with relational metadata in a single SQL query, without the cost or complexity of managing external vector services."*
