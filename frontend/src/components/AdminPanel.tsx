import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Shield, Activity, Database, Server, BarChart2, Trash2, Search, Cpu, RefreshCw, CheckCircle, XCircle, FileText, UploadCloud, Layers, LogOut, Zap, AlertTriangle } from 'lucide-react';

// --- Config (env-driven; see frontend/.env.example) --------------------------
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000';
const POCKETBASE_URL = (import.meta as any).env?.VITE_POCKETBASE_URL || 'http://localhost:8090';
const PB_COLLECTION = (import.meta as any).env?.VITE_POCKETBASE_COLLECTION || '_superusers';

// Real chunk shape returned by GET /api/admin/rag
type RAGChunk = {
  chunk_id: string;
  content: string;
  section_title: string | null;
  document_title: string;
  kb_code: string;
  created_at: string;
  has_vector: number;
};

type ApiStatus = 'idle' | 'checking' | 'online' | 'offline';

export default function AdminPanel() {
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [showDev, setShowDev] = useState(false);

  // Model Settings (loaded from backend)
  const [activeModel, setActiveModel] = useState('ollama-local');
  const [deepseekLimit, setDeepseekLimit] = useState(10);
  const [chatgptLimit, setChatgptLimit] = useState(20);
  const [spend, setSpend] = useState<{ deepseek: number; openai: number; total: number }>({ deepseek: 0, openai: 0, total: 0 });

  // Local model routing map (G1) + Lao auto-routing (G2)
  const [localModels, setLocalModels] = useState({ coding: '', general: '', fast: '' });
  const [autoLao, setAutoLao] = useState(true);

  // Live model info + selection (redesign)
  const [modelsInfo, setModelsInfo] = useState<{ ollama_online: boolean; ollama_host: string; ollama_error: string | null; installed_models: string[]; providers: { deepseek: boolean; openai: boolean } }>({ ollama_online: false, ollama_host: '', ollama_error: null, installed_models: [], providers: { deepseek: false, openai: false } });
  const [modelMode, setModelMode] = useState<'auto' | 'manual'>('auto');
  const [localModelDefault, setLocalModelDefault] = useState('');

  // API status badges
  const [ollamaStatus, setOllamaStatus] = useState<ApiStatus>('idle');
  const [deepseekStatus, setDeepseekStatus] = useState<ApiStatus>('idle');
  const [chatgptStatus, setChatgptStatus] = useState<ApiStatus>('idle');

  // RAG state (real data)
  const [ragData, setRagData] = useState<RAGChunk[]>([]);
  const [ragStats, setRagStats] = useState<{ documents: number; chunks: number; vectors: number }>({ documents: 0, chunks: 0, vectors: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Authenticated fetch against the FastAPI gateway.
  const authFetch = useCallback((path: string, opts: RequestInit = {}) => {
    return fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
    });
  }, [token]);

  // --- Auth: log in against PocketBase, keep the token --------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${POCKETBASE_URL}/api/collections/${PB_COLLECTION}/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const data = await res.json();
      if (!data.token) throw new Error('No token returned');
      setToken(data.token);
      setIsAuthenticated(true);
    } catch (err) {
      setLoginError((err as Error).message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // Local-dev login: use the ADMIN_DEV_TOKEN you set in backend/.env.
  const devLogin = () => {
    if (!devToken.trim()) return;
    setToken(devToken.trim());
    setIsAuthenticated(true);
  };

  // --- Load config + usage once authenticated ----------------------------
  const loadConfig = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/config');
      if (!res.ok) return;
      const cfg = await res.json();
      setActiveModel(cfg.active_model || 'ollama-local');
      if (cfg.budgets) {
        if (typeof cfg.budgets.deepseek === 'number') setDeepseekLimit(cfg.budgets.deepseek);
        if (typeof cfg.budgets.openai === 'number') setChatgptLimit(cfg.budgets.openai);
      }
      if (cfg.local_models) {
        setLocalModels({
          coding: cfg.local_models.coding || '',
          general: cfg.local_models.general || '',
          fast: cfg.local_models.fast || '',
        });
      }
      if (typeof cfg.auto_lao_to_smart === 'boolean') setAutoLao(cfg.auto_lao_to_smart);
    } catch { /* offline */ }
  }, [authFetch]);

  const loadModels = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/models');
      if (!res.ok) return;
      const data = await res.json();
      setModelsInfo({
        ollama_online: data.ollama_online,
        ollama_host: data.ollama_host || '',
        ollama_error: data.ollama_error || null,
        installed_models: data.installed_models || [],
        providers: data.providers || { deepseek: false, openai: false },
      });
      if (data.config) {
        setModelMode(data.config.model_mode || 'auto');
        setLocalModelDefault(data.config.local_model_default || '');
      }
    } catch { /* offline */ }
  }, [authFetch]);

  // Change which local model is used: picking a model = manual; 'auto' = routing.
  const selectModel = async (value: string) => {
    const mode = value === 'auto' ? 'auto' : 'manual';
    setModelMode(mode);
    setLocalModelDefault(mode === 'manual' ? value : '');
    try {
      await authFetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_mode: mode, local_model_default: mode === 'manual' ? value : '' }),
      });
    } catch (e) { console.error('Failed to select model', e); }
  };

  const loadUsage = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/usage');
      if (!res.ok) return;
      const data = await res.json();
      if (data.month_spend) setSpend(data.month_spend);
    } catch { /* offline */ }
  }, [authFetch]);

  const loadChunks = useCallback(async () => {
    try {
      const res = await authFetch(`/api/admin/rag?q=${encodeURIComponent(searchTerm)}&limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      setRagData(data.chunks || []);
      if (data.stats) setRagStats(data.stats);
    } catch { /* offline */ }
  }, [authFetch, searchTerm]);

  // If the chat's admin login saved a token, start already authenticated.
  useEffect(() => {
    const saved = localStorage.getItem('admin_token');
    if (saved) {
      setToken(saved);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadConfig();
    loadUsage();
    loadModels();
  }, [isAuthenticated, loadConfig, loadUsage, loadModels]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'models') loadModels();
  }, [isAuthenticated, activeTab, loadModels]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'rag') loadChunks();
  }, [isAuthenticated, activeTab, loadChunks]);

  // --- Model routing + budgets -------------------------------------------
  const updateModelConfig = async (model: string) => {
    setActiveModel(model);
    try {
      await authFetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_model: model }),
      });
    } catch (e) { console.error('Failed to update model', e); }
  };

  const saveBudgets = async () => {
    try {
      await authFetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgets: { deepseek: deepseekLimit, openai: chatgptLimit } }),
      });
      loadUsage();
    } catch (e) { console.error('Failed to save budgets', e); }
  };

  const saveRouting = async (nextAutoLao?: boolean) => {
    try {
      await authFetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          local_models: localModels,
          auto_lao_to_smart: nextAutoLao !== undefined ? nextAutoLao : autoLao,
        }),
      });
    } catch (e) { console.error('Failed to save routing', e); }
  };

  const checkStatus = async (model: string) => {
    const setStatus = model === 'ollama' ? setOllamaStatus : model === 'deepseek' ? setDeepseekStatus : setChatgptStatus;
    setStatus('checking');
    try {
      // Real backend reachability via the public config endpoint.
      const res = await fetch(`${API_BASE}/api/config`);
      setStatus(res.ok ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  };

  // --- RAG actions (real) -------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    setBusyMsg(`Uploading & embedding "${file.name}"...`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Upload failed (${res.status})`);
      setBusyMsg(`Stored ${data.chunks_stored} chunk(s) from ${data.filename}.`);
      await loadChunks();
    } catch (err) {
      setBusyMsg(`Error: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setBusyMsg(''), 4000);
    }
  };

  const handleDeleteChunk = async (id: string) => {
    if (!confirm('Permanently delete this vector chunk?')) return;
    try {
      const res = await authFetch(`/api/admin/rag/${id}`, { method: 'DELETE' });
      if (res.ok) setRagData((prev) => prev.filter((c) => c.chunk_id !== id));
    } catch (e) { console.error('Delete failed', e); }
  };

  const handleBackfill = async () => {
    setBusyMsg('Backfilling embeddings (batch of 100)...');
    try {
      const res = await authFetch('/api/admin/rag/backfill?limit=100', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Backfill failed');
      setBusyMsg(`Embedded ${data.embedded}; ${data.remaining} remaining.`);
      await loadChunks();
    } catch (err) {
      setBusyMsg(`Error: ${(err as Error).message}`);
    } finally {
      setTimeout(() => setBusyMsg(''), 5000);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Purge ALL chunks + vectors? This clears the knowledge base. Cannot be undone.')) return;
    setBusyMsg('Purging knowledge base...');
    try {
      const res = await authFetch('/api/admin/rag/purge', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Purge failed');
      setBusyMsg(`Purged ${data.deleted_chunks} chunk(s).`);
      await loadChunks();
    } catch (err) {
      setBusyMsg(`Error: ${(err as Error).message}`);
    } finally {
      setTimeout(() => setBusyMsg(''), 4000);
    }
  };

  const StatusBadge = ({ status, onCheck }: { status: ApiStatus, onCheck: () => void }) => (
    <button
      onClick={onCheck}
      disabled={status === 'checking'}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm disabled:opacity-70 bg-[#0f172a] hover:bg-[#1e293b]"
      style={{
        borderColor: status === 'online' ? 'rgba(34,197,94,0.3)' : status === 'offline' ? 'rgba(239,68,68,0.3)' : status === 'checking' ? 'rgba(234,179,8,0.3)' : 'rgba(148,163,184,0.3)',
        color: status === 'online' ? '#4ade80' : status === 'offline' ? '#f87171' : status === 'checking' ? '#facc15' : '#94a3b8'
      }}
    >
      {status === 'idle' && <><RefreshCw size={12} /> CHECK STATUS</>}
      {status === 'checking' && <><RefreshCw size={12} className="animate-spin" /> PINGING...</>}
      {status === 'online' && <><CheckCircle size={12} /> ONLINE</>}
      {status === 'offline' && <><XCircle size={12} /> OFFLINE</>}
    </button>
  );

  if (!isAuthenticated) {
    return (
      <div className="fixed bottom-8 right-8 z-50 flex">
        <div className="glass-panel p-8 w-full max-w-md shadow-[0_0_50px_rgba(100,255,218,0.1)] backdrop-blur-xl border border-[var(--accent-cyan)]/20 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[var(--accent-cyan)]/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>

          <div className="w-20 h-20 rounded-2xl bg-[#112240] border border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(100,255,218,0.2)]">
            <Shield size={40} className="animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--accent-cyan)] mb-8 text-center tracking-widest drop-shadow-[0_0_10px_rgba(100,255,218,0.5)]"> {t('adminSystemAdmin')} </h2>
          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            <div>
              <label className="block text-[var(--accent-cyan)]/80 mb-2 text-xs font-black tracking-widest"> {t('adminSecureId')} </label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#0a192f]/80 backdrop-blur-sm border border-[#1e293b] rounded-xl p-3 text-white outline-none focus:border-[var(--accent-cyan)] focus:shadow-[0_0_15px_rgba(100,255,218,0.2)] transition-all" placeholder="admin@uknowtechno.com" />
            </div>
            <div>
              <label className="block text-[var(--accent-cyan)]/80 mb-2 text-xs font-black tracking-widest"> {t('adminPassphrase')} </label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#0a192f]/80 backdrop-blur-sm border border-[#1e293b] rounded-xl p-3 text-white outline-none focus:border-[var(--accent-cyan)] focus:shadow-[0_0_15px_rgba(100,255,218,0.2)] transition-all" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" />
            </div>
            {loginError && (
              <div className="text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                <XCircle size={14} /> {loginError}
              </div>
            )}
            <button type="submit" disabled={loginLoading} className="w-full py-4 mt-6 bg-[var(--accent-cyan)] text-[#0a192f] rounded-xl font-black tracking-widest hover:scale-105 hover:shadow-[0_0_30px_rgba(100,255,218,0.5)] transition-all disabled:opacity-60">
              {loginLoading ? 'CONNECTING...' : t('adminInitConnection')}
            </button>
          </form>

          {/* Local-dev access (no PocketBase needed) */}
          <div className="mt-6 pt-5 border-t border-[#1e293b] relative z-10">
            <button type="button" onClick={() => setShowDev((s) => !s)} className="text-xs text-gray-500 hover:text-[var(--accent-cyan)] font-bold tracking-widest transition-colors">
              {showDev ? 'â–¾' : 'â–¸'} LOCAL DEV ACCESS
            </button>
            {showDev && (
              <div className="mt-3 flex gap-2">
                <input type="password" value={devToken} onChange={(e) => setDevToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && devLogin()} placeholder="ADMIN_DEV_TOKEN from backend/.env" className="flex-1 bg-[#0a192f]/80 border border-[#1e293b] rounded-lg p-2.5 text-white text-sm outline-none focus:border-[var(--accent-cyan)]" />
                <button type="button" onClick={devLogin} className="px-4 bg-[#1e293b] text-[var(--accent-cyan)] rounded-lg font-bold text-sm hover:bg-[var(--accent-cyan)] hover:text-[#0a192f] transition-all">ENTER</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const filteredRagData = ragData.filter(c =>
    c.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.document_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.section_title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col md:flex-row w-full h-full min-h-[600px] md:max-h-[850px] gap-4 md:gap-8 max-w-[1500px] mx-auto relative z-10 px-1 md:px-8 justify-center">
      {/* Sidebar Navigation â€” becomes a horizontal tab bar on phones */}
      <div className="w-full md:w-72 shrink-0 flex flex-row md:flex-col gap-2 md:gap-4 overflow-x-auto md:overflow-visible">
        <h2 className="hidden md:flex text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--accent-cyan)] mb-8 px-4 items-center gap-4 drop-shadow-[0_0_10px_rgba(100,255,218,0.3)]">
          <Server className="text-[var(--accent-cyan)]" size={32} /> ADMIN
        </h2>

        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 md:gap-4 p-3 md:p-5 rounded-2xl font-black tracking-widest transition-all text-xs md:text-sm whitespace-nowrap shrink-0 ${activeTab === 'dashboard' ? 'bg-[var(--accent-cyan)] text-[#0a192f] shadow-[0_0_30px_rgba(100,255,218,0.4)] scale-105' : 'bg-[#112240]/60 text-gray-400 hover:bg-[#1e293b] hover:text-white border border-[#1e293b] hover:border-[var(--accent-cyan)]/30'}`}>
          <Activity size={22} /> {t('adminDashboard')} </button>
        <button onClick={() => setActiveTab('models')} className={`flex items-center gap-2 md:gap-4 p-3 md:p-5 rounded-2xl font-black tracking-widest transition-all text-xs md:text-sm whitespace-nowrap shrink-0 ${activeTab === 'models' ? 'bg-[var(--accent-cyan)] text-[#0a192f] shadow-[0_0_30px_rgba(100,255,218,0.4)] scale-105' : 'bg-[#112240]/60 text-gray-400 hover:bg-[#1e293b] hover:text-white border border-[#1e293b] hover:border-[var(--accent-cyan)]/30'}`}>
          <BarChart2 size={22} /> {t('adminAiModels')} </button>
        <button onClick={() => setActiveTab('rag')} className={`flex items-center gap-2 md:gap-4 p-3 md:p-5 rounded-2xl font-black tracking-widest transition-all text-xs md:text-sm whitespace-nowrap shrink-0 ${activeTab === 'rag' ? 'bg-[var(--accent-cyan)] text-[#0a192f] shadow-[0_0_30px_rgba(100,255,218,0.4)] scale-105' : 'bg-[#112240]/60 text-gray-400 hover:bg-[#1e293b] hover:text-white border border-[#1e293b] hover:border-[var(--accent-cyan)]/30'}`}>
          <Database size={22} /> {t('adminKnowledge')} </button>

        <div className="mt-auto">
          <button onClick={() => { setIsAuthenticated(false); setToken(''); localStorage.removeItem('admin_token'); }} className="flex w-full items-center gap-4 p-5 rounded-2xl font-black tracking-widest transition-all text-sm bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-[#0a192f] border border-red-500/30 hover:shadow-[0_0_20px_rgba(248,113,113,0.5)] mt-4">
            <LogOut size={22} /> {t('adminSignOut')} </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#0a192f]/90 backdrop-blur-xl rounded-[2rem] border border-[var(--accent-cyan)]/10 p-4 md:p-10 overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent-cyan)]/5 to-transparent pointer-events-none rounded-[2rem]"></div>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease-out] relative z-10">
            <h3 className="text-4xl font-black text-white mb-10 tracking-widest border-b border-[#1e293b] pb-6"> {t('adminSystemOverview')} </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-8 rounded-3xl border border-[var(--accent-cyan)]/20 shadow-xl group hover:-translate-y-2 transition-all">
                <div className="text-[var(--accent-cyan)] mb-6 bg-[var(--accent-cyan)]/10 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all"><Server size={32} /></div>
                <div className="text-5xl font-black text-white mb-3">{ragStats.documents}</div>
                <div className="text-sm text-[var(--accent-cyan)]/80 font-black tracking-widest">DOCUMENTS</div>
              </div>
              <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-8 rounded-3xl border border-blue-400/20 shadow-xl group hover:-translate-y-2 transition-all">
                <div className="text-blue-400 mb-6 bg-blue-400/10 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all"><Layers size={32} /></div>
                <div className="text-5xl font-black text-white mb-3">{ragStats.vectors}<span className="text-2xl text-gray-500"> / {ragStats.chunks}</span></div>
                <div className="text-sm text-blue-400/80 font-black tracking-widest">VECTORS / CHUNKS</div>
              </div>
              <div className="bg-gradient-to-br from-[#112240] to-[#0a192f] p-8 rounded-3xl border border-purple-400/20 shadow-xl group hover:-translate-y-2 transition-all">
                <div className="text-purple-400 mb-6 bg-purple-400/10 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all"><Cpu size={32} /></div>
                <div className="text-4xl font-black text-white mb-3 capitalize">{activeModel.replace('-', ' ')}</div>
                <div className="text-sm text-purple-400/80 font-black tracking-widest"> {t('adminActiveLlmRoute')} </div>
              </div>
            </div>
            {ragStats.vectors < ragStats.chunks && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 flex items-center justify-between">
                <div className="text-yellow-300 font-bold flex items-center gap-3"><AlertTriangle size={20} /> {ragStats.chunks - ragStats.vectors} chunk(s) have no embedding yet.</div>
                <button onClick={handleBackfill} className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500 hover:text-[#0a192f] px-5 py-2.5 rounded-xl font-black tracking-widest text-sm transition-all"><Zap size={16} /> BACKFILL</button>
              </div>
            )}
          </div>
        )}

        {/* MODELS & BUDGET TAB */}
        {activeTab === 'models' && (
          <div className="space-y-10 animate-[fadeIn_0.3s_ease-out] relative z-10">
            <h3 className="text-4xl font-black text-white tracking-widest border-b border-[#1e293b] pb-6"> {t('adminAiRouting')} </h3>

            {/* Active model selector â€” live installed-model dropdown */}
            <div className="bg-[#112240]/80 backdrop-blur-xl p-8 rounded-[2rem] border border-[var(--accent-cyan)]/40">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h4 className="text-2xl font-black text-white tracking-widest flex items-center gap-3"><Cpu className="text-[var(--accent-cyan)]" size={24} /> ACTIVE MODEL</h4>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border ${modelsInfo.ollama_online ? 'text-green-400 border-green-500/40 bg-green-500/10' : 'text-red-400 border-red-500/40 bg-red-500/10'}`}>
                    {modelsInfo.ollama_online ? <CheckCircle size={14} /> : <XCircle size={14} />} Ollama {modelsInfo.ollama_online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-black border ${modelsInfo.providers.deepseek ? 'text-blue-400 border-blue-500/40 bg-blue-500/10' : 'text-gray-500 border-gray-600/40'}`}>DeepSeek key {modelsInfo.providers.deepseek ? 'âœ“' : 'âœ•'}</span>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-black border ${modelsInfo.providers.openai ? 'text-purple-400 border-purple-500/40 bg-purple-500/10' : 'text-gray-500 border-gray-600/40'}`}>OpenAI key {modelsInfo.providers.openai ? 'âœ“' : 'âœ•'}</span>
                  <button onClick={loadModels} className="p-2 text-gray-400 hover:text-[var(--accent-cyan)] transition-colors" title="Refresh"><RefreshCw size={16} /></button>
                </div>
              </div>

              <label className="block text-xs font-black text-[var(--accent-cyan)] mb-2 tracking-widest uppercase">Which model answers chats</label>
              <select
                value={modelMode === 'auto' ? 'auto' : localModelDefault}
                onChange={(e) => selectModel(e.target.value)}
                className="w-full bg-[#0a192f] border border-[#1e293b] rounded-xl p-4 text-white font-bold outline-none focus:border-[var(--accent-cyan)] transition-all cursor-pointer"
              >
                <option value="auto">ðŸ¤– Auto â€” smart use-case routing (codingâ†’coder, Laoâ†’cloud)</option>
                {modelsInfo.installed_models.length > 0 && (
                  <optgroup label="Your installed Ollama models">
                    {modelsInfo.installed_models.map((m) => <option key={m} value={m}>ðŸ’» {m} (always use this)</option>)}
                  </optgroup>
                )}
              </select>

              {!modelsInfo.ollama_online && (
                <div className="mt-4 text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  Ollama isn't reachable at <span className="font-mono">{modelsInfo.ollama_host || 'the configured host'}</span>. Chats will fall back to DeepSeek â†’ OpenAI automatically. Start Ollama on your ASUS (and check <span className="font-mono">OLLAMA_API_URL</span>) to use local models.
                </div>
              )}
              <p className="mt-4 text-xs text-gray-500">Failover order: <span className="text-gray-300 font-mono">{modelMode === 'manual' ? localModelDefault : 'auto-local'} â†’ deepseek â†’ openai</span>. Cloud tiers are skipped when over budget.</p>
            </div>

            {/* Local model routing map (G1) + Lao auto-route (G2) â€” only relevant in Auto */}
            <div className="bg-[#112240]/80 backdrop-blur-xl p-8 rounded-[2rem] border border-[var(--accent-cyan)]/30">
              <h4 className="text-2xl font-black text-white tracking-widest mb-2 flex items-center gap-3"><Cpu className="text-[var(--accent-cyan)]" size={24} /> USE-CASE ROUTING <span className={`text-xs px-2 py-1 rounded ${modelMode === 'auto' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-500'}`}>{modelMode === 'auto' ? 'ACTIVE' : 'Auto mode only'}</span></h4>
              <p className="text-gray-400 text-sm mb-6">When Active Model is set to <b>Auto</b>, these decide which local model handles each kind of question. Must match a model you've pulled.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                {([['coding', 'Coding questions'], ['general', 'General chat'], ['fast', 'Fast / simple']] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-black text-[var(--accent-cyan)] mb-2 tracking-widest uppercase">{label}</label>
                    <input
                      type="text"
                      value={(localModels as any)[key]}
                      onChange={(e) => setLocalModels((m) => ({ ...m, [key]: e.target.value }))}
                      onBlur={() => saveRouting()}
                      placeholder={key === 'coding' ? 'qwen2.5-coder:7b' : key === 'general' ? 'llama3.2:3b' : 'deepseek-r1:1.5b'}
                      className="w-full bg-[#0a192f] border border-[#1e293b] rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-[var(--accent-cyan)] transition-all"
                    />
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-3 cursor-pointer text-gray-300 font-bold">
                <input type="checkbox" checked={autoLao} onChange={(e) => { setAutoLao(e.target.checked); saveRouting(e.target.checked); }} className="accent-[var(--accent-cyan)] scale-125" />
                Auto-route Lao-language questions to the smart cloud model (OpenAI)
              </label>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {/* Ollama Local */}
              <div className="bg-[#112240]/80 backdrop-blur-xl p-5 md:p-10 rounded-[2rem] border border-green-500/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 flex flex-col items-end gap-4">
                  <div className="px-5 py-2.5 bg-green-500/20 text-green-400 rounded-full text-sm font-black tracking-widest border border-green-500/50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="activeModel" checked={activeModel === 'ollama-local'} onChange={() => updateModelConfig('ollama-local')} className="accent-green-500 scale-150" /> {t('adminActiveFree')} </label>
                  </div>
                  <StatusBadge status={ollamaStatus} onCheck={() => checkStatus('ollama')} />
                </div>
                <div className="flex items-center gap-8 mb-6">
                  <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center text-green-400"><Cpu size={40} /></div>
                  <div>
                    <h4 className="text-3xl font-black text-white tracking-widest mb-2">Ollama Local</h4>
                    <p className="text-gray-400 font-bold tracking-wide">Privacy First â€¢ Free</p>
                  </div>
                </div>
              </div>

              {/* DeepSeek API */}
              <div className="bg-[#112240]/80 backdrop-blur-xl p-5 md:p-10 rounded-[2rem] border border-blue-500/30 relative group">
                <div className="absolute top-0 right-0 p-8 flex flex-col items-end gap-4">
                  <div className="px-5 py-2.5 bg-blue-500/10 text-blue-400 rounded-full text-sm font-black tracking-widest border border-blue-500/30">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="activeModel" checked={activeModel === 'deepseek'} onChange={() => updateModelConfig('deepseek')} className="accent-blue-500 scale-150" /> {t('adminRouteTarget')} </label>
                  </div>
                  <StatusBadge status={deepseekStatus} onCheck={() => checkStatus('deepseek')} />
                </div>
                <div className="flex items-center gap-8 mb-10">
                  <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-400"><Activity size={40} /></div>
                  <div>
                    <h4 className="text-3xl font-black text-white tracking-widest mb-2">DeepSeek API</h4>
                    <p className="text-gray-400 font-bold tracking-wide">deepseek-chat â€¢ Cloud Reasoning</p>
                  </div>
                </div>
                <div className="mb-10 bg-[#0a192f] p-5 rounded-2xl border border-[#1e293b] inline-block shadow-inner">
                  <label className="block text-xs font-black text-gray-500 mb-3 tracking-widest"> {t('adminMonthlyBudgetLimit')} </label>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl text-[var(--accent-cyan)] font-black">$</span>
                    <input type="number" value={deepseekLimit} onChange={(e) => setDeepseekLimit(Number(e.target.value))} onBlur={saveBudgets} className="w-32 bg-transparent text-4xl font-black text-white outline-none" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-4 font-black tracking-widest">
                    <span className="text-gray-500"> {t('adminCurrentSpend')} </span>
                    <span className="text-white">${spend.deepseek.toFixed(2)} <span className="text-gray-600">/ ${deepseekLimit.toFixed(2)}</span></span>
                  </div>
                  <div className="w-full h-5 bg-[#0a192f] rounded-full overflow-hidden border border-[#1e293b] shadow-inner">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500" style={{ width: `${Math.min((spend.deepseek / (deepseekLimit || 1)) * 100, 100)}%` }}></div>
                  </div>
                </div>
              </div>

              {/* OpenAI API */}
              <div className="bg-[#112240]/80 backdrop-blur-xl p-5 md:p-10 rounded-[2rem] border border-purple-500/30 relative group">
                <div className="absolute top-0 right-0 p-8 flex flex-col items-end gap-4">
                  <div className="px-5 py-2.5 bg-purple-500/10 text-purple-400 rounded-full text-sm font-black tracking-widest border border-purple-500/30">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="activeModel" checked={activeModel === 'openai'} onChange={() => updateModelConfig('openai')} className="accent-purple-500 scale-150" /> {t('adminRouteTarget')} </label>
                  </div>
                  <StatusBadge status={chatgptStatus} onCheck={() => checkStatus('chatgpt')} />
                </div>
                <div className="flex items-center gap-8 mb-10">
                  <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-400"><Activity size={40} /></div>
                  <div>
                    <h4 className="text-3xl font-black text-white tracking-widest mb-2">OpenAI ChatGPT API</h4>
                    <p className="text-gray-400 font-bold tracking-wide">gpt-4o-mini â€¢ Cloud Fallback</p>
                  </div>
                </div>
                <div className="mb-10 bg-[#0a192f] p-5 rounded-2xl border border-[#1e293b] inline-block shadow-inner">
                  <label className="block text-xs font-black text-gray-500 mb-3 tracking-widest"> {t('adminMonthlyBudgetLimit')} </label>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl text-[var(--accent-cyan)] font-black">$</span>
                    <input type="number" value={chatgptLimit} onChange={(e) => setChatgptLimit(Number(e.target.value))} onBlur={saveBudgets} className="w-32 bg-transparent text-4xl font-black text-white outline-none" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-4 font-black tracking-widest">
                    <span className="text-gray-500"> {t('adminCurrentSpend')} </span>
                    <span className="text-white">${spend.openai.toFixed(2)} <span className="text-gray-600">/ ${chatgptLimit.toFixed(2)}</span></span>
                  </div>
                  <div className="w-full h-5 bg-[#0a192f] rounded-full overflow-hidden border border-[#1e293b] shadow-inner">
                    <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500" style={{ width: `${Math.min((spend.openai / (chatgptLimit || 1)) * 100, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RAG DB MANAGER TAB */}
        {activeTab === 'rag' && (
          <div className="space-y-8 h-full flex flex-col animate-[fadeIn_0.3s_ease-out] relative z-10">
            <div className="flex justify-between items-center bg-gradient-to-r from-[#112240] to-transparent p-8 rounded-3xl border border-[var(--accent-cyan)]/20 shadow-lg">
              <div>
                <h3 className="text-4xl font-black text-white tracking-widest mb-2"> {t('adminKnowledgeBase')} </h3>
                <p className="text-[var(--accent-cyan)] font-black tracking-widest text-sm">{ragStats.vectors} / {ragStats.chunks} chunks embedded</p>
              </div>
              <div className="flex gap-3">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.md,.txt,.xlsx,.csv,.docx" />
                <button onClick={handleBackfill} className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500 hover:text-[#0a192f] px-5 py-4 rounded-2xl font-black tracking-widest transition-all" title="Embed chunks that have no vector"><Zap size={20} /> BACKFILL</button>
                <button onClick={handlePurge} className="flex items-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-[#0a192f] border border-red-500/30 px-5 py-4 rounded-2xl font-black tracking-widest transition-all" title="Delete all chunks"><AlertTriangle size={20} /> PURGE</button>
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-3 bg-[var(--accent-cyan)] text-[#0a192f] px-8 py-4 rounded-2xl font-black tracking-widest hover:scale-105 transition-all disabled:opacity-50">
                  <UploadCloud size={24} /> {isUploading ? 'WORKING...' : t('adminSmartUpload')} </button>
              </div>
            </div>

            {busyMsg && (
              <div className="bg-[#112240] border border-[var(--accent-cyan)]/40 rounded-2xl p-5 text-[var(--accent-cyan)] font-bold flex items-center gap-3">
                {isUploading && <RefreshCw size={18} className="animate-spin" />} {busyMsg}
              </div>
            )}

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--accent-cyan)]" size={24} />
              <input type="text" placeholder={t('adminSearch')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#112240]/90 backdrop-blur border border-[#1e293b] hover:border-[var(--accent-cyan)]/50 rounded-2xl py-5 pl-16 pr-6 text-white font-bold tracking-wide outline-none focus:border-[var(--accent-cyan)] transition-all text-lg shadow-inner" />
            </div>

            {/* Table */}
            <div className="flex-1 bg-[#112240]/70 backdrop-blur-xl rounded-[2rem] border border-[var(--accent-cyan)]/20 overflow-hidden flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.4)]">
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-separate border-spacing-y-4">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 text-sm font-black text-gray-500 tracking-[0.2em] border-b-2 border-[#1e293b] uppercase w-1/3"> {t('adminHierarchy')} </th>
                      <th className="px-6 py-4 text-sm font-black text-gray-500 tracking-[0.2em] border-b-2 border-[#1e293b] uppercase w-1/2"> {t('adminVectorPayload')} </th>
                      <th className="px-6 py-4 text-sm font-black text-gray-500 tracking-[0.2em] border-b-2 border-[#1e293b] uppercase text-right w-1/6"> {t('adminActions')} </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRagData.map(chunk => (
                      <tr key={chunk.chunk_id} className="group hover:-translate-y-1 transition-all duration-300">
                        <td className="p-6 bg-[#0a192f] rounded-l-[1.5rem] border-y border-l border-[#1e293b] group-hover:border-[var(--accent-cyan)]/50 transition-colors align-top shadow-md">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-xs font-black text-[#0a192f] font-mono bg-[var(--accent-cyan)] w-fit px-3 py-1 rounded-md">
                              <FileText size={14} /> {chunk.document_title}
                            </div>
                            <div className="text-gray-400 font-bold text-sm pl-4 border-l-2 border-[#1e293b] ml-1 flex items-center gap-2 mt-2">
                              {chunk.section_title || chunk.kb_code}
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <span className={`text-xs font-mono px-2 py-1 rounded ${chunk.has_vector ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {chunk.has_vector ? 'â— vector' : 'â—‹ no vector'}
                              </span>
                              <span className="font-mono text-xs text-gray-600 bg-[#112240] px-2 py-1 rounded">{chunk.chunk_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6 bg-[#0a192f] border-y border-[#1e293b] group-hover:border-[var(--accent-cyan)]/50 transition-colors align-top shadow-md">
                          <div className="text-gray-300 font-mono text-base leading-relaxed line-clamp-4 bg-[#112240]/50 p-4 rounded-xl border border-[#1e293b]" title={chunk.content}>
                            {chunk.content}
                          </div>
                        </td>
                        <td className="p-6 bg-[#0a192f] rounded-r-[1.5rem] border-y border-r border-[#1e293b] group-hover:border-[var(--accent-cyan)]/50 transition-colors text-right align-middle shadow-md">
                          <button onClick={() => handleDeleteChunk(chunk.chunk_id)} className="flex items-center justify-center gap-2 w-32 py-3 text-sm font-black tracking-widest text-red-400 bg-red-400/10 hover:bg-red-400 hover:text-[#0a192f] rounded-xl border border-red-400/50 transition-all ml-auto">
                            <Trash2 size={16} /> {t('adminPurge')} </button>
                        </td>
                      </tr>
                    ))}
                    {filteredRagData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-16 text-center bg-[#0a192f] rounded-[1.5rem] border border-[#1e293b]">
                          <Layers className="mx-auto text-[var(--accent-cyan)]/30 mb-6" size={64} />
                          <div className="text-white font-black tracking-widest mb-3 text-2xl"> {t('adminNoData')} </div>
                          <div className="text-base text-gray-500 font-medium"> {t('adminUploadDoc')} </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
