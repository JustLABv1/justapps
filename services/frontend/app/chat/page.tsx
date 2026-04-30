'use client';

import { AppStoreGate } from '@/components/AppStoreGate';
import { ChatMarkdown } from '@/components/ChatMarkdown';
import { GroupIcon } from '@/components/GroupIcon';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import {
    AIConversation,
    AIMessage,
    AIProviderSummary,
    deleteAIConversation,
    getAIConversation,
    listAIConversations,
    listAIProviders,
    listPublicAIProviders,
    sendAIMessage,
    sendPublicAIMessage,
} from '@/lib/ai';
import { allowsAnonymousAI } from '@/lib/ai-access';
import { fetchApi } from '@/lib/api';
import {
    createGuestConversationId,
    createGuestUserMessage,
    deleteGuestAIConversation,
    getGuestAIConversation,
    getPreferredGuestAIConversation,
    listGuestAIConversations,
    normalizePublicAssistantMessage,
    toPublicAIHistory,
    upsertGuestAIConversation,
} from '@/lib/guest-ai';
import { Button, ListBox, Select } from '@heroui/react';
import { Bot, Loader2, MessageCircle, PanelLeft, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const QUICK_PROMPTS = [
  'Welche Apps gibt es aktuell?',
  'Fasse mir die wichtigsten Änderungen der letzten Version zusammen.',
  'Wie installiere ich diese Anwendung?',
  'Welche App passt zu meinem Anwendungsfall?',
];

function initialChatParams(): { appId?: string; guestConversationId?: string } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    appId: params.get('appId') || undefined,
    guestConversationId: params.get('guestConversationId') || undefined,
  };
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1.5">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.32s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.16s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
    </div>
  );
}

function ProviderSelector({
  providers,
  providerKey,
  onChange,
}: {
  providers: AIProviderSummary[];
  providerKey: string;
  onChange: (key: string) => void;
}) {
  if (providers.length === 0) return null;
  return (
    <Select
      aria-label="AI-Provider"
      selectedKey={providerKey || providers[0]?.key || ''}
      onSelectionChange={(key) => onChange(String(key))}
    >
      <Select.Trigger className="bg-field-background">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {providers.map((p) => (
            <ListBox.Item key={p.key} id={p.key} textValue={p.label}>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{p.label}</span>
                <span className="text-xs text-muted">{p.chatModel}</span>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function ChatPageContent() {
  const { user, loading: authLoading } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [providerKey, setProviderKey] = useState('');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [conversationLoading, setConversationLoading] = useState(false);
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backgroundApps, setBackgroundApps] = useState<{ icon: string; name: string; category: string; style: React.CSSProperties }[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatParams = useMemo(() => initialChatParams(), []);
  const appId = chatParams?.appId;
  const preferredGuestConversationId = chatParams?.guestConversationId;
  const aiDisabled = settingsLoaded && !settings.aiEnabled;
  const anonymousAIAllowed = allowsAnonymousAI(settings);
  const guestMode = !user && anonymousAIAllowed;
  const accessDenied = !authLoading && settingsLoaded && (aiDisabled || (!user && !anonymousAIAllowed));
  const dataScopeKey = !authLoading && settingsLoaded && !accessDenied
    ? [user?.id || 'guest', guestMode ? 'guest' : 'auth', appId || '', preferredGuestConversationId || ''].join(':')
    : null;
  const loading = !accessDenied && (
    authLoading
    || !settingsLoaded
    || conversationLoading
    || (dataScopeKey !== null && loadedScopeKey !== dataScopeKey)
  );
  const visibleError = accessDenied || loading ? null : error;
  const accessDeniedTitle = aiDisabled
    ? 'AI Chat ist derzeit deaktiviert'
    : 'AI Chat nur nach Anmeldung verfügbar';
  const accessDeniedDescription = aiDisabled
    ? 'Diese Instanz hat die AI-Funktion in den Plattform-Einstellungen deaktiviert. Ein Administrator kann sie in der Verwaltung wieder aktivieren.'
    : 'Diese Instanz erlaubt derzeit keinen anonymen AI-Zugriff. Melden Sie sich an oder passen Sie die Plattform-Einstellungen an.';

  useEffect(() => {
    if (!dataScopeKey) return;

    let active = true;

    void (async () => {
      try {
        const providerData = guestMode ? await listPublicAIProviders() : await listAIProviders();
        if (!active) return;
        const defaultProvider = providerData.find((provider) => provider.default) || providerData[0];
        setProviders(providerData);
        setProviderKey((current) => providerData.some((provider) => provider.key === current) ? current : (defaultProvider?.key || ''));

        if (guestMode) {
          const guestConversations = listGuestAIConversations();
          const selectedConversation = getPreferredGuestAIConversation(appId, preferredGuestConversationId);
          if (!active) return;
          setConversations(guestConversations);
          setActiveConversation(selectedConversation);
          setMessages(selectedConversation?.messages || []);
          setError(null);
          return;
        }

        const conversationData = await listAIConversations();
        if (!active) return;
        setConversations(conversationData);
        setActiveConversation(null);
        setMessages([]);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'AI Chat konnte nicht geladen werden.');
      } finally {
        if (active) setLoadedScopeKey(dataScopeKey);
      }
    })();

    return () => {
      active = false;
    };
  }, [appId, dataScopeKey, guestMode, preferredGuestConversationId]);

  useEffect(() => {
    let active = true;
    fetchApi('/apps')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) {
          const positions = [
            { top: '15%', left: '15%', animationName: 'float1', animationDuration: '6.5s', animationDelay: '0s' },
            { top: '22%', right: '15%', animationName: 'float2', animationDuration: '8s', animationDelay: '-2.5s' },
            { top: '45%', left: '8%', animationName: 'float3', animationDuration: '7s', animationDelay: '-1s' },
            { top: '55%', right: '8%', animationName: 'float1', animationDuration: '9s', animationDelay: '-4s' },
            { bottom: '25%', left: '20%', animationName: 'float2', animationDuration: '7.5s', animationDelay: '-3s' },
            { bottom: '20%', right: '20%', animationName: 'float3', animationDuration: '8.5s', animationDelay: '-1.5s' },
          ];
          const shuffled = [...data].sort(() => 0.5 - Math.random()).slice(0, positions.length);
          const mapped = shuffled.map((app: { name: string; icon?: string; categories?: string[] }, index: number) => ({
            icon: app.icon || '🚀',
            name: app.name,
            category: Array.isArray(app.categories) && app.categories.length > 0 ? app.categories[0] : 'App',
            style: positions[index % positions.length],
          }));
          setBackgroundApps(mapped);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const startNewChat = useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
    setDraft('');
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, []);

  const applyQuickPrompt = useCallback(
    (text: string) => {
      setDraft(text);
      requestAnimationFrame(() => {
        autoResize();
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(text.length, text.length);
      });
    },
    [autoResize]
  );

  const loadConversation = async (conversation: AIConversation) => {
    setError(null);
	if (guestMode) {
		const guestConversation = getGuestAIConversation(conversation.id) || conversation;
		setActiveConversation(guestConversation);
		setMessages(guestConversation.messages || []);
		return;
	}
    setConversationLoading(true);
    try {
      const data = await getAIConversation(conversation.id);
      setActiveConversation(data);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konversation konnte nicht geladen werden.');
    } finally {
      setConversationLoading(false);
    }
  };

  const removeConversation = async (conversation: AIConversation) => {
    try {
		if (guestMode) {
			const nextConversations = deleteGuestAIConversation(conversation.id);
			setConversations(nextConversations);
			if (activeConversation?.id === conversation.id) startNewChat();
			return;
		}

      await deleteAIConversation(conversation.id);
      setConversations((c) => c.filter((item) => item.id !== conversation.id));
      if (activeConversation?.id === conversation.id) startNewChat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konversation konnte nicht gelöscht werden.');
    }
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending || accessDenied) return;
    setDraft('');
    setError(null);
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

  if (guestMode) {
    const previousMessages = messages;
    const nextConversationId = activeConversation?.id || createGuestConversationId();
    const userMessage = createGuestUserMessage(nextConversationId, message);
    setMessages([...previousMessages, userMessage]);
    try {
      const response = await sendPublicAIMessage({
        message,
        appId: activeConversation?.appId || appId,
        providerKey,
        history: toPublicAIHistory(previousMessages),
      });
      const assistantMessage = normalizePublicAssistantMessage(nextConversationId, response.assistantMessage);
      const { conversation, conversations: nextConversations } = upsertGuestAIConversation({
        conversationId: nextConversationId,
        appId: activeConversation?.appId || appId,
        createdAt: activeConversation?.createdAt,
        messages: [...previousMessages, userMessage, assistantMessage],
      });
      setActiveConversation(conversation);
      setMessages(conversation.messages || []);
      setConversations(nextConversations);
    } catch (err) {
      setMessages(previousMessages);
      setError(err instanceof Error ? err.message : 'Die AI-Antwort konnte nicht erzeugt werden.');
    } finally {
      setSending(false);
    }
    return;
  }

    setMessages((current) => [...current, {
      id: `local-${Date.now()}`,
      conversationId: activeConversation?.id || '',
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
      sources: [],
    }]);
    try {
      const response = await sendAIMessage({
        conversationId: activeConversation?.id,
        message,
        appId: activeConversation?.appId || appId,
        providerKey,
      });
      setActiveConversation(response.conversation);
      setMessages((current) => [...current, response.assistantMessage]);
      setConversations((current) => {
        const without = current.filter((item) => item.id !== response.conversation.id);
        return [response.conversation, ...without];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die AI-Antwort konnte nicht erzeugt werden.');
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(draft.trim()) && !sending && providers.length > 0;

  return (
    <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden bg-surface">
      <div className="flex min-h-0 flex-1 overflow-hidden">

      {/* ── Collapsible sidebar ── */}
      <aside
        className={`flex h-full flex-col border-r border-border/60 bg-surface/95 backdrop-blur-sm transition-[width] duration-200 ease-in-out ${sidebarOpen ? 'w-[21rem] min-w-[21rem]' : 'w-0 min-w-0 overflow-hidden border-r-0'}`}
      >
        {/* Sidebar header */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="truncate text-sm font-semibold text-foreground">JustApps AI</span>
          </div>
          <Button
            isIconOnly
            aria-label="Seitenleiste schließen"
            size="sm"
            variant="ghost"
            className="shrink-0 text-muted"
            onPress={() => setSidebarOpen(false)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* New chat */}
        <div className="border-b border-border/50 px-3 pb-3 pt-3">
          <Button variant="secondary" fullWidth className="justify-start gap-2 text-sm" onPress={startNewChat}>
            <Plus className="h-4 w-4" />
            Neuer Chat
          </Button>

          {/* Provider selector */}
          {providers.length > 0 && (
            <div className="pt-3">
              <ProviderSelector providers={providers} providerKey={providerKey} onChange={setProviderKey} />
            </div>
          )}
        </div>

        <div className="px-4 pb-2 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Chats</p>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {!loading && conversations.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted">Noch keine Chats vorhanden.</p>
          )}
          <div className="space-y-1.5">
            {conversations.map((conversation) => {
              const isActive = activeConversation?.id === conversation.id;
              return (
                <div
                  key={conversation.id}
                  className={`group flex items-center rounded-xl border px-1 transition-colors ${isActive ? 'border-accent/20 bg-accent/10' : 'border-transparent hover:bg-surface-secondary'}`}
                >
                  <button
                    className="min-w-0 flex-1 px-2.5 py-2.5 text-left"
                    onClick={() => void loadConversation(conversation)}
                    type="button"
                  >
                    <p className={`truncate text-sm ${isActive ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                      {conversation.title || 'Neuer Chat'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {new Date(conversation.updatedAt).toLocaleDateString('de-DE')}
                    </p>
                  </button>
                  <Button
                    isIconOnly
                    aria-label="Konversation löschen"
                    size="sm"
                    variant="ghost"
                    className="mr-1 h-7 w-7 shrink-0 text-muted opacity-0 group-hover:opacity-100"
                    onPress={() => void removeConversation(conversation)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        {!sidebarOpen && (
          <div className="pointer-events-none absolute left-6 top-4 z-10 flex items-start gap-3 lg:left-10">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-border/70 bg-overlay/90 p-2 shadow-sm backdrop-blur-xl">
              <Button
                isIconOnly
                aria-label="Seitenleiste öffnen"
                size="sm"
                variant="ghost"
                className="text-muted"
                onPress={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button
                isIconOnly
                aria-label="Neuer Chat"
                size="sm"
                variant="ghost"
                className="text-muted"
                onPress={startNewChat}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {providers.length > 0 && (
              <div className="pointer-events-auto w-56">
                <ProviderSelector providers={providers} providerKey={providerKey} onChange={setProviderKey} />
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto">
          <div className={`w-full px-6 pb-44 lg:px-10 ${messages.length === 0 && !loading && !accessDenied ? 'pt-0' : sidebarOpen ? 'pt-8' : 'pt-24'}`}>
            {accessDenied ? (
				<div className="mx-auto flex max-w-2xl flex-col items-center gap-5 pt-[14vh] text-center">
				  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
					<Sparkles className="h-8 w-8" />
				  </div>
				  <div>
          <p className="text-xl font-semibold text-foreground">{accessDeniedTitle}</p>
					<p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            {accessDeniedDescription}
					</p>
				  </div>
				</div>
            ) : loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="relative mx-auto flex min-h-[calc(100vh-18rem)] w-full flex-col items-center justify-center gap-5 py-10 text-center">
                {/* Floating Background Apps */}
                <div className="absolute inset-0 z-0 pointer-events-none hidden xl:block opacity-30 mix-blend-luminosity">
                  {backgroundApps.map((app) => (
                    <div
                      key={app.name}
                      className="absolute flex w-44 items-center gap-2.5 overflow-hidden rounded-xl border border-border/40 bg-surface/50 px-3.5 py-2.5 shadow-sm backdrop-blur-sm select-none transition-transform"
                      style={{
                        ...(app.style as React.CSSProperties),
                        animationIterationCount: 'infinite',
                        animationTimingFunction: 'ease-in-out',
                        animationFillMode: 'both',
                      }}
                    >
                      <GroupIcon icon={app.icon} name={app.name} className="h-9 w-9 shrink-0 rounded-lg bg-accent/10 text-accent" />
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="text-xs font-bold text-foreground truncate">{app.name}</span>
                        <span className="text-[10px] text-muted truncate">{app.category}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent animate-fade-slide-up" style={{ animationDelay: '0s' }}>
                  <MessageCircle className="h-8 w-8" />
                </div>
                <div className="relative z-10 animate-fade-slide-up" style={{ animationDelay: '0.05s' }}>
                  <p className="text-xl font-semibold text-foreground">Womit kann ich helfen?</p>
                  {guestMode && (
					<p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted">Gastmodus mit lokalem Verlauf</p>
				  )}
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted animate-fade-slide-up" style={{ animationDelay: '0.1s' }}>
                    Fragen Sie nach Apps, Versionen, Dokumentation oder lassen Sie sich bei Auswahl und Einrichtung unterstützen.
                  </p>
                </div>
                <div className="relative z-10 flex max-w-2xl flex-wrap items-center justify-center gap-2">
                  {QUICK_PROMPTS.map((prompt, index) => (
                    <Button
                      key={prompt}
                      size="sm"
                      variant="secondary"
                      className="rounded-full px-3 animate-fade-slide-up"
                      style={{ animationDelay: `${0.2 + index * 0.05}s` }}
                      onPress={() => applyQuickPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-8 mx-auto max-w-3xl">
                {messages.map((message) =>
                  message.role === 'user' ? (
                    /* User: right-aligned rounded pill, no avatar */
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[min(72rem,92%)] rounded-3xl bg-surface-secondary px-5 py-3 text-sm leading-6 text-foreground shadow-sm">
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ) : (
                    /* Assistant: avatar + text on bare background, no bubble */
                    <div key={message.id} className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 w-full flex-1 pt-0.5">
                        <div className="text-sm leading-relaxed text-foreground">
                          <ChatMarkdown content={message.content} />
                        </div>
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {message.sources.slice(0, 5).map((source) => (
                              <span
                                key={`${source.chunkId}-${source.sourceId}`}
                                className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted"
                              >
                                {source.appName || source.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}

                {/* Typing indicator */}
                {sending && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 pt-1.5">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {visibleError && (
          <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 px-6 lg:px-10">
            <div className="pointer-events-auto w-full rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger shadow-sm">
              {visibleError}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

        {/* Floating composer */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-6 pb-6 lg:px-10 flex justify-center">
          <div className="pointer-events-auto w-full max-w-3xl">
            <div
              className={`flex items-end overflow-hidden rounded-[1.75rem] border bg-overlay/95 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-colors duration-200 ${canSend ? 'border-accent/40' : 'border-border/80'}`}
            >
              <div className="relative flex-1">
                {!draft && (
                  <div className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 text-sm leading-5 text-muted">
                    <span>Nachricht schreiben...</span>
                    <span className="ml-1.5">(Shift+Enter für Zeilenumbruch)</span>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  aria-label="Nachricht schreiben"
                  className="max-h-[200px] min-h-[54px] flex-1 resize-none bg-transparent px-4 py-[17px] text-sm leading-5 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-[height] duration-200 ease-in-out w-full"
                  disabled={sending}
                  rows={1}
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); autoResize(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                />
              </div>
              <div className="flex items-center px-3 py-3">
                <Button
                  isIconOnly
                  aria-label="Nachricht senden"
                  className={`h-10 w-10 rounded-2xl transition-colors ${canSend ? 'bg-accent text-white' : 'bg-surface-secondary text-muted'}`}
                  isDisabled={!canSend}
                  onPress={() => void handleSend()}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {providers.length === 0 && (
              <p className="mt-2 text-center text-xs text-muted">Kein aktiver AI-Provider konfiguriert.</p>
            )}
          </div>
        </div>
        </div>

      </div>
      </div>

    </div>
  );
}

export default function ChatPage() {
  return (
    <AppStoreGate>
      <ChatPageContent />
    </AppStoreGate>
  );
}
