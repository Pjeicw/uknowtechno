import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, X, Send, Paperclip, Mic, Maximize2, Minimize2, PanelLeftClose, PanelLeft, Plus, Edit2, Trash2, Check, Copy, Share2, Settings, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

type Message = { role: 'user' | 'ai'; content: string };
type Thread = { id: string; title: string; messages: Message[] };

// Central API base — override with VITE_API_BASE in production (e.g. https://api.uknowtechno.com)
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000';
// How long to wait for the backend to START responding before treating it as offline.
const CONNECT_TIMEOUT_MS = 15000;

export default function ChatWidget() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
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
  const [selectedKb, setSelectedKb] = useState('none');

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
      const staffToken = localStorage.getItem('staff_token');
      const authHeaders: Record<string, string> = staffToken ? { Authorization: `Bearer ${staffToken}` } : {};
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
          if (c.id === 'openai') opts.push({ id: c.id, label: c.label, locked: !!c.locked });
        }
        setModelOptions(opts.length ? opts : [{ id: 'deepseek', label: 'DeepSeek · default' }]);
      }
      if (kRes.ok) {
        const k = await kRes.json();
        setKbOptions(k.knowledge_bases || []);
      }
    } catch { /* offline: keep defaults */ }
  }, []);

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

    // Optional staff token unlocks role-gated knowledge (G3); public if absent.
    const staffToken = localStorage.getItem('staff_token');
    const authHeaders: Record<string, string> = staffToken ? { Authorization: `Bearer ${staffToken}` } : {};

    // With media present, send multipart FormData (Phase 5); else plain JSON.
    let requestInit: RequestInit;
    if (mediaFiles.length > 0) {
      const fd = new FormData();
      fd.append('messages', JSON.stringify(newMessages));
      fd.append('smart', String(smartMode));
      fd.append('model', selectedModel);
      fd.append('kb', selectedKb);
      for (const f of mediaFiles) {
        fd.append(f.type.startsWith('image/') ? 'image' : 'audio', f);
      }
      // Note: do NOT set Content-Type — the browser adds the multipart boundary.
      requestInit = { method: 'POST', body: fd, headers: authHeaders, signal: controller.signal };
    } else {
      requestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ messages: newMessages, smart: smartMode, model: selectedModel, kb: selectedKb }),
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
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);

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
      console.error("Chat error:", error);
      updateThreadMessages([
        ...newMessages,
        { role: 'ai', content: isTimeout ? t('chatTimeout') : t('chatOffline') },
      ]);
      // Reflect offline state immediately in the header/status dot.
      setActiveModelConfig('Offline');
      setFallbackReason(isTimeout ? 'Request timed out' : 'Backend Server Offline');
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

  // Fullscreen styling or standard widget styling
  const containerClasses = isFullScreen 
    ? "fixed inset-0 w-full h-full z-50 flex shadow-2xl bg-[#0A192F]"
    : "absolute bottom-0 right-0 w-[800px] max-w-[90vw] max-h-[85vh] h-[600px] flex shadow-2xl rounded-2xl overflow-hidden shadow-[var(--accent-cyan)]/30 border border-[var(--accent-cyan)]/20";
    
  const containerStyle = isFullScreen 
    ? {} 
    : { backgroundColor: 'rgba(10, 25, 47, 0.95)', backdropFilter: 'blur(15px)' };

  return (
    <div className={`fixed z-50 ${isFullScreen ? 'inset-0' : 'bottom-6 right-6'}`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={containerClasses}
            style={containerStyle}
          >
            {/* Old floating popover disabled — routing status now lives in the sidebar below. */}
            <AnimatePresence>
              {false && (
                <>
                  <div
                    className="fixed inset-0 z-[90]"
                    onClick={() => setShowSettingsModal(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, x: 0, y: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 0, y: 10 }}
                    className="absolute bottom-20 left-4 w-80 bg-[#0a192f]/95 backdrop-blur-xl border border-[var(--accent-cyan)]/40 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.9)] z-[100] overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-cyan)] to-transparent opacity-50"></div>
                    
                    <div className="flex justify-between items-start mb-5">
                      <h4 className={`font-black text-sm tracking-widest flex items-center gap-2 ${activeModelConfig === 'Offline' ? 'text-red-400' : activeModelConfig.includes('Fallback') ? 'text-yellow-400' : 'text-[var(--accent-cyan)]'}`}>
                        <span className={`w-2 h-2 rounded-full animate-pulse ${activeModelConfig === 'Offline' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]' : activeModelConfig.includes('Fallback') ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,1)]' : 'bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]'}`}></span>
                        AI ROUTING STATUS
                      </h4>
                      <button onClick={(e) => { e.stopPropagation(); setShowSettingsModal(false); }} className="text-gray-500 hover:text-white bg-[#1e293b]/50 p-1 rounded-full transition-colors"><X size={16} /></button>
                    </div>
                    
                    <div className="mb-6 bg-[#112240] p-4 rounded-xl border border-[#1e293b] shadow-inner">
                      <div className="text-xs text-gray-500 font-bold tracking-widest mb-2 uppercase">Currently Active Engine</div>
                      <div className="text-lg text-white font-black capitalize flex items-center gap-3 break-words whitespace-normal">
                        {activeModelConfig.replace('-', ' ')}
                      </div>
                      {fallbackReason && (
                        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                          <div className="text-[10px] text-red-400 font-black mb-1 uppercase tracking-widest">Root Cause:</div>
                          <div className="text-xs text-gray-300 font-mono break-all mb-3 bg-[#0a192f] p-2 rounded border border-[#1e293b]">{fallbackReason}</div>
                          <button 
                            onClick={handleRetry} 
                            disabled={isRetrying}
                            className={`w-full flex justify-center items-center gap-2 text-xs font-black py-2 rounded-md transition-all uppercase tracking-widest border ${isRetrying ? 'bg-yellow-500/5 text-yellow-600 border-yellow-500/10 cursor-not-allowed' : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 hover:text-yellow-400 border-yellow-500/20'}`}
                          >
                            {isRetrying ? (
                              <><div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div> Retrying...</>
                            ) : (
                              "Retry Local Connection"
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                      The system is currently routing your chat requests to this model. You can override the AI engine or adjust limits in the Administration panel.
                    </p>
                    
                    <a href="/admin" className="group flex items-center justify-center w-full bg-[var(--accent-cyan)] text-[#0a192f] border border-[var(--accent-cyan)] hover:shadow-[0_0_20px_rgba(100,255,218,0.4)] transition-all py-3 rounded-xl text-sm font-black tracking-widest">
                      OPEN ADMIN PANEL
                    </a>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Sidebar (History) */}
            <AnimatePresence>
              {showSidebar && (
                <motion.div 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 260, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="bg-[#0f172a] border-r border-[#1e293b] flex flex-col overflow-hidden whitespace-nowrap shrink-0"
                >
                  <div className="p-3">
                    <button 
                      onClick={handleNewChat}
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
                        onClick={() => setCurrentThreadId(thread.id)}
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
                  
                  <div className="p-3 border-t border-[#1e293b] mt-auto">
                    <AnimatePresence>
                      {showSettingsModal && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mb-2 bg-[#112240] border border-[#1e293b] rounded-xl p-3 whitespace-normal">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active engine</span>
                              <button onClick={() => setShowSettingsModal(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`w-2 h-2 rounded-full ${activeModelConfig === 'Offline' ? 'bg-red-500' : activeModelConfig.includes('Fallback') ? 'bg-yellow-500' : 'bg-[var(--accent-cyan)]'}`}></span>
                              <span className="text-white text-sm font-medium capitalize">{activeModelConfig.replace('-', ' ')}</span>
                            </div>
                            {fallbackReason && (
                              <div className="mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                                <div className="text-[10px] text-red-400 font-medium mb-1 uppercase tracking-wide">Reason</div>
                                <div className="text-xs text-gray-300 mb-2">{fallbackReason}</div>
                                <button onClick={handleRetry} disabled={isRetrying} className="w-full text-xs font-medium py-1.5 rounded-md bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all">
                                  {isRetrying ? 'Retrying…' : 'Retry connection'}
                                </button>
                              </div>
                            )}
                            <a href="/admin" className="flex items-center justify-center w-full bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/20 border border-[var(--accent-cyan)]/30 transition-all py-2 rounded-lg text-xs font-medium">
                              Open admin panel
                            </a>
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

              {/* Model + Knowledge pickers */}
              <div className="flex flex-wrap gap-4 px-4 py-3 border-b border-[#1e293b] bg-[#0a192f]/40">
                <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                  <label className="text-xs text-[var(--accent-cyan)]">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="h-9 px-3 bg-[#0f172a] border border-[#1e293b] rounded-lg text-white text-sm outline-none focus:border-[var(--accent-cyan)]"
                  >
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id} disabled={m.locked}>
                        {m.label}{m.locked ? ' 🔒 (needs password)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                  <label className="text-xs text-[var(--accent-cyan)]">Knowledge</label>
                  <select
                    value={selectedKb}
                    onChange={(e) => setSelectedKb(e.target.value)}
                    className="h-9 px-3 bg-[#0f172a] border border-[#1e293b] rounded-lg text-white text-sm outline-none focus:border-[var(--accent-cyan)]"
                  >
                    <option value="none">None · model knowledge</option>
                    {kbOptions.map((k) => (
                      <option key={k.code} value={k.code}>{k.label}</option>
                    ))}
                  </select>
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
    </div>
  );
}
