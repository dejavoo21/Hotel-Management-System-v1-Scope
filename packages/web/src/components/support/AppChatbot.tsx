import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Bot, Compass, Download, Headphones, Mail, Plus, Send, Square, X } from 'lucide-react';
import { assistantService, conciergeService, messageService } from '@/services';
import type { AssistantMode } from '@/services/assistant';
import { useAuthStore } from '@/stores/authStore';
import { OPEN_LAFLO_ASSISTANT_EVENT, type OpenLafloAssistantDetail } from '@/lib/assistantEvents';
import { canAccess } from '@/lib/access';
import type { PermissionId } from '@/utils/userAccess';
import { findAskLafloActions, resolveAskLafloAction } from '@/features/ask-laflo/actionRegistry';
import { buildAskLafloContext } from '@/features/ask-laflo/context';
import { getAskLafloPageKnowledge } from '@/features/ask-laflo/knowledgeMap';
import { findAskLafloWalkthrough, askLafloWalkthroughs } from '@/features/ask-laflo/walkthroughs';
import type { AskLafloActionResolution, AskLafloAgentMode, AskLafloWalkthrough } from '@/features/ask-laflo/types';

type ChatAction = { label: string; path: string; actionId?: string; status?: AskLafloActionResolution['status'] };
type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  actions?: ChatAction[];
  quickReplies?: string[];
  supportOffer?: boolean;
  supportSummary?: string;
};
type PersistedState = { conversationId: string | null; messages: ChatMessage[]; walkthroughId?: string | null; walkthroughStep?: number };

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi, I’m LaFlo. Ask me anything about this page, hotel operations, or how to use LaFlo.',
};

const AGENT_MODE_LABELS: Record<AskLafloAgentMode, string> = {
  guide: 'Guide', explain: 'Explain', action: 'Action', troubleshoot: 'Troubleshoot', context: 'Context',
};

const toChatAction = (action: AskLafloActionResolution): ChatAction => ({
  label: action.status === 'restricted' ? `${action.displayName} · Permission required` : action.displayName,
  path: action.route,
  actionId: action.id,
  status: action.status,
});

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
  const [agentMode, setAgentMode] = useState<AskLafloAgentMode>('context');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [assistantLive, setAssistantLive] = useState<boolean | null>(null);
  const [launchContext, setLaunchContext] = useState<Record<string, unknown> | null>(null);
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [handoffText, setHandoffText] = useState('');
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [walkthrough, setWalkthrough] = useState<AskLafloWalkthrough | null>(null);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentRoute = `${location.pathname}${location.search}`;
  const pageKnowledge = useMemo(() => getAskLafloPageKnowledge(currentRoute), [currentRoute]);
  const runtimeContext = useMemo(() => buildAskLafloContext(currentRoute, user, launchContext), [currentRoute, launchContext, user]);
  const assistantPage = runtimeContext.page;
  const prompts = pageKnowledge.prompts.slice(0, 4);
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
      const savedWalkthrough = askLafloWalkthroughs.find((item) => item.id === parsed.walkthroughId) || null;
      setWalkthrough(savedWalkthrough);
      setWalkthroughStep(savedWalkthrough ? Math.min(parsed.walkthroughStep || 0, savedWalkthrough.steps.length - 1) : 0);
    } catch {
      setMessages([WELCOME]);
      setConversationId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const state: PersistedState = { conversationId, messages: messages.slice(-40), walkthroughId: walkthrough?.id || null, walkthroughStep };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [conversationId, messages, storageKey, walkthrough, walkthroughStep]);

  useEffect(() => {
    assistantService.status().then((status) => setAssistantLive(status.live)).catch(() => setAssistantLive(false));
  }, []);

  useEffect(() => {
    const openAssistant = (event: Event) => {
      const detail = (event as CustomEvent<OpenLafloAssistantDetail>).detail;
      if (detail?.mode) setMode(detail.mode);
      if (detail?.prompt) setInput(detail.prompt);
      setLaunchContext(detail?.context || null);
      setOpen(true);
    };
    window.addEventListener(OPEN_LAFLO_ASSISTANT_EVENT, openAssistant);
    return () => window.removeEventListener(OPEN_LAFLO_ASSISTANT_EVENT, openAssistant);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (typeof listRef.current?.scrollTo === 'function') {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight });
    }
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
    setLaunchContext(null);
    setHandoffRequested(false);
    setHandoffText('');
    setWalkthrough(null);
    setWalkthroughStep(0);
    setAgentMode('context');
    setInput('');
    inputRef.current?.focus();
  };

  const addAssistantMessage = (text: string, actions?: ChatAction[], quickReplies?: string[]) => {
    setMessages((previous) => [...previous, { id: `assistant-${Date.now()}-${previous.length}`, role: 'assistant', text, actions, quickReplies }]);
  };

  const startWalkthrough = (nextWalkthrough: AskLafloWalkthrough) => {
    if (nextWalkthrough.permission && !canAccess(user, nextWalkthrough.permission as PermissionId)) {
      setAgentMode('troubleshoot');
      addAssistantMessage(`You do not have permission to complete “${nextWalkthrough.title}”. Ask an administrator or a team member with ${nextWalkthrough.permission.replace(/_/g, ' ')} access to help. No restricted records have been shown.`);
      return;
    }
    setAgentMode('guide');
    setWalkthrough(nextWalkthrough);
    setWalkthroughStep(0);
    addAssistantMessage(`I’ve started “${nextWalkthrough.title}”. ${nextWalkthrough.purpose}`);
  };

  const stopWalkthrough = () => {
    setWalkthrough(null);
    setWalkthroughStep(0);
    setAgentMode('context');
    addAssistantMessage('Walkthrough stopped. Your hotel records were not changed.');
  };

  const runAction = (action: ChatAction) => {
    const resolution = action.actionId ? resolveAskLafloAction(action.actionId, user) : null;
    if (resolution?.status === 'restricted' || action.status === 'restricted') {
      setAgentMode('troubleshoot');
      addAssistantMessage(`You do not have permission to use “${resolution?.displayName || action.label}”. No restricted information has been opened.`);
      return;
    }
    if (resolution?.status === 'unavailable') {
      setAgentMode('troubleshoot');
      addAssistantMessage(resolution.fallback);
      return;
    }
    if (resolution?.status === 'guided-only') {
      const related = findAskLafloWalkthrough(`${resolution.displayName} ${resolution.aliases.join(' ')}`);
      if (related) {
        startWalkthrough(related);
        return;
      }
      addAssistantMessage(`I can guide you, but I cannot complete “${resolution.displayName}” directly. ${resolution.fallback}`, [{ label: 'Take me there', path: resolution.route }]);
      return;
    }
    if (resolution?.id === 'task.createFromAdvisory' && launchContext) {
      navigate(resolution.route, {
        state: {
          requestedAction: 'create',
          sourceSearchResult: {
            id: launchContext.advisoryId,
            title: launchContext.title || launchContext.advisoryTitle,
            summary: launchContext.reason || launchContext.summary,
            category: launchContext.department || launchContext.source,
            severity: launchContext.priority,
          },
        },
      });
    } else {
      navigate(action.path);
    }
    setOpen(false);
  };

  const answerPlatformRequest = (value: string): boolean => {
    const normalized = value.toLowerCase();
    const matchedWalkthrough = findAskLafloWalkthrough(value);
    if (matchedWalkthrough && (agentMode === 'guide' || /(how|help|show|walk|guide|create|assign|approve|reject|acknowledge|resolve|connect|test|change|add|edit)/.test(normalized))) {
      startWalkthrough(matchedWalkthrough);
      return true;
    }
    if (agentMode === 'explain' || /what (does|is).*page|explain (this|the).*page|what can you help with here/.test(normalized)) {
      setAgentMode('explain');
      const actions = pageKnowledge.actions.map((id) => resolveAskLafloAction(id, user)).filter((item): item is AskLafloActionResolution => Boolean(item)).map(toChatAction);
      addAssistantMessage(`${pageKnowledge.name}: ${pageKnowledge.description}${pageKnowledge.tabs.length ? ` Available sections include ${pageKnowledge.tabs.join(', ')}.` : ''}`, actions.slice(0, 3), pageKnowledge.prompts.slice(0, 3));
      return true;
    }
    if (agentMode === 'troubleshoot' || /why (can('|’)t|cannot)|unavailable|disconnected|not working|what does this warning mean/.test(normalized)) {
      setAgentMode('troubleshoot');
      const restricted = runtimeContext.restrictedActions.map((item) => item.displayName);
      const sourceNote = runtimeContext.sourceState === 'unavailable' ? 'The page reports that its live source is unavailable.' : runtimeContext.sourceState === 'stale' ? 'The page reports that its information may be out of date.' : 'Check the visible page state for a permission, unavailable, or disconnected message.';
      addAssistantMessage(`${sourceNote}${restricted.length ? ` Your role cannot use: ${restricted.join(', ')}.` : ''} I will not claim an action succeeded unless the page shows the saved outcome.`, runtimeContext.availableActions.slice(0, 2).map(toChatAction), ['Try again', 'What can you help with here?']);
      return true;
    }
    const actions = findAskLafloActions(value, user);
    if (actions.length && (agentMode === 'action' || /^(open|go|take|show me where|navigate)|\bopen\b|take me there/.test(normalized))) {
      setAgentMode('action');
      const ready = actions.filter((item) => item.status !== 'restricted');
      const restricted = actions.filter((item) => item.status === 'restricted');
      addAssistantMessage(restricted.length && !ready.length ? 'You do not have permission to open that workspace.' : 'I found the authorised platform action. Choose it when you are ready.', actions.map(toChatAction));
      return true;
    }
    if (/what information (are you using|can you use)|what (data|context|sources) (are you using|can you access)/.test(normalized)) {
      setAgentMode('context');
      const selected = runtimeContext.selectedRecord ? ' A selected record is included.' : '';
      const filters = Object.keys(runtimeContext.visibleFilters).length ? ` Visible filters: ${Object.entries(runtimeContext.visibleFilters).map(([key, value]) => `${key}=${String(value)}`).join(', ')}.` : '';
      addAssistantMessage(`I’m using your authorised ${pageKnowledge.name} context, the current route${runtimeContext.activeTab ? ` and ${runtimeContext.activeTab.replace(/-/g, ' ')} section` : ''}.${selected}${filters} Source state: ${runtimeContext.sourceState}. I do not include records or actions your role cannot access.`);
      return true;
    }
    return false;
  };

  const sendMessage = async (text: string) => {
    const value = text.trim();
    if (!value || isSending) return;
    setMessages((previous) => [...previous, { id: `user-${Date.now()}`, role: 'user', text: value }]);
    setInput('');
    if (answerPlatformRequest(value)) return;
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
          ...(launchContext || {}),
          askLafloContext: runtimeContext,
          route: currentRoute,
          pageTitle: assistantPage,
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
        actions: findAskLafloActions(`${value} ${reply}`, user).map(toChatAction),
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
        title: `Assistant handoff — ${assistantPage}`,
        details: [
          `Requested by: ${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
          `Email: ${user?.email || '-'}`,
          `Page: ${assistantPage} (${location.pathname})`,
          `Issue: ${note}`,
          '',
          'Recent assistant transcript:',
          transcript,
        ].join('\n'),
        source: 'APP', notifySupport: false, priority: 'MEDIUM', status: 'PENDING',
      });
      const supportThread = await messageService.getOrCreateLiveSupportThread(
        `[Ask LaFlo] ${note}`,
        `Live support requested from ${assistantPage} by ${user?.firstName || 'User'}`
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
    <div className='fixed bottom-2 right-4 z-[80] sm:bottom-3 sm:right-6'>
      {open ? (
        <section role='dialog' aria-label='Ask LaFlo' className='flex h-[min(760px,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] w-[min(470px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl'>
          <header className='flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-primary-800 to-primary-600 px-4 py-3 text-primary-contrast'>
            <div className='flex min-w-0 items-center gap-3'>
              <span className='h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-white/20'>
                <img src='/assets/laflo-ai-agent-transparent.png' alt='LaFlo AI Agent' className='h-full w-full object-contain' />
              </span>
              <div className='min-w-0'>
                <h2 className='truncate text-sm font-semibold'>Ask LaFlo</h2>
                <p className='flex items-center gap-1.5 text-xs text-emerald-50/80'>
                  <span className={`h-1.5 w-1.5 rounded-full ${assistantLive === false ? 'bg-amber-300' : 'bg-emerald-300'}`} />
                  {assistantLive === false ? 'Temporarily unavailable' : `Helping with ${assistantPage}`}
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
          <div className='shrink-0 border-b border-slate-100 bg-slate-50 px-3 py-2.5'>
            <div className='flex items-center justify-between gap-2'>
              <span className='truncate text-xs text-slate-500'>Current context: <strong className='font-medium text-slate-700'>{assistantPage}</strong>{runtimeContext.activeTab ? ` · ${runtimeContext.activeTab.replace(/-/g, ' ')}` : ''}</span>
              <select value={agentMode} onChange={(event) => setAgentMode(event.target.value as AskLafloAgentMode)} className='h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700' aria-label='Ask LaFlo mode'>
                {Object.entries(AGENT_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className='mt-2 flex items-center gap-2 text-[10px] text-slate-500'>
              <span className='inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200'><Compass className='h-3 w-3' />{pageKnowledge.name}</span>
              <span className={`rounded-full px-2 py-1 ${runtimeContext.sourceState === 'restricted' ? 'bg-amber-100 text-amber-800' : runtimeContext.sourceState === 'unavailable' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{runtimeContext.sourceState === 'unknown' ? 'Page context ready' : `${runtimeContext.sourceState} information`}</span>
              {runtimeContext.selectedRecord ? <span className='rounded-full bg-blue-100 px-2 py-1 text-blue-700'>Record context</span> : null}
            </div>
          </div>
          <div ref={listRef} className='min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/60 p-3' aria-live='polite'>
            {walkthrough ? (() => {
              const currentStep = walkthrough.steps[walkthroughStep];
              const isLastStep = walkthroughStep === walkthrough.steps.length - 1;
              return (
                <section aria-label='Walkthrough progress' className='rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm'>
                  <div className='flex items-start justify-between gap-3'>
                    <div><p className='text-[10px] font-bold uppercase tracking-wide text-blue-700'>Guide · Step {walkthroughStep + 1} of {walkthrough.steps.length}</p><h3 className='mt-1 text-sm font-semibold text-slate-900'>{walkthrough.title}</h3></div>
                    <button type='button' onClick={stopWalkthrough} aria-label='Stop walkthrough' className='rounded-lg p-1.5 text-slate-500 hover:bg-white'><Square className='h-3.5 w-3.5' /></button>
                  </div>
                  <div className='mt-3 rounded-xl bg-white p-3 ring-1 ring-blue-100'>
                    <p className='text-sm font-semibold text-slate-900'>{currentStep.title}</p>
                    <p className='mt-1 text-xs leading-5 text-slate-600'>{currentStep.instruction}</p>
                    {currentStep.target ? <p className='mt-2 text-[11px] text-blue-700'>Look for: <strong>{currentStep.target}</strong></p> : null}
                    <p className='mt-2 text-[10px] text-slate-500'>Complete when: {currentStep.completionCondition}</p>
                    <button type='button' onClick={() => navigate(currentStep.route)} className='mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white'>Take me there <ArrowRight className='h-3 w-3' /></button>
                  </div>
                  <div className='mt-3 flex items-center justify-between gap-2'>
                    <button type='button' disabled={walkthroughStep === 0} onClick={() => setWalkthroughStep((step) => Math.max(0, step - 1))} className='inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 disabled:opacity-40'><ArrowLeft className='h-3 w-3' />Back</button>
                    <button type='button' onClick={() => { if (isLastStep) { setWalkthrough(null); setWalkthroughStep(0); addAssistantMessage(`Walkthrough complete: ${walkthrough.title}. Confirm the visible page outcome before treating the work as finished.`); } else setWalkthroughStep((step) => step + 1); }} className='inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white'>{isLastStep ? 'Finish guide' : 'Next'}<ArrowRight className='h-3 w-3' /></button>
                  </div>
                </section>
              );
            })() : null}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className='max-w-[88%]'>
                  <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-primary-solid text-primary-contrast' : 'rounded-bl-md border border-border bg-card text-text-main shadow-sm'}`}>
                    {message.text}
                  </div>
                  {message.actions?.length ? (
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {message.actions.map((action) => (
                        <button key={`${action.actionId || action.path}-${action.label}`} type='button' onClick={() => runAction(action)} className={`inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium ${action.status === 'restricted' ? 'border-amber-200 text-amber-800 hover:bg-amber-50' : 'border-teal-200 text-teal-800 hover:bg-teal-50'}`}>
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
              <div className='space-y-2'>
                <button type='button' onClick={() => void sendMessage('What can you help with here?')} className='w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-teal-300 hover:bg-teal-50'><span className='block text-xs font-semibold text-slate-800'>What can I help with here?</span><span className='mt-1 block text-[11px] leading-5 text-slate-500'>{pageKnowledge.description}</span></button>
                <div className='flex flex-wrap gap-2'>
                {prompts.map((prompt) => (
                  <button key={prompt} type='button' onClick={() => void sendMessage(prompt)} className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 hover:border-teal-300 hover:bg-teal-50' disabled={isSending}>
                    {prompt}
                  </button>
                ))}
                </div>
              </div>
            ) : null}
            {isSending ? (
              <div className='flex justify-start'>
                <div className='inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-500'>
                  <Bot className='h-4 w-4 animate-pulse text-teal-600' />{agentMode === 'action' ? 'Running action…' : 'Working…'}
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
          <div className='max-h-[42dvh] shrink-0 overflow-y-auto border-t border-slate-200 bg-white p-3'>
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
        <button ref={launcherRef} type='button' onClick={() => { setLaunchContext(null); setOpen(true); }} className='flex min-h-11 items-center gap-2 rounded-2xl bg-primary-solid px-3 py-2 text-xs font-semibold text-primary-contrast shadow-lg ring-1 ring-black/5 transition-transform hover:scale-[1.02] hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2' aria-label='Open Ask LaFlo'>
          <span className='relative h-[18px] w-[18px] shrink-0 overflow-hidden' aria-hidden='true'><img src='/laflo-logo.png' alt='' className='absolute -right-[5px] -top-[8px] h-[35px] w-auto max-w-none' /></span><span className='whitespace-nowrap'>Ask LaFlo</span>
        </button>
      )}
    </div>
  );
}
