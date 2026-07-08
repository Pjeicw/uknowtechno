# System Architecture & AI Developer Guidelines

## 1. Project Context & Tech Stack
- **Frontend:** React + TypeScript + Vite, deployed on Cloudflare.
- **Backend:** Python (FastAPI), deployed on Mac Mini.
- **Database:** SQLite (`rag.db`) locally, with integrations for Pocketbase.
- **AI/LLM Gateway:** Cloudflare AI Gateway (OpenAI, DeepSeek, Ollama).
- **Environment:** Strict Mode, Python 3.x, Node environment for frontend builds.
- **Version Control:** GitHub (Standard PR workflows).

## 2. Coding Rules
- **No `any` Types:** Enforce strict typing in TypeScript.
- **Naming Conventions:** Use `camelCase` for variables/functions, `PascalCase` for Components/Classes, and `UPPER_SNAKE_CASE` for global constants. Do NOT rename existing functions.
- **Context Isolation:** Do not modify unrelated files. Limit context to the task at hand.
- **Comments:** Do NOT remove existing comments or docstrings unless explicitly requested.
- **APIs:** Do NOT change existing APIs without explicit approval. 
- **No Guesses:** Always ask for missing information or context before making assumptions.

## 3. Architecture Principles
- **Separation of Concerns:** Don't mix API implementation with frontend components.
- **State Management:** Use robust, predictable state management in the frontend.
- **Caching & Performance:** Utilize Cloudflare edge caching, frontend lazy loading, optimized bundle sizes, and efficient DB queries.
- **Error Handling:** Centralized error formats and status codes across the API, combined with structured logging.

## 4. Security Rules (OWASP Top 10)
- **Input Validation:** Prevent SQL Injection, XSS, SSRF, and CSRF.
- **Authentication/Authorization:** Secure tokens, MFA support, proper session expiration policies, and role-based access.
- **Rate Limiting:** Enforced via SlowAPI (e.g., 20/minute chat limit).
- **Secrets Management:** Use environment variables. No hardcoded secrets. Cloudflare AI Gateway BYOK.
- **CORS:** Strict allow-list for origins.

## 5. Testing Requirements
- **Test Types:** Generate Unit Tests, Integration Tests, E2E Tests.
- **Coverage:** Test standard test cases and critical edge cases before implementation. Test-driven development is preferred.

## 6. The "Lazy AI" Prevention & Negative Constraints
- **NO PLACEHOLDERS:** Never use `// ... existing code ...`. Always output the complete file so it can be copy-pasted directly.
- **NO GUESSING:** If a route or file is missing from context, STOP and ask.
- **NO CONVERSATIONAL FILLER:** Output ONLY the requested code, diagrams, or technical explanations.

## 7. Approval & Workflow
- Design architecture completely (Folder, DB, API, Security) BEFORE writing code.
- Wait for explicit user approval after completing each major phase (Understanding, Identification, Design).