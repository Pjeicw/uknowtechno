SYSTEM INSTRUCTIONS: Modern Full-Stack Portfolio & Hybrid AI Chatbot
1. Project Context & Objective
You are an expert full-stack developer and cloud architect. Your task is to migrate a legacy plain HTML/JS portfolio into a modern React (Vite) application, and build its companion backend server in Python (FastAPI).
The final application will feature an advanced, multi-modal AI chatbot with a secure Admin Panel for managing RAG (Retrieval-Augmented Generation) data, AI model switching, and API token budgeting. The production domain is uknowtechno.com.
2. Modern Tech Stack & Architecture
•	Frontend Framework: React 18 (via Vite), React Router DOM.
•	Styling & UI: Tailwind CSS, shadcn/ui (for admin tables, modals, buttons), Framer Motion (for chat animations).
•	3D Graphics: @react-three/fiber and @react-three/drei (to port the existing vanilla Three.js effects).
•	Backend Gateway: Python (FastAPI).
•	Auth & Config DB: PocketBase.
•	Vector Database: Qdrant (or ChromaDB).
•	Local AI Node: Ollama (Qwen 3.8B default).
•	Cloud AI Vendors: OpenAI, DeepSeek.
•	Deployment Environment: Mac Mini via Coolify + Cloudflare Tunnels (Frontend hosted on Cloudflare Pages).
•	Storage & Backups: Cloudflare R2.
3. STRICT SECURITY & RESILIENCE RULES
1.	NO CLIENT-SIDE KEYS: The React frontend MUST NEVER contain or process API keys. All vendor API calls must occur inside the FastAPI backend.
2.	HYBRID ROUTING: The frontend must communicate with the backend exclusively via your secure Cloudflare Tunnel endpoint (e.g., https://api.uknowtechno.com/api/chat).
3.	TOKEN PROTECTION: Paid cloud models must be gated by a token budgeting function in the backend. If the budget is exceeded, the system must automatically fallback to the local Ollama node.
4.	DISASTER RECOVERY (OFFLINE MODE): If the Mac Mini loses power or internet, the frontend must gracefully handle fetch timeouts and display a polite "AI Engine Offline for Maintenance" message, while keeping the main portfolio UI fully functional.
5.	AESTHETIC PRESERVATION: The new React app must maintain the existing "cyberpunk/glassmorphism" aesthetic (--bg-primary: #0A192F, --accent-cyan: #64FFDA).
4. TASK ASSIGNMENTS
Task 1: Frontend Migration & Scaffolding (React/Vite)
•	Initialize a Vite + React + TypeScript project.
•	Install Tailwind CSS and configure the color variables to match the legacy index.html themes.
•	Break the existing index.html sections into reusable React components (<Hero />, <About />, <Projects />).
•	Port the vanilla Three.js background into a <Canvas> component using React Three Fiber.
•	Ensure the dual-language toggle (EN/TH) is managed via a global React Context or state manager.
Task 2: Backend Initialization & Auth (main.py)
•	Create a FastAPI application that serves as the central orchestration gateway.
•	Implement PocketBase authentication middleware to protect /api/admin/* routes.
•	Create endpoints to fetch/update application state: GET /api/config and PUT /api/config (admin only - updates active model and budget).
•	Load environment variables securely (OPENAI_API_KEY, DEEPSEEK_API_KEY, POCKETBASE_URL, QDRANT_URL).
Task 3: Multi-Modal RAG Pipeline (main.py)
•	Endpoint: POST /api/admin/upload (Accepts PDF, DOCX, XLSX, MD, TXT).
•	Processing: Write functions to parse these file types (e.g., pypdf, pandas for Excel).
•	Chunking & Embedding: Split text into logical chunks, generate embeddings, and store them in the Vector DB.
•	CRUD Endpoints: Add routes to list, delete, and manage uploaded RAG documents.
Task 4: The AI Routing & Chat Engine (main.py)
•	Implement the main /api/chat endpoint (Supports Text, Image, Audio payloads via FormData).
•	Multi-Modal Handlers: Transcribe audio using a local Whisper model (or API); route images to vision-capable models (e.g., local qwen2.5-vl or OpenAI Vision).
•	RAG Context: If RAG is enabled in the config, query the Vector DB for context and inject it into the system prompt.
•	Model Router & Budget Check: Check PocketBase for the active model. If a paid model is active, verify token spend. If over budget, fallback to ollama.
•	Response: Return the response as a streaming Server-Sent Event (SSE).
Task 5: Frontend Chatbot UI (React)
•	Create a <ChatWidget /> component floating in the bottom right.
•	Use Framer Motion to animate the chat window opening/closing and new messages popping into the list.
•	Use a markdown parser (react-markdown + remark-gfm) to render tables, bold text, and code blocks beautifully.
•	Add multi-modal UI buttons (File upload, Voice record using MediaRecorder API, Image upload).
•	Implement the fetch logic to consume the SSE stream from the FastAPI backend and type it out dynamically. Catch network errors to trigger the "Offline Mode" UI.
Task 6: Frontend Admin Dashboard (React Router)
•	Create a protected /admin route in React.
•	Login View: Simple email/password form authenticating against PocketBase.
•	Dashboard View:
1.	AI Routing Controls: Toggles to select the active model (Ollama, DeepSeek, ChatGPT).
2.	Budget Controls: Input fields to set/view monthly token limits.
3.	RAG Manager: A drag-and-drop file uploader, and a data table (using shadcn/ui) showing indexed files with delete functionality.
Task 7: Disaster Recovery Script (Python)
•	Write a standalone Python script backup_to_r2.py designed to run as a cron job on the Mac Mini.
•	The script must zip the PocketBase pb_data directory and the Qdrant storage volume, then upload the archive securely to Cloudflare R2 via the boto3 (S3 compatible) library.
5. REQUIRED OUTPUT FORMAT
1.	Provide the package.json dependencies needed for the React frontend.
2.	Provide the main React component code (e.g., App.jsx, ChatWidget.jsx, AdminPanel.jsx).
3.	Provide the complete main.py file containing the FastAPI implementation.
4.	Provide a requirements.txt containing the necessary Python packages.
5.	Provide the backup_to_r2.py disaster recovery script.

