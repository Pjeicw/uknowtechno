import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, X, Send, Paperclip, Mic, Maximize2, Minimize2, PanelLeftClose, PanelLeft, Plus, Edit2, Trash2, Check, Copy, Share2, Settings, Sparkles, ChevronLeft, ShieldCheck, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import AdminPanel from './AdminPanel';

type Message = { role: 'user' | 'ai'; content: string };
type Thread = { id: string; title: string; messages: Message[] };

// Central API base — override with VITE_API_BASE in production (e.g. https://api.uknowtechno.com)
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000';
// PocketBase (admin login straight from the chat settings)
const POCKETBASE_URL = (import.meta as any).env?.VITE_POCKETBASE_URL || 'http://localhost:8090';
const PB_COLLECTION = (import.meta as any).env?.VITE_POCKETBASE_COLLECTION || '_superusers';
// How long to wait for the backend to START responding before treating it as offline.
const CONNECT_TIMEOUT_MS = 15000;

export default function ChatWidget() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Sidebar starts closed on phones (it would cover most of the screen).
  const [showSidebar, setShowSidebar] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  // On phones the sidebar overlays the chat, so close it after any pick.
  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setShowSidebar(false);
  };
  
  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = localStorage.getItem('ai_chat_threads');
    if (saved) return JSON.parse(saved);
    return [{ id: Date.now().toString(), title: t('chatNewChat'), messages: [] }];
  });
  
  const [currentThreadId, setCurrentThreadId] = useState<string>(threads[0]?.id || '');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeModelConfig, setActiveModelConfig] = useState('Loading...');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [smartMode, setSmartMode] = useState(false);  // route this turn to the smart model (G2)

  type ModelOption = { id: string; label: string; locked?: boolean; online?: boolean };
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([{ id: 'deepseek', label: 'DeepSeek' }]);
  const [kbOptions, setKbOptions] = useState<{ code: string; label: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState('deepseek');
  const [selectedKbs, setSelectedKbs] = useState<string[]>([]);
  const toggleKb = (code: string) =>
    setSelectedKbs((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  // Admin login (revealed on click inside AI settings)
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  // Admin panel now renders inline as an overlay instead of a separate /admin route.
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      const data = await res.json();
      if (data.status === 'fallback') {
        setActiveModelConfig(`${data.model} (Fallback: ${data.actual})`);
        setFallbackReason(data.reason || "Connection Timeout");
      } else {
        setActiveModelConfig(data.model);
        setFallbackReason(null);
      }
    } catch (e) {
      setActiveModelConfig('Offline');
      setFallbackReason("Backend Server Offline");
    }
  }, []);

  const fetchPickers = useCallback(async () => {
    try {
      // Admin token (from the settings login) outranks a staff token: it
      // unlocks OpenAI and full knowledge access.
      const bearer = localStorage.getItem('admin_token') || localStorage.getItem('staff_token');
      const authHeaders: Record<string, string> = bearer ? { Authorization: `Bearer ${bearer}` } : {};
      const [mRes, kRes] = await Promise.all([
        fetch(`${API_BASE}/api/models`),
        fetch(`${API_BASE}/api/knowledge`, { headers: authHeaders }),
      ]);
      if (mRes.ok) {
        const m = await mRes.json();
        const opts: ModelOption[] = [];
        for (const c of m.cloud || []) {
          if (c.id === 'deepseek') opts.push({ id: c.id, label: `${c.label} · default` });
        }
        for (const id of m.ollama_models || []) opts.push({ id, label: `Ollama — ${id}`, online: true });
        for (const c of m.cloud || []) {
          // OpenAI shows unlocked once an admin token is stored (the backend
          // still verifies the token on every chat request).
          const adminUnlocked = !!localStorage.getItem('admin_token');
          if (c.id === 'openai') opts.push({ id: c.id, label: c.label, locked: !!c.locked && !adminUnlocked });
        }
        setModelOptions(opts.length ? opts : [{ id: 'deepseek', label: 'DeepSeek · default' }]);
      }
      if (kRes.ok) {
        const k = await kRes.json();
        setKbOptions(k.knowledge_bases || []);
      }
    } catch { /* offline: keep defaults */ }
  }, []);

  // Save the token and open the admin panel as an inline overlay (no /admin route).
  const openAdmin = (token: string) => {
    localStorage.setItem('admin_token', token);
    setShowAdminPanel(true);
    setShowSettingsModal(false);
    setAdminEmail('');
    setAdminPassword('');
    setShowAdminLogin(false);
  };

  const handleAdminLogin = async () => {
    setAdminError('');
    setAdminBusy(true);
    try {
      // The #1 real cause of "unreachable" when PocketBase is *actually*
      // running (confirmed via its own /_/ admin UI): the site is being
      // viewed over https (production, e.g. https://uknowtechno.com) while
      // VITE_POCKETBASE_URL is still the http://localhost:8090 build
      // default. Browsers silently block that as mixed content — it fails
      // as a plain network error with no explanation, which is exactly
      // what "can't reach the auth server" looked like. Catch it up front
      // with a specific, actionable message instead of trying and failing.
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && POCKETBASE_URL.startsWith('http://')) {
        throw new Error(
          `This page is loaded over https, but the auth server URL (${POCKETBASE_URL}) is http — browsers block that as "mixed content" (it never even reaches PocketBase). ` +
          `PocketBase running fine locally doesn't fix this: the production build needs VITE_POCKETBASE_URL set to an https address (e.g. https://auth.uknowtechno.com via the Cloudflare Tunnel from DEPLOY.md), then rebuilt and redeployed.`
        );
      }

      let res: Response;
      try {
        res = await fetch(`${POCKETBASE_URL}/api/collections/${PB_COLLECTION}/auth-with-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: adminEmail, password: adminPassword }),
        });
      } catch {
        // fetch() itself throwing (and it's not the mixed-content case
        // above) means the request never reached PocketBase at all — wrong
        // port/host, PocketBase not running, CORS blocked, or offline.
        throw new Error(
          `Can't reach the auth server at ${POCKETBASE_URL}. Double-check: is PocketBase actually running there (not just reachable at 127.0.0.1:8090 from the Mac Mini itself — this page needs to reach that same address from wherever *it's* loaded), and does PocketBase's Settings → Application → allowed origins include this site's origin?`
        );
      }

      // Previously any non-OK response (wrong password, wrong collection
      // name, 404 from an old PocketBase version, etc.) was collapsed into a
      // single hardcoded "Invalid credentials" — so a *correct* password
      // could still show "Invalid credentials" for an unrelated reason.
      // Read PocketBase's own error body and show the real cause.
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            `Auth collection "${PB_COLLECTION}" not found (HTTP 404). Older PocketBase builds use "admins" instead of "_superusers" — check your PocketBase version and VITE_POCKETBASE_COLLECTION.`
          );
        }
        const serverMsg = data?.message;
        throw new Error(serverMsg ? `${serverMsg} (HTTP ${res.status})` : `Login failed (HTTP ${res.status})`);
      }
      if (!data.token) throw new Error('PocketBase accepted the login but returned no token — unexpected response shape.');
      openAdmin(data.token);
    } catch (err) {
      setAdminError((err as Error).message || 'Login failed');
      // A wrong password should never leave OpenAI (or any locked model)
      // sitting selected in the picker — force it back to the always-on
      // default so a failed admin login can't strand the chat on a model it
      // was never actually authorized to use.
      setSelectedModel('deepseek');
      // Never leave a typed password sitting in state after a failed
      // attempt either — the error message stays so the admin knows what
      // happened, but the credential fields themselves always come back empty.
      setAdminEmail('');
      setAdminPassword('');
    } finally {
      setAdminBusy(false);
    }
  };

  const closeAdminPanel = () => setShowAdminPanel(false);

  const handleOpenSettings = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettingsModal(true);
    await fetchStatus();
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRetrying(true);
    await fetchStatus();
    setIsRetrying(false);
  };

  // AI settings panel + its "AI SETTINGS" toggle button share this ref so a
  // click anywhere else (chat messages, sidebar, outside the widget) closes
  // the panel — it previously stayed open until you clicked the toggle again.
  const settingsAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSettingsModal) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsAreaRef.current && !settingsAreaRef.current.contains(e.target as Node)) {
        setShowSettingsModal(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showSettingsModal]);

  // The admin email/password fields are for admin use only — a general user
  // should never see them pre-filled or even expanded by default. So every
  // time AI settings closes, collapse the "Admin login" toggle back to
  // hidden and wipe anything typed, instead of leaving it sitting in state
  // for whoever opens settings next.
  useEffect(() => {
    if (showSettingsModal) return;
    setShowAdminLogin(false);
    setAdminEmail('');
    setAdminPassword('');
    setAdminError('');
  }, [showSettingsModal]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentThread = threads.find(t => t.id === currentThreadId) || threads[0];
  const messages = currentThread?.messages || [];

  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    localStorage.setItem('ai_chat_threads', JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (isOpen) fetchPickers();
  }, [isOpen, fetchPickers]);

  const handleNewChat = () => {
    const newId = Date.now().toString();
    setThreads([{ id: newId, title: t('chatNewChat'), messages: [] }, ...threads]);
    setCurrentThreadId(newId);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let newThreads = threads.filter(t => t.id !== id);
    if (newThreads.length === 0) {
      const newId = Date.now().toString();
      newThreads = [{ id: newId, title: t('chatNewChat'), messages: [] }];
      setCurrentThreadId(newId);
    } else if (currentThreadId === id) {
      setCurrentThreadId(newThreads[0].id);
    }
    setThreads(newThreads);
  };

  const startEditing = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const saveTitle = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads(threads.map(t => t.id === id ? { ...t, title: editTitle } : t));
    setEditingId(null);
  };

  const updateThreadMessages = (newMessages: Message[]) => {
    setThreads(threads.map(thread => {
      if (thread.id === currentThreadId) {
        // Auto-generate title for first user message if it's still 'New Chat'
        let newTitle = thread.title;
        if (thread.title === t('chatNewChat') && newMessages.length === 1 && newMessages[0].role === 'user') {
          newTitle = newMessages[0].content.substring(0, 20) + (newMessages[0].content.length > 20 ? '...' : '');
        }
        return { ...thread, title: newTitle, messages: newMessages };
      }
      return thread;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    // Capture attachments before clearing state. Images/audio go to the
    // multi-modal backend as files; other file types are only noted in text.
    const filesToSend = attachments;
    const mediaFiles = filesToSend.filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('audio/')
    );
    const otherFiles = filesToSend.filter((f) => !mediaFiles.includes(f));

    let userMessage = input;
    if (otherFiles.length > 0) {
       userMessage += `\n\n[Attachments: ${otherFiles.map(a => a.name).join(', ')}]`;
    }

    setInput('');
    setAttachments([]);

    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    updateThreadMessages(newMessages);
    setIsTyping(true);

    // Add empty AI message
    updateThreadMessages([...newMessages, { role: 'ai' as const, content: '' }]);

    // Abort the request if the backend doesn't start responding in time, so a
    // hung/offline server surfaces offline UI instead of spinning forever.
    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

    // Admin/staff token unlocks role-gated knowledge (G3) and, for admins,
    // the OpenAI model; requests stay public if absent.
    const bearer = localStorage.getItem('admin_token') || localStorage.getItem('staff_token');
    const authHeaders: Record<string, string> = bearer ? { Authorization: `Bearer ${bearer}` } : {};

    // With media present, send multipart FormData (Phase 5); else plain JSON.
    let requestInit: RequestInit;
    if (mediaFiles.length > 0) {
      const fd = new FormData();
      fd.append('messages', JSON.stringify(newMessages));
      fd.append('smart', String(smartMode));
      fd.append('model', selectedModel);
      fd.append('kb', selectedKbs.join(','));
      for (const f of mediaFiles) {
        fd.append(f.type.startsWith('image/') ? 'image' : 'audio', f);
      }
      // Note: do NOT set Content-Type — the browser adds the multipart boundary.
      requestInit = { method: 'POST', body: fd, headers: authHeaders, signal: controller.signal };
    } else {
      requestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ messages: newMessages, smart: smartMode, model: selectedModel, kb: selectedKbs.join(',') }),
        signal: controller.signal,
      };
    }

    try {
      const response = await fetch(`${API_BASE}/api/chat`, requestInit);

      // Response headers arrived — streaming may take arbitrarily long now.
      clearTimeout(connectTimer);

      if (response.status === 429) {
        updateThreadMessages([...newMessages, { role: 'ai', content: t('chatRateLimited') }]);
        return;
      }
      if (!response.ok) {
        // Previously this always threw a generic "Backend returned <status>"
        // which the catch block below turned into the blanket "AI Engine
        // Offline for Maintenance" message — so an admin-only 403 (e.g.
        // picking OpenAI without being logged in) looked identical to the
        // backend actually being down. Read the real reason from the
        // response body and surface THAT instead; mark it so the catch
        // block below knows the backend is reachable (it responded!),
        // it just declined this specific request.
        const body = await response.json().catch(() => ({} as any));
        const apiErr = new Error(body?.detail || `Backend returned ${response.status}`);
        (apiErr as Error & { isApiError?: boolean }).isApiError = true;
        throw apiErr;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let aiMessage = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                aiMessage += parsed.content;
                updateThreadMessages([...newMessages, { role: 'ai', content: aiMessage }]);
              } catch (e) {
                console.error("Error parsing SSE data", e);
              }
            }
          }
        }
      }
    } catch (error) {
      // AbortError (timeout) or a network failure both mean "backend unreachable".
      const isTimeout = (error as Error)?.name === 'AbortError';
      const isApiError = (error as Error & { isApiError?: boolean })?.isApiError;
      console.error("Chat error:", error);
      updateThreadMessages([
        ...newMessages,
        {
          role: 'ai',
          // isApiError = the backend responded and explicitly rejected the
          // request (wrong permissions, etc.) — show its real reason instead
          // of the generic offline copy, which was actively misleading here.
          content: isApiError ? (error as Error).message : isTimeout ? t('chatTimeout') : t('chatOffline'),
        },
      ]);
      // Only a genuine unreachable/timeout means the backend is offline —
      // an API-level rejection (403/400/etc.) means it's very much online.
      if (!isApiError) {
        setActiveModelConfig('Offline');
        setFallbackReason(isTimeout ? 'Request timed out' : 'Backend Server Offline');
      }
    } finally {
      clearTimeout(connectTimer);
      setIsTyping(false);
    }
  };

  const handleFileClick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.pdf,.doc,.docx,.txt';
    fileInput.multiple = true;
    fileInput.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        setAttachments(prev => [...prev, ...files]);
      }
    };
    fileInput.click();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleMicClick = () => {
    setIsTyping(true);
    setInput(t('chatListening'));
    setTimeout(() => {
      setInput("Can you help me design a new feature?");
      setIsTyping(false);
    }, 2000);
  };

  // Fullscreen styling or standard widget styling. On phones (< md) the
  // widget always fills the screen; the floating 800px panel is desktop-only.
  const containerClasses = isFullScreen
    ? "fixed inset-0 w-full h-full z-50 flex shadow-2xl bg-[#0A192F]"
    : "fixed inset-0 w-full h-[100dvh] flex shadow-2xl overflow-hidden md:absolute md:inset-auto md:bottom-0 md:right-0 md:w-[800px] md:max-w-[90vw] md:h-[600px] md:max-h-[85vh] md:rounded-2xl shadow-[var(--accent-cyan)]/30 md:border md:border-[var(--accent-cyan)]/20";
    
  const containerStyle = isFullScreen 
    ? {} 
    : { backgroundColor: 'rgba(10, 25, 47, 0.95)', backdropFilter: 'blur(15px)' };

  return (
    // z-[10010] — deliberately above the custom cursor (9999) and its rocket
    // trail dots (9998, see index.css). At the old z-50 those kept rendering
    // on top of the open chat panel, visually "covering" the AI settings
    // button with a stream of glowing dot particles whenever the mouse moved.
    //
    // Side effect of that fix: the site hides the real OS cursor globally
    // (body { cursor: none }) and draws a custom rocket cursor instead. Once
    // the chat sits *above* that custom cursor in the stacking order, the
    // rocket renders underneath the panel and — since the real cursor is
    // still suppressed — the mouse became invisible while over the open
    // chat. Force the real cursor back on for this panel specifically.
    <div
      className={`fixed z-[10010] ${isFullScreen ? 'inset-0' : 'bottom-6 right-6'}`}
      style={isOpen ? { cursor: 'auto' } : undefined}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={containerClasses}
            style={containerStyle}
          >
            {/* AI routing status lives in the sidebar footer (see below). */}

            {/* Sidebar (History) */}
            <AnimatePresence>
              {showSidebar && (
                <motion.div 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 260, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="absolute inset-y-0 left-0 z-30 max-w-[85vw] md:static md:z-auto md:max-w-none bg-[#0f172a] border-r border-[#1e293b] flex flex-col overflow-hidden whitespace-nowrap shrink-0"
                >
                  <div className="p-3">
                    <button
                      onClick={() => { handleNewChat(); closeSidebarOnMobile(); }}
                      className="w-full flex items-center gap-2 p-3 rounded-lg bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/20 transition-colors font-medium"
                    >
                      <Plus size={18} /> {t('chatNewChat')}
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('chatRecent')}</div>
                    {threads.map(thread => (
                      <div 
                        key={thread.id}
                        onClick={() => { setCurrentThreadId(thread.id); closeSidebarOnMobile(); }}
                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${currentThreadId === thread.id ? 'bg-[#1e293b] text-white' : 'hover:bg-[#1e293b]/50 text-gray-400'}`}
                      >
                        {editingId === thread.id ? (
                          <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                            <input 
                              autoFocus
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveTitle(thread.id)}
                              className="bg-[#0f172a] text-white border border-[var(--accent-cyan)] rounded px-2 py-1 w-full text-sm outline-none"
                            />
                            <button onClick={(e) => saveTitle(thread.id, e)} className="text-[var(--accent-cyan)]"><Check size={16}/></button>
                          </div>
                        ) : (
                          <>
                            <div className="truncate flex-1 text-sm flex items-center gap-2">
                              <MessageSquare size={16} className="opacity-50" />
                              {thread.title}
                            </div>
                            <div className="hidden group-hover:flex items-center gap-1">
                              <button onClick={(e) => startEditing(thread.id, thread.title, e)} className="p-1 text-gray-400 hover:text-white"><Edit2 size={14} /></button>
                              <button onClick={(e) => handleDelete(thread.id, e)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div ref={settingsAreaRef} className="p-3 border-t border-[#1e293b] mt-auto">
                    <AnimatePresence>
                      {showSettingsModal && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mb-2 bg-[#112240] border border-[#1e293b] rounded-xl whitespace-normal max-h-[65vh] overflow-y-auto">
                            <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-3.5 border-b border-[#1e293b] bg-[#112240] rounded-t-xl">
                              <button onClick={() => setShowSettingsModal(false)} className="-ml-1 p-1 text-gray-400 hover:text-[var(--accent-cyan)] transition-colors rounded-md hover:bg-[#1e293b]" title="Back">
                                <ChevronLeft size={18} />
                              </button>
                              <span className="text-sm font-semibold text-white">AI settings</span>
                            </div>

                            <div className="p-5 space-y-6">
                              {/* Connection status */}
                              <div className="flex items-center gap-2.5 px-1">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${activeModelConfig === 'Offline' ? 'bg-red-500' : activeModelConfig.includes('Fallback') ? 'bg-yellow-500' : 'bg-[var(--accent-cyan)]'}`}></span>
                                <span className="text-white text-sm font-medium capitalize">{activeModelConfig.replace('-', ' ')}</span>
                              </div>

                              {fallbackReason && (
                                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg space-y-2.5">
                                  <div className="text-[10px] text-red-400 font-semibold uppercase tracking-wide">Reason</div>
                                  <div className="text-xs text-gray-300 leading-relaxed">{fallbackReason}</div>
                                  <button onClick={handleRetry} disabled={isRetrying} className="w-full text-xs font-medium py-2 rounded-md bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all">
                                    {isRetrying ? 'Retrying…' : 'Retry connection'}
                                  </button>
                                </div>
                              )}

                              {/* Model picker */}
                              <div className="space-y-2">
                                <label className="block text-xs font-medium text-[var(--accent-cyan)] px-0.5">Model</label>
                                <select
                                  value={selectedModel}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const picked = modelOptions.find((m) => m.id === val);
                                    if (picked?.locked) {
                                      // Previously this option was just `disabled` — clicking it
                                      // silently did nothing, with no explanation. Now it's
                                      // selectable, but picking it opens the admin login form
                                      // instead of actually switching the model.
                                      setShowAdminLogin(true);
                                      setAdminError('OpenAI is admin-only — log in below to unlock it.');
                                      return;
                                    }
                                    setSelectedModel(val);
                                  }}
                                  className="w-full h-10 px-3 bg-[#0a192f] border border-[#1e293b] rounded-lg text-white text-sm outline-none focus:border-[var(--accent-cyan)] transition-colors"
                                >
                                  {modelOptions.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.label}{m.locked ? ' 🔒 (admin login required)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Knowledge base picker */}
                              <div className="space-y-2">
                                <label className="block text-xs font-medium text-[var(--accent-cyan)] px-0.5">Knowledge (RAG) · pick any</label>
                                <div className="flex flex-col gap-2">
                                  {kbOptions.map((k) => (
                                    <label key={k.code} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#0a192f] border border-[#1e293b] cursor-pointer hover:border-[var(--accent-cyan)]/40 transition-colors">
                                      <input type="checkbox" checked={selectedKbs.includes(k.code)} onChange={() => toggleKb(k.code)} className="accent-[var(--accent-cyan)]" />
                                      <span className="text-sm text-gray-200">{k.label}</span>
                                    </label>
                                  ))}
                                  {kbOptions.length === 0 && (
                                    <div className="text-xs text-gray-500 px-3 py-2 rounded-lg bg-[#0a192f]/60 border border-[#1e293b]/60">No knowledge bases yet</div>
                                  )}
                                </div>
                              </div>

                              {/* Admin access */}
                              <div className="border-t border-[#1e293b] pt-5 space-y-3">
                                {localStorage.getItem('admin_token') ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setShowAdminPanel(true)}
                                      className="flex-1 flex items-center justify-center gap-2 h-10 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 rounded-lg text-sm font-medium hover:bg-[var(--accent-cyan)]/20 transition-all"
                                    >
                                      <ShieldCheck size={16} /> Open admin panel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Clears a saved (or now-stale) admin token without having
                                        // to open the full admin panel just to hit "Sign out" — this
                                        // is what makes the toggle+login form reappear next time.
                                        localStorage.removeItem('admin_token');
                                        fetchPickers();
                                      }}
                                      title="Sign out of admin (clears the saved token)"
                                      className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-400/10 border border-[#1e293b] rounded-lg transition-all shrink-0"
                                    >
                                      <LogOut size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setShowAdminLogin((s) => !s)}
                                      className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[var(--accent-cyan)] transition-colors"
                                    >
                                      <span>{showAdminLogin ? '▾' : '▸'}</span> Admin login
                                    </button>
                                    {showAdminLogin && (
                                      <div className="flex flex-col gap-3 pt-1">
                                        <input
                                          type="email"
                                          value={adminEmail}
                                          onChange={(e) => setAdminEmail(e.target.value)}
                                          placeholder="admin@uknowtechno.com"
                                          autoComplete="off"
                                          className="h-10 px-3.5 bg-[#0a192f] border border-[#1e293b] rounded-lg text-white text-sm outline-none focus:border-[var(--accent-cyan)] transition-colors"
                                        />
                                        <input
                                          type="password"
                                          value={adminPassword}
                                          onChange={(e) => setAdminPassword(e.target.value)}
                                          onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                                          placeholder="Password"
                                          // "new-password" (rather than "off", which some browsers
                                          // ignore for password fields) discourages the browser's
                                          // own save-password / autofill prompt — this field is
                                          // deliberately never persisted anywhere, in-app or by the
                                          // browser, since it's an admin-only credential a general
                                          // visitor shouldn't be prompted to save.
                                          autoComplete="new-password"
                                          className="h-10 px-3.5 bg-[#0a192f] border border-[#1e293b] rounded-lg text-white text-sm outline-none focus:border-[var(--accent-cyan)] transition-colors"
                                        />
                                        {adminError && (
                                          <div className="text-xs text-red-400 leading-relaxed p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                                            {adminError}
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={handleAdminLogin}
                                          disabled={adminBusy}
                                          className="h-10 bg-[var(--accent-cyan)] text-[#0a192f] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-60 transition-all"
                                        >
                                          {adminBusy ? 'Signing in…' : 'Log in'}
                                        </button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button onClick={handleOpenSettings} className="w-full flex items-center justify-start gap-3 p-3 rounded-lg hover:bg-[#1e293b]/80 text-gray-400 hover:text-[var(--accent-cyan)] transition-all text-sm font-medium">
                      <Settings size={18} /> AI SETTINGS
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-transparent">
              {/* Header */}
              <div className="p-4 flex justify-between items-center border-b border-[#1e293b] bg-[#0a192f]/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowSidebar(!showSidebar)} className="text-[var(--accent-cyan)] hover:text-white transition-colors p-2 hover:bg-[var(--accent-cyan)]/10 rounded-lg" title={t('chatToggleSidebar')}>
                    {showSidebar ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
                  </button>
                  <h3 className="text-white font-medium tracking-normal flex items-center gap-3 text-base">
                    <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${activeModelConfig === 'Offline' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]' : activeModelConfig.includes('Fallback') ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,1)]' : 'bg-[var(--accent-cyan)] shadow-[0_0_10px_var(--accent-cyan)]'}`}></span>
                    {t('chatAIEngine')}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-gray-400 hover:text-white hover:bg-[#1e293b] rounded-lg transition-colors">
                    {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </button>
                  <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-80">
                    <div className="w-20 h-20 mb-6 rounded-[2rem] bg-[var(--accent-cyan)]/10 flex items-center justify-center text-[var(--accent-cyan)] shadow-[0_0_30px_rgba(100,255,218,0.1)]">
                      <MessageSquare size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-wide mb-3">{t('chatGreeting')}</h2>
                    <p className="text-sm font-medium tracking-wide">{t('chatGreetingSub')}</p>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
                  >
                    {msg.role === 'ai' && (
                      <div className="w-10 h-10 rounded-xl bg-[var(--accent-cyan)]/20 border border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] flex items-center justify-center shrink-0 mr-4 mt-1 shadow-[0_0_15px_rgba(100,255,218,0.1)] text-lg">
                        🤖
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: isFullScreen ? '75%' : '85%' }}>
                      <div style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: msg.role === 'user' ? '1.5rem 1.5rem 0 1.5rem' : '0 1.5rem 1.5rem 1.5rem',
                        color: '#e2e8f0',
                        backgroundColor: msg.role === 'user' ? 'rgba(100, 255, 218, 0.1)' : 'rgba(15, 23, 42, 0.8)',
                        border: msg.role === 'user' ? '1px solid rgba(100, 255, 218, 0.3)' : '1px solid rgba(30, 41, 59, 0.8)',
                        fontSize: '1rem',
                        lineHeight: '1.6',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)'
                      }}>
                        <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#0a192f] prose-pre:border prose-pre:border-[#1e293b]">
                          {msg.content === '' && isTyping ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', height: '1.5rem' }}>
                              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-cyan)] animate-bounce shadow-[0_0_5px_var(--accent-cyan)]"></span>
                              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-cyan)] animate-bounce shadow-[0_0_5px_var(--accent-cyan)]" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-cyan)] animate-bounce shadow-[0_0_5px_var(--accent-cyan)]" style={{ animationDelay: '300ms' }}></span>
                            </div>
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                      
                      {msg.role === 'ai' && msg.content !== '' && (
                        <div className="flex gap-2 mt-2 ml-2">
                           <button onClick={() => {
                               navigator.clipboard.writeText(msg.content);
                               setCopiedIndex(idx);
                               setTimeout(() => setCopiedIndex(null), 2000);
                             }} 
                             className="text-gray-400 hover:text-[var(--accent-cyan)] transition-colors p-1.5 rounded-lg hover:bg-[#1e293b] flex items-center gap-1 text-xs font-semibold" title="Copy text">
                             {copiedIndex === idx ? <Check size={14} className="text-[var(--accent-cyan)]" /> : <Copy size={14} />} 
                             {copiedIndex === idx ? 'Copied!' : 'Copy'}
                           </button>
                           {navigator.share && (
                             <button onClick={() => navigator.share({ title: 'AI Response', text: msg.content })} className="text-gray-400 hover:text-[var(--accent-cyan)] transition-colors p-1.5 rounded-lg hover:bg-[#1e293b] flex items-center gap-1 text-xs font-semibold" title="Share text">
                               <Share2 size={14} /> Share
                             </button>
                           )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 md:p-6 bg-[#0a192f]/80 backdrop-blur-md border-t border-[#1e293b]">
                <form onSubmit={handleSubmit} className="relative flex flex-col gap-2 bg-[#0f172a]/90 backdrop-blur border border-[#1e293b] hover:border-[var(--accent-cyan)]/30 rounded-2xl p-2 focus-within:border-[var(--accent-cyan)]/60 transition-all">
                  {/* Attachments Display Area */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-3 pt-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-[#1e293b] text-gray-300 text-sm px-3 py-1.5 rounded-lg border border-gray-600">
                          {file.type.startsWith('image/') ? '🖼️' : '📄'} 
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <button type="button" onClick={() => removeAttachment(idx)} className="text-gray-400 hover:text-red-400 ml-1">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-3 w-full">
                    <div className="flex flex-col gap-1 p-2 text-gray-400">
                      <button type="button" onClick={handleFileClick} className="p-2 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 rounded-lg transition-all" title={t('chatAttachFile')}>
                         <Paperclip size={20} />
                      </button>
                    </div>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onPaste={handlePaste}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      placeholder={t('chatInputPlaceholder')}
                      className="flex-1 bg-transparent border-none outline-none text-white text-base py-3 px-2 resize-none max-h-32 min-h-[50px] font-medium"
                      rows={1}
                    />
                    <div className="flex flex-col gap-1 p-2 text-gray-400">
                      <button type="button" onClick={handleMicClick} className="p-2 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10 rounded-lg transition-all" title={t('chatUseMic')}>
                         <Mic size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSmartMode((s) => !s)}
                        className={`p-2 rounded-lg transition-all ${smartMode ? 'text-[#0a192f] bg-[var(--accent-cyan)] shadow-[0_0_12px_var(--accent-cyan)]' : 'hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/10'}`}
                        title={smartMode ? t('chatSmartOn') : t('chatSmartOff')}
                      >
                        <Sparkles size={20} />
                      </button>
                    </div>
                    <button 
                      type="submit" 
                      disabled={(!input.trim() && attachments.length === 0) || isTyping} 
                      className="p-3 mb-1 mr-1 bg-[var(--accent-cyan)] text-[#0A192F] rounded-xl hover:brightness-110 disabled:opacity-50 transition-all font-medium"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </form>
                <div className="text-center text-xs font-bold tracking-widest text-gray-500 mt-4 uppercase">
                  {t('chatDisclaimer')}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && !isFullScreen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute bottom-0 right-0 w-16 h-16 bg-[var(--accent-cyan)] rounded-2xl flex items-center justify-center text-[#0A192F] shadow-[0_0_12px_rgba(100,255,218,0.25)] hover:scale-105 transition-all z-50 overflow-hidden relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <span className="ai-text-3d flex items-center justify-center">
            AI
          </span>
        </button>
      )}

      {/* Admin panel — inline overlay (replaces the old /admin route). Reached
          only via a successful login in AI settings above; never a public URL. */}
      <AnimatePresence>
        {showAdminPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // `flex justify-center` actively centers the panel horizontally
            // instead of relying only on the panel's own `mx-auto` (which
            // does nothing extra once padding is this generous) — combined
            // with real px/py here, the panel can no longer sit flush against
            // any edge regardless of viewport size.
            className="fixed inset-0 z-[100] bg-[#0A192F]/98 backdrop-blur-sm overflow-y-auto flex justify-center px-5 py-10 md:px-12 md:py-16"
          >
            <AdminPanel onClose={closeAdminPanel} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
