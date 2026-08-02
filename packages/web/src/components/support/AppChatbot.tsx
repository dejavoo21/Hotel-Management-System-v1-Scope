import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowRight, Bot, Headphones, MessageCircle, Plus, Send, Sparkles, X } from 'lucide-react';
import { assistantService, conciergeService, messageService } from '@/services';
import type { AssistantMode } from '@/services/assistant';
import { useAuthStore } from '@/stores/authStore';

type ChatAction = { label: string; path: string };
type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string; actions?: ChatAction[] };
type PersistedState = { conversationId: string | null; messages: ChatMessage[] };

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi, I’m LaFlo Assistant. Ask me anything about this page, hotel operations, or how to use LaFlo.',
};

const MODE_LABELS: Record<AssistantMode, string> = {
  general: 'Ask anything', operations: 'Operations', pricing: 'Pricing', weather: 'Weather', tasks: 'Tasks',
};

const PAGE_NAMES: Record<string, string> = {
  '/': 'Dashboard', '/bookings': 'Bookings', '/guests': 'Guests', '/rooms': 'Rooms',
  '/housekeeping': 'Housekeeping', '/inventory': 'Inventory', '/calendar': 'Calendar',
  '/financials': 'Financials', '/invoices': 'Invoices', '/expenses': 'Expenses',
  '/reviews': 'Reviews', '/concierge': 'Concierge', '/messages': 'Messages', '/calls': 'Calls',
  '/users': 'User Management', '/settings': 'Settings', '/operations-center': 'Operations Center',
  '/security-center': 'Security Center', '/smart-building': 'Smart Building',
  '/maintenance-center': 'Maintenance Center', '/incidents': 'Incident Center',
  '/operations-center/search': 'Enterprise Search', '/ai/hotel-brain': 'Hotel Brain',
};

const NAV_TARGETS: Array<ChatAction & { keywords: string[]; permission?: string }> = [
  { label: 'Open Bookings', path: '/bookings', keywords: ['booking', 'reservation', 'arrival', 'departure', 'check-in', 'check in'], permission: 'bookings' },
  { label: 'Open Guests', path: '/guests', keywords: ['guest', 'profile'], permission: 'guests' },
  { label: 'Open Rooms', path: '/rooms', keywords: ['room', 'occupancy'], permission: 'rooms' },
  { label: 'Open Housekeeping', path: '/housekeeping', keywords: ['housekeeping', 'clean', 'dirty', 'readiness'], permission: 'housekeeping' },
  { label: 'Open Maintenance', path: '/maintenance-center', keywords: ['maintenance', 'repair', 'fault'], permission: 'maintenance_center' },
  { label: 'Open Security Center', path: '/security-center', keywords: ['security', 'camera', 'cctv'], permission: 'security_center' },
  { label: 'Open Financials', path: '/financials', keywords: ['finance', 'financial', 'revenue', 'payment', 'invoice'], permission: 'financials' },
  { label: 'Open Settings', path: '/settings', keywords: ['setting', 'integration', 'configuration'], permission: 'settings' },
  { label: 'Open User Management', path: '/users', keywords: ['user', 'access request', 'permission'], permission: 'users' },
  { label: 'Open Enterprise Search', path: '/operations-center/search', keywords: ['search', 'find'], permission: 'bookings' },
  { label: 'Open Hotel Brain', path: '/ai/hotel-brain', keywords: ['hotel brain', 'insight', 'analyse', 'analyze'], permission: 'bookings' },
];

function getPageName(pathname: string) {
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname];
  const match = Object.entries(PAGE_NAMES)
    .filter(([path]) => path !== '/' && pathname.startsWith(`${path}/`))
    .sort(([a], [b]) => b.length - a.length)[0];
  return match?.[1] || 'LaFlo';
}

function getPrompts(pathname: string) {
  const page = getPageName(pathname);
  const prompts = [`What can I do on the ${page} page?`, `Explain the ${page} page`];
  if (pathname.startsWith('/bookings')) prompts.push('Show me how to check in a guest');
  else if (pathname.startsWith('/rooms')) prompts.push('How do I update room readiness?');
  else if (pathname.startsWith('/housekeeping')) prompts.push('What should Housekeeping prioritise?');
  else if (pathname.startsWith('/financials')) prompts.push('Explain the financial KPIs');
  else prompts.push('What should I prioritise today?');
  return prompts;
}

function getNavigationActions(text: string, role?: string, permissions?: string[]) {
  const normalized = text.toLowerCase();
  return NAV_TARGETS.filter((target) => {
    const allowed = role === 'ADMIN' || !target.permission || permissions?.includes(target.permission);
    return allowed && target.keywords.some((keyword) => normalized.includes(keyword));
  }).slice(0, 2).map(({ label, path }) => ({ label, path }));
}

function describeError(error: unknown) {
  if (!axios.isAxiosError(error)) return 'The assistant could not respond. Please try again.';
  if (error.response?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.response?.status === 403) return 'You do not have permission to access the requested information.';
  if (error.response?.status === 429) return 'Live insights are busy right now. You can retry shortly or use the navigation guidance and live helpdesk below.';
  if (error.code === 'ECONNABORTED') return 'The assistant took too long to respond. Please try again.';
  const message = error.response?.data?.message || error.response?.data?.error?.message;
  return typeof message === 'string' && message.trim()
    ? message
    : 'The assistant is temporarily unavailable. You can retry or contact the helpdesk.';
}

export default function AppChatbot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('general');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [assistantLive, setAssistantLive] = useState<boolean | null>(null);
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [handoffText, setHandoffText] = useState('');
  const [handoffLoading, setHandoffLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentPage = useMemo(() => getPageName(location.pathname), [location.pathname]);
  const prompts = useMemo(() => getPrompts(location.pathname), [location.pathname]);
  const storageKey = user?.id ? `laflo-assistant:${user.id}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        setMessages([WELCOME]);
        setConversationId(null);
        return;
      }
      const parsed = JSON.parse(saved) as PersistedState;
      setMessages(Array.isArray(parsed.messages) && parsed.messages.length ? parsed.messages.slice(-40) : [WELCOME]);
      setConversationId(typeof parsed.conversationId === 'string' ? parsed.conversationId : null);
    } catch {
      setMessages([WELCOME]);
      setConversationId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const state: PersistedState = { conversationId, messages: messages.slice(-40) };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [conversationId, messages, storageKey]);

  useEffect(() => {
    assistantService.status().then((status) => setAssistantLive(status.live)).catch(() => setAssistantLive(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages, isSending]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      launcherRef.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const startNewChat = () => {
    setMessages([WELCOME]);
    setConversationId(null);
    setHandoffRequested(false);
    setHandoffText('');
    setInput('');
    inputRef.current?.focus();
  };

  const sendMessage = async (text: string) => {
    const value = text.trim();
    if (!value || isSending) return;
    setMessages((previous) => [...previous, { id: `user-${Date.now()}`, role: 'user', text: value }]);
    setInput('');
    setIsSending(true);
    try {
      const routeParts = location.pathname.split('/').filter(Boolean);
      const response = await assistantService.chat({
        message: value,
        mode,
        conversationId,
        context: {
          route: location.pathname,
          pageTitle: currentPage,
          module: routeParts[0] || 'dashboard',
          recordId: routeParts[1] || '',
          locale: document.documentElement.lang || navigator.language || 'en-GB',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      if (response.conversationId) setConversationId(response.conversationId);
      const reply = response.reply?.trim() || 'I could not find an answer in the information available to you.';
      setMessages((previous) => [...previous, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: reply,
        actions: getNavigationActions(`${value} ${reply}`, user?.role, user?.modulePermissions),
      }]);
      setAssistantLive(true);
    } catch (error) {
      setMessages((previous) => [...previous, {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        text: describeError(error),
      }]);
      if (!axios.isAxiosError(error) || error.response?.status !== 429) {
        setAssistantLive(false);
      }
    } finally {
      setIsSending(false);
    }
  };

  const requestHumanHandoff = async () => {
    const note = handoffText.trim();
    if (!note) {
      toast.error('Please add a short issue summary.');
      return;
    }
    setHandoffLoading(true);
    try {
      const transcript = messages.slice(-12).map((message) => `${message.role.toUpperCase()}: ${message.text}`).join('\n');
      await conciergeService.create({
        title: `Assistant handoff — ${currentPage}`,
        details: [
          `Requested by: ${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
          `Email: ${user?.email || '-'}`,
          `Page: ${currentPage} (${location.pathname})`,
          `Issue: ${note}`,
          '',
          'Recent assistant transcript:',
          transcript,
        ].join('\n'),
        source: 'CHATBOT', notifySupport: true, priority: 'MEDIUM', status: 'PENDING',
      });
      await messageService.getOrCreateLiveSupportThread(
        `[LaFlo Assistant] ${note}`,
        `Live support requested from ${currentPage} by ${user?.firstName || 'User'}`
      );
      setMessages((previous) => [...previous, {
        id: `handoff-${Date.now()}`,
        role: 'assistant',
        text: 'Your request has been sent to the live helpdesk. You can continue in Messages while you wait.',
      }]);
      setHandoffRequested(false);
      setHandoffText('');
      toast.success('Escalated to the helpdesk');
    } catch {
      toast.error('The helpdesk request could not be sent. Please try again.');
    } finally {
      setHandoffLoading(false);
    }
  };

  return (
    <div className='fixed bottom-3 right-3 z-50 sm:bottom-5 sm:right-5'>
      {open ? (
        <section role='dialog' aria-label='LaFlo Assistant' className='flex h-[min(680px,calc(100vh-1.5rem))] w-[min(430px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl'>
          <header className='flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-950 to-teal-800 px-4 py-3 text-white'>
            <div className='flex min-w-0 items-center gap-3'>
              <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15'>
                <Sparkles className='h-5 w-5' />
              </span>
              <div className='min-w-0'>
                <h2 className='truncate text-sm font-semibold'>LaFlo Assistant</h2>
                <p className='flex items-center gap-1.5 text-xs text-emerald-50/80'>
                  <span className={`h-1.5 w-1.5 rounded-full ${assistantLive === false ? 'bg-amber-300' : 'bg-emerald-300'}`} />
                  {assistantLive === false ? 'Temporarily unavailable' : `Helping with ${currentPage}`}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-1'>
              <button type='button' onClick={startNewChat} className='rounded-lg p-2 hover:bg-white/10' aria-label='Start a new conversation'>
                <Plus className='h-4 w-4' />
              </button>
              <button type='button' onClick={() => { setOpen(false); launcherRef.current?.focus(); }} className='rounded-lg p-2 hover:bg-white/10' aria-label='Close assistant'>
                <X className='h-4 w-4' />
              </button>
            </div>
          </header>
          <div className='flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2'>
            <span className='truncate text-xs text-slate-500'>Current page: <strong className='font-medium text-slate-700'>{currentPage}</strong></span>
            <select value={mode} onChange={(event) => setMode(event.target.value as AssistantMode)} className='h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700' aria-label='Assistant mode'>
              {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div ref={listRef} className='flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-3' aria-live='polite'>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className='max-w-[88%]'>
                  <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-teal-700 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm'}`}>
                    {message.text}
                  </div>
                  {message.actions?.length ? (
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {message.actions.map((action) => (
                        <button key={action.path} type='button' onClick={() => { navigate(action.path); setOpen(false); }} className='inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-50'>
                          {action.label}<ArrowRight className='h-3 w-3' />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {messages.length === 1 ? (
              <div className='flex flex-wrap gap-2'>
                {prompts.map((prompt) => (
                  <button key={prompt} type='button' onClick={() => void sendMessage(prompt)} className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 hover:border-teal-300 hover:bg-teal-50' disabled={isSending}>
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
            {isSending ? (
              <div className='flex justify-start'>
                <div className='inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-500'>
                  <Bot className='h-4 w-4 animate-pulse text-teal-600' />Thinking…
                </div>
              </div>
            ) : null}
            {handoffRequested ? (
              <div className='rounded-xl border border-slate-200 bg-white p-3'>
                <label htmlFor='assistant-handoff' className='text-xs font-semibold text-slate-700'>What should the helpdesk know?</label>
                <textarea id='assistant-handoff' value={handoffText} onChange={(event) => setHandoffText(event.target.value)} rows={3} className='input mt-2 w-full text-sm' placeholder='Briefly describe what you need…' />
                <div className='mt-2 flex gap-2'>
                  <button type='button' onClick={() => void requestHumanHandoff()} disabled={handoffLoading} className='btn-primary h-8 px-3 text-xs'>
                    {handoffLoading ? 'Sending…' : 'Send to helpdesk'}
                  </button>
                  <button type='button' onClick={() => { setHandoffRequested(false); setHandoffText(''); }} className='btn-outline h-8 px-3 text-xs'>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
          <div className='border-t border-slate-200 bg-white p-3'>
            <form onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }}>
              <label htmlFor='laflo-assistant-input' className='sr-only'>Ask anything about LaFlo</label>
              <div className='flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-1.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100'>
                <input ref={inputRef} id='laflo-assistant-input' value={input} onChange={(event) => setInput(event.target.value)} className='min-w-0 flex-1 border-0 bg-transparent px-2 text-sm outline-none' placeholder='Ask anything about LaFlo…' disabled={isSending} />
                <button type='submit' disabled={isSending || !input.trim()} className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300' aria-label='Send message'>
                  <Send className='h-4 w-4' />
                </button>
              </div>
            </form>
            <div className='mt-2 flex items-center justify-between gap-2'>
              <button type='button' onClick={() => setHandoffRequested((value) => !value)} className='inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-teal-700'>
                <Headphones className='h-3.5 w-3.5' />Talk to a person
              </button>
              <button type='button' onClick={async () => {
                try {
                  const thread = await messageService.getOrCreateLiveSupportThread();
                  setOpen(false);
                  navigate(`/messages?thread=${thread.id}&support=1`);
                } catch {
                  setOpen(false);
                  navigate('/messages?support=1');
                }
              }} className='text-xs text-slate-500 hover:text-teal-700'>Open support messages</button>
            </div>
            <p className='mt-2 text-center text-[10px] text-slate-400'>Answers respect your LaFlo access permissions. Confirm important operational decisions.</p>
          </div>
        </section>
      ) : (
        <button ref={launcherRef} type='button' onClick={() => setOpen(true)} className='flex items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-teal-800' aria-label='Open LaFlo Assistant'>
          <MessageCircle className='h-5 w-5' /><span className='hidden sm:inline'>Ask LaFlo</span>
        </button>
      )}
    </div>
  );
}
