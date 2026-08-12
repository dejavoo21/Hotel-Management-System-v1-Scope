import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowRight, Bot, Download, Headphones, Mail, Plus, Send, X } from 'lucide-react';
import { assistantService, conciergeService, messageService } from '@/services';
import type { AssistantMode } from '@/services/assistant';
import { useAuthStore } from '@/stores/authStore';

type ChatAction = { label: string; path: string };
type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  actions?: ChatAction[];
  quickReplies?: string[];
  supportOffer?: boolean;
  supportSummary?: string;
};
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
  '/reports': 'Reports', '/enterprise-command-center': 'Enterprise Command Center',
  '/reviews': 'Reviews', '/concierge': 'Concierge', '/messages': 'Messages', '/calls': 'Calls',
  '/users': 'User Management', '/settings': 'Settings',
  '/settings?tab=integrations': 'Integration Manager', '/operations-center': 'Operations Center',
  '/security-center': 'Security Center', '/operations/smart-building': 'Smart Building',
  '/maintenance-center': 'Maintenance Center', '/incidents': 'Incident Center',
  '/operations-center/search': 'Enterprise Search', '/ai/hotel-brain': 'Hotel Brain',
  '/operations-center/weather': 'Weather', '/operations-center/tasks': 'Tasks',
  '/operations-center/revenue': 'Operations Revenue',
  '/operations-center/market-intelligence': 'Market Intelligence',
};

const PAGE_FOCUS_PROMPTS: Record<string, string> = {
  '/': 'Show me today’s dashboard priorities',
  '/enterprise-command-center': 'Which property needs attention first?',
  '/bookings': 'Show me how to check in a guest',
  '/guests': 'Explain the guest profile sections',
  '/rooms': 'How do I update room readiness?',
  '/housekeeping': 'What should Housekeeping prioritise?',
  '/inventory': 'Show me how low-stock alerts work',
  '/calendar': 'What events need attention today?',
  '/financials': 'Explain the financial KPIs',
  '/reports': 'Which report should I use?',
  '/invoices': 'Explain invoice statuses',
  '/expenses': 'How do I review pending expenses?',
  '/reviews': 'Which feedback needs follow-up?',
  '/concierge': 'What concierge requests are urgent?',
  '/messages': 'How does live support work?',
  '/calls': 'Explain the active call controls',
  '/operations-center': 'What needs attention today?',
  '/operations-center/search': 'What can Enterprise Search find?',
  '/ai/hotel-brain': 'What can I ask Hotel Brain?',
  '/operations-center/weather': 'What weather actions should we take today?',
  '/operations-center/tasks': 'What tasks need attention?',
  '/operations-center/revenue': 'Explain the Operations revenue view',
  '/operations-center/market-intelligence': 'Explain the market indicators',
  '/security-center': 'What security issues need attention?',
  '/security-center/cctv': 'How do I investigate an offline camera?',
  '/security-center/access-logs': 'What access results need escalation?',
  '/security-center/visitors': 'What visitor records need attention?',
  '/security-center/alerts': 'Which alerts are most urgent?',
  '/incidents': 'What incidents need attention now?',
  '/operations/smart-building': 'How do non-IoT assets get monitored?',
  '/maintenance-center': 'What maintenance issues are urgent?',
  '/users': 'Explain roles and module permissions',
  '/settings': 'Explain the Settings sections',
  '/settings?tab=integrations': 'How do I configure and verify an integration?',
};

const NAV_TARGETS: Array<ChatAction & { keywords: string[]; permission?: string }> = [
  { label: 'Open Bookings', path: '/bookings', keywords: ['booking', 'reservation', 'arrival', 'departure', 'check-in', 'check in'], permission: 'bookings' },
  { label: 'Open Guests', path: '/guests', keywords: ['guest', 'profile'], permission: 'guests' },
  { label: 'Open Rooms', path: '/rooms', keywords: ['room', 'occupancy'], permission: 'rooms' },
  { label: 'Open Inventory', path: '/inventory', keywords: ['inventory', 'stock', 'supplies'], permission: 'inventory' },
  { label: 'Open Calendar', path: '/calendar', keywords: ['calendar', 'schedule', 'event'], permission: 'calendar' },
  { label: 'Open Housekeeping', path: '/housekeeping', keywords: ['housekeeping', 'clean', 'dirty', 'readiness'], permission: 'housekeeping' },
  { label: 'Open Maintenance', path: '/maintenance-center', keywords: ['maintenance', 'repair', 'fault'], permission: 'maintenance_center' },
  { label: 'Open CCTV', path: '/security-center/cctv', keywords: ['camera', 'cctv', 'nvr', 'onvif'], permission: 'security_center' },
  { label: 'Open Security Center', path: '/security-center', keywords: ['security'], permission: 'security_center' },
  { label: 'Open Financials', path: '/financials', keywords: ['finance', 'financial', 'revenue', 'payment', 'invoice'], permission: 'financials' },
  { label: 'Open Reports', path: '/reports', keywords: ['report', 'reporting', 'export'], permission: 'financials' },
  { label: 'Open Reviews', path: '/reviews', keywords: ['review', 'rating', 'sentiment'], permission: 'reviews' },
  { label: 'Open Concierge', path: '/concierge', keywords: ['concierge', 'guest request'], permission: 'concierge' },
  { label: 'Open Messages', path: '/messages', keywords: ['message', 'chat', 'conversation'], permission: 'messages' },
  { label: 'Open Calls', path: '/calls', keywords: ['call', 'phone', 'voice'], permission: 'messages' },
  { label: 'Open Incident Center', path: '/incidents', keywords: ['incident'], permission: 'incident_management' },
  { label: 'Open Smart Building', path: '/operations/smart-building', keywords: ['smart building', 'sensor', 'hvac', 'energy'], permission: 'smart_building' },
  { label: 'Open Integration Manager', path: '/settings?tab=integrations', keywords: ['integration manager', 'settings > integrations', 'settings, then integrations', 'setup flow', 'add camera / nvr'], permission: 'settings' },
  { label: 'Open Settings', path: '/settings', keywords: ['setting', 'configuration'], permission: 'settings' },
  { label: 'Open User Management', path: '/users', keywords: ['user', 'access request', 'permission'], permission: 'users' },
  { label: 'Open Enterprise Search', path: '/operations-center/search', keywords: ['search', 'find'], permission: 'bookings' },
  { label: 'Open Hotel Brain', path: '/ai/hotel-brain', keywords: ['hotel brain', 'insight', 'analyse', 'analyze'], permission: 'bookings' },
  { label: 'Open Weather', path: '/operations-center/weather', keywords: ['weather', 'forecast'], permission: 'bookings' },
  { label: 'Open Tasks', path: '/operations-center/tasks', keywords: ['task', 'assigned work'], permission: 'bookings' },
  { label: 'Open Command Center', path: '/enterprise-command-center', keywords: ['command center', 'enterprise command'], permission: 'dashboard' },
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
  const matchingRoute = Object.keys(PAGE_FOCUS_PROMPTS)
    .filter((route) => route === pathname || (route !== '/' && pathname.startsWith(`${route}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const focusPrompt = PAGE_FOCUS_PROMPTS[matchingRoute || '/'] || 'What should I prioritise today?';
  const prompts = [`Explain the ${page} page`, `What should I review first here?`, focusPrompt];
  return prompts;
}

function getNavigationActions(text: string, role?: string, permissions?: string[]) {
  const normalized = text.toLowerCase();
  const canAccess = (permission?: string) => role === 'ADMIN' || !permission || permissions?.includes(permission);
  const cameraSetupIntent =
    /(camera|cctv|nvr|onvif)/.test(normalized) &&
    /(add|install|connect|configure|set up|setup|integrate|discover|import)/.test(normalized);
  const preferred: ChatAction[] = cameraSetupIntent && canAccess('settings')
    ? [{ label: 'Open Integration Manager', path: '/settings?tab=integrations' }]
    : [];
  const matched = NAV_TARGETS.filter((target) => {
    const allowed = role === 'ADMIN' || !target.permission || permissions?.includes(target.permission);
    return allowed && target.keywords.some((keyword) => normalized.includes(keyword));
  }).map(({ label, path }) => ({ label, path }));
  return [...preferred, ...matched]
    .filter((action, index, actions) => actions.findIndex((item) => item.path === action.path) === index)
    .slice(0, 2);
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
  const compactAuditLauncher = location.pathname === '/settings'
    && new URLSearchParams(location.search).get('tab') === 'audit-trail';
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

  const currentRoute = `${location.pathname}${location.search}`;
  const currentPage = useMemo(() => getPageName(currentRoute), [currentRoute]);
  const prompts = useMemo(() => getPrompts(currentRoute), [currentRoute]);
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
      const operationsRoute = location.pathname === '/operations-center' || location.pathname.startsWith('/operations-center/');
      const effectiveMode: AssistantMode = operationsRoute && mode === 'general' ? 'operations' : mode;
      const response = await assistantService.chat({
        message: value,
        mode: effectiveMode,
        conversationId,
        context: {
          route: currentRoute,
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
        quickReplies: Array.isArray(response.suggestedPrompts)
          ? response.suggestedPrompts.filter((prompt) => typeof prompt === 'string' && prompt.trim()).slice(0, 3)
          : [],
        supportOffer: response.needsHumanSupport,
        supportSummary: value,
      }]);
      setAssistantLive(true);
    } catch (error) {
      const shouldOfferSupport =
        !axios.isAxiosError(error) ||
        ![401, 403].includes(error.response?.status || 0);
      setMessages((previous) => [...previous, {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        text: describeError(error),
        supportOffer: shouldOfferSupport,
        supportSummary: value,
      }]);
      if (!axios.isAxiosError(error) || error.response?.status !== 429) {
        setAssistantLive(false);
      }
    } finally {
      setIsSending(false);
    }
  };

  const requestHumanHandoff = async (noteOverride?: string) => {
    const note = (noteOverride ?? handoffText).trim();
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
        source: 'APP', notifySupport: false, priority: 'MEDIUM', status: 'PENDING',
      });
      const supportThread = await messageService.getOrCreateLiveSupportThread(
        `[LaFlo Assistant] ${note}`,
        `Live support requested from ${currentPage} by ${user?.firstName || 'User'}`
      );
      const supportWasNotified = supportThread.handoffNotification?.emailSent === true;
      setMessages((previous) => [...previous, {
        id: `handoff-${Date.now()}`,
        role: 'assistant',
        text: supportWasNotified
          ? 'A support assistant has been notified by email. Your private support conversation is ready in Messages.'
          : 'Your private support conversation is ready in Messages. The support email notification is pending, so you can still open the thread now.',
        actions: [{ label: 'Open support conversation', path: `/messages?thread=${supportThread.id}` }],
      }]);
      setHandoffRequested(false);
      setHandoffText('');
      if (supportWasNotified) {
        toast.success('Support mailbox notified');
      } else {
        toast('Support conversation opened; email delivery pending');
      }
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
          <header className='flex items-center justify-between gap-3 bg-gradient-to-r from-primary-800 to-primary-600 px-4 py-3 text-primary-contrast'>
            <div className='flex min-w-0 items-center gap-3'>
              <span className='h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-white/20'>
                <img src='/assets/laflo-ai-agent-transparent.png' alt='LaFlo AI Agent' className='h-full w-full object-contain' />
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
                  <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-primary-solid text-primary-contrast' : 'rounded-bl-md border border-border bg-card text-text-main shadow-sm'}`}>
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
                  {message.quickReplies?.length ? (
                    <div className='mt-2 flex flex-col gap-1.5'>
                      {message.quickReplies.map((prompt) => (
                        <button
                          key={prompt}
                          type='button'
                          onClick={() => void sendMessage(prompt)}
                          disabled={isSending}
                          className='rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.supportOffer ? (
                    <div className='mt-2 flex flex-wrap gap-2'>
                      <button
                        type='button'
                        onClick={() => {
                          setMessages((current) => current.map((item) =>
                            item.id === message.id ? { ...item, supportOffer: false } : item
                          ));
                          void requestHumanHandoff(message.supportSummary);
                        }}
                        className='rounded-lg bg-primary-solid px-3 py-1.5 text-xs font-semibold text-primary-contrast hover:bg-primary-hover'
                      >
                        Yes, contact support
                      </button>
                      <button
                        type='button'
                        onClick={() => setMessages((current) => current.map((item) =>
                          item.id === message.id ? { ...item, supportOffer: false } : item
                        ))}
                        className='rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50'
                      >
                        No, thanks
                      </button>
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
                <button type='submit' disabled={isSending || !input.trim()} className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-solid text-primary-contrast hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-border' aria-label='Send message'>
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
            {conversationId ? (
              <div className='mt-2 flex items-center gap-2 border-t border-slate-100 pt-2'>
                <button type='button' onClick={() => void assistantService.downloadTranscript(conversationId).catch(() => toast.error('Transcript download failed.'))} className='inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700'>
                  <Download className='h-3.5 w-3.5' />Download transcript
                </button>
                <span className='text-slate-200'>|</span>
                <button type='button' onClick={async () => {
                  const to = window.prompt('Send transcript to email:', user?.email || '');
                  if (!to?.trim()) return;
                  try {
                    await assistantService.emailTranscript({ conversationId, to: to.trim() });
                    toast.success('Transcript sent');
                  } catch {
                    toast.error('Transcript email failed.');
                  }
                }} className='inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700'>
                  <Mail className='h-3.5 w-3.5' />Email transcript
                </button>
              </div>
            ) : null}
            <p className='mt-2 text-center text-[10px] text-slate-400'>Answers respect your LaFlo access permissions. Confirm important operational decisions.</p>
          </div>
        </section>
      ) : (
        <button ref={launcherRef} type='button' onClick={() => setOpen(true)} className={compactAuditLauncher ? 'grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-primary-solid text-primary-contrast shadow-md transition-transform hover:scale-105 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2' : 'flex items-center gap-1.5 rounded-xl bg-primary-solid py-1.5 pl-1.5 pr-3 text-xs font-semibold text-primary-contrast shadow-md transition-transform hover:scale-[1.02] hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2'} aria-label='Open LaFlo Assistant'>
          <span className={compactAuditLauncher ? 'h-9 w-9' : 'h-9 w-9'}><img src='/assets/laflo-ai-agent-transparent.png' alt='' aria-hidden='true' className='h-full w-full object-contain' /></span><span className={compactAuditLauncher ? 'sr-only' : 'hidden sm:inline'}>Ask LaFlo</span>
        </button>
      )}
    </div>
  );
}
