'use client';

import { ChatMarkdown } from '@/components/ChatMarkdown';
import { Footer } from '@/components/Footer';
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

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [providerKey, setProviderKey] = useState('');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatParams = useMemo(() => initialChatParams(), []);
  const appId = chatParams?.appId;
  const preferredGuestConversationId = chatParams?.guestConversationId;
  const guestMode = !user && settings.allowAnonymousAI;
  const accessDenied = !authLoading && settingsLoaded && !user && !settings.allowAnonymousAI;

  useEffect(() => {
    if (authLoading || !settingsLoaded) return;

  if (!user && !settings.allowAnonymousAI) {
    setProviders([]);
    setProviderKey('');
    setConversations([]);
    setActiveConversation(null);
    setMessages([]);
    setError(null);
    setLoading(false);
    return;
  }

  let active = true;
  setLoading(true);
  setError(null);

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
        return;
      }

      const conversationData = await listAIConversations();
      if (!active) return;
      setConversations(conversationData);
      setActiveConversation(null);
      setMessages([]);
    } catch (err) {
      if (active) setError(err instanceof Error ? err.message : 'AI Chat konnte nicht geladen werden.');
    } finally {
      if (active) setLoading(false);
    }
  })();

  return () => {
    active = false;
  };
  }, [appId, authLoading, guestMode, preferredGuestConversationId, settings.allowAnonymousAI, settingsLoaded, user]);

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
    setLoading(true);
    try {
      const data = await getAIConversation(conversation.id);
      setActiveConversation(data);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konversation konnte nicht geladen werden.');
    } finally {
      setLoading(false);
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

  const activeProvider = providers.find((p) => p.key === providerKey);
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
              <Sparkles className="h-3.5 w-3.5" />
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
          <div className={`w-full px-6 pb-44 lg:px-10 ${sidebarOpen ? 'pt-8' : 'pt-24'}`}>
            {accessDenied ? (
				<div className="mx-auto flex max-w-2xl flex-col items-center gap-5 pt-[14vh] text-center">
				  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
					<Sparkles className="h-8 w-8" />
				  </div>
				  <div>
					<p className="text-xl font-semibold text-foreground">AI Chat nur nach Anmeldung verfügbar</p>
					<p className="mt-3 max-w-xl text-sm leading-6 text-muted">
					  Diese Instanz erlaubt derzeit keinen anonymen AI-Zugriff. Melden Sie sich an oder aktivieren Sie die Funktion in den Plattform-Einstellungen.
					</p>
				  </div>
				</div>
            ) : loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 pt-[10vh] text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <MessageCircle className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-foreground">Womit kann ich helfen?</p>
                  {activeProvider && (
                    <p className="mt-1 text-sm text-muted">{activeProvider.label} · {activeProvider.chatModel}</p>
                  )}
                  {guestMode && (
					<p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted">Gastmodus mit lokalem Verlauf</p>
				  )}
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
                    Fragen Sie nach Apps, Versionen, Dokumentation oder lassen Sie sich bei Auswahl und Einrichtung unterstützen.
                  </p>
                </div>
                <div className="flex max-w-2xl flex-wrap items-center justify-center gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <Button
                      key={prompt}
                      size="sm"
                      variant="secondary"
                      className="rounded-full px-3"
                      onPress={() => applyQuickPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-8">
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
        {error && (
          <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 px-6 lg:px-10">
            <div className="pointer-events-auto w-full rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger shadow-sm">
              {error}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

        {/* Floating composer */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-6 pb-6 lg:px-10">
          <div className="pointer-events-auto w-full">
            <div
              className={`flex items-end overflow-hidden rounded-[1.75rem] border bg-overlay/95 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-150 ${canSend ? 'border-accent/40' : 'border-border/80'}`}
            >
              <textarea
                ref={textareaRef}
                aria-label="Nachricht schreiben"
                className="max-h-[200px] min-h-[54px] flex-1 resize-none bg-transparent px-4 py-4 text-sm leading-6 text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
                disabled={sending}
                placeholder="Nachricht schreiben… (Shift+Enter für Zeilenumbruch)"
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

      <Footer className="mt-auto shrink-0 bg-surface" contentClassName="py-8" />
    </div>
  );
}
