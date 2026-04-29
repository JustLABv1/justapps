'use client';

import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import {
    AIMessage,
    AIProviderSummary,
    listAIProviders,
    listPublicAIProviders,
    sendAIMessage,
    sendPublicAIMessage,
} from '@/lib/ai';
import {
    createGuestConversationId,
    createGuestUserMessage,
    getPreferredGuestAIConversation,
    normalizePublicAssistantMessage,
    toPublicAIHistory,
    upsertGuestAIConversation,
} from '@/lib/guest-ai';
import { Button, ListBox, Modal, Select, Surface, TextArea, Tooltip } from '@heroui/react';
import { Bot, ExternalLink, Loader2, MessageCircle, Send, Sparkles } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatMarkdown } from './ChatMarkdown';

function appIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/apps\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function AIChatWidget() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [providerKey, setProviderKey] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scopedAppId = useMemo(() => appIdFromPath(pathname), [pathname]);
  const guestMode = !user && settings.allowAnonymousAI;
  const aiAccessible = !!user || guestMode;

  useEffect(() => {
    if (!isOpen || !aiAccessible || pathname === '/chat') return;
    let active = true;
    const loadProviders = guestMode ? listPublicAIProviders : listAIProviders;

    loadProviders()
      .then((items) => {
        if (!active) return;
        setProviders(items);
        const defaultProvider = items.find((provider) => provider.default) || items[0];
        setProviderKey((current) => items.some((provider) => provider.key === current) ? current : (defaultProvider?.key || ''));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'AI-Provider konnten nicht geladen werden.');
      });
    return () => {
      active = false;
    };
  }, [aiAccessible, guestMode, isOpen, pathname]);

  useEffect(() => {
	if (!isOpen || !guestMode) return;
	const guestConversation = getPreferredGuestAIConversation(scopedAppId, conversationId);
	setConversationId(guestConversation?.id);
	setMessages(guestConversation?.messages || []);
	setError(null);
  }, [conversationId, guestMode, isOpen, scopedAppId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  if (!aiAccessible || pathname === '/chat') return null;

  const openFullChat = () => {
    setIsOpen(false);
	const params = new URLSearchParams();
	if (scopedAppId) params.set('appId', scopedAppId);
	if (guestMode && conversationId) params.set('guestConversationId', conversationId);
	router.push(params.size > 0 ? `/chat?${params.toString()}` : '/chat');
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || loading) return;
    setDraft('');
    setError(null);
    setLoading(true);
    setMessages((current) => [...current, {
      id: `local-${Date.now()}`,
      conversationId: conversationId || '',
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
      sources: [],
    }]);

    try {
    if (guestMode) {
      const previousMessages = messages;
      const nextConversationId = conversationId || createGuestConversationId();
      const userMessage = createGuestUserMessage(nextConversationId, message);
      setMessages([...previousMessages, userMessage]);

      const response = await sendPublicAIMessage({
        message,
        appId: scopedAppId,
        providerKey,
        history: toPublicAIHistory(previousMessages),
      });
      const assistantMessage = normalizePublicAssistantMessage(nextConversationId, response.assistantMessage);
      const { conversation } = upsertGuestAIConversation({
        conversationId: nextConversationId,
        appId: scopedAppId,
        messages: [...previousMessages, userMessage, assistantMessage],
      });
      setConversationId(conversation.id);
      setMessages(conversation.messages || []);
      return;
    }

      const response = await sendAIMessage({
        conversationId,
        message,
        appId: scopedAppId,
        providerKey,
      });
      setConversationId(response.conversation.id);
      setMessages((current) => [...current, response.assistantMessage]);
    } catch (err) {
		if (guestMode) {
			const guestConversation = getPreferredGuestAIConversation(scopedAppId, conversationId);
			setMessages(guestConversation?.messages || []);
		}
      setError(err instanceof Error ? err.message : 'Die AI-Antwort konnte nicht erzeugt werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        <Tooltip delay={0}>
          <Tooltip.Trigger>
            <Button
              isIconOnly
              aria-label="AI Chat öffnen"
              className="h-12 w-12 rounded-2xl bg-accent text-white shadow-lg shadow-accent/25"
              onPress={() => setIsOpen(true)}
            >
              <Bot className="h-5 w-5" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>AI Chat</Tooltip.Content>
        </Tooltip>
      </div>

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Modal.Container className="items-end justify-end p-4 sm:p-6">
            <Modal.Dialog className="h-[min(720px,calc(100vh-3rem))] w-full max-w-xl overflow-hidden p-0 sm:rounded-2xl">
              <Modal.CloseTrigger />
              <Modal.Header className="border-b border-border px-5 py-4">
                <Modal.Icon className="bg-accent/10 text-accent">
                  <Sparkles className="h-5 w-5" />
                </Modal.Icon>
                <div className="min-w-0">
                  <Modal.Heading>JustApps AI</Modal.Heading>
                  <p className="text-xs text-muted">
                    {scopedAppId ? 'App-Kontext aktiv' : guestMode ? 'Gastmodus mit lokalem Verlauf' : 'Persönlicher Verlauf'}
                  </p>
                </div>
              </Modal.Header>

              <Modal.Body className="flex min-h-0 flex-1 flex-col gap-0 p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-secondary/40 px-4 py-3">
                  <Select
                    aria-label="AI-Provider"
                    className="max-w-[260px]"
                    selectedKey={providerKey || providers[0]?.key || ''}
                    onSelectionChange={(key) => setProviderKey(String(key))}
                  >
                    <Select.Trigger className="bg-field-background">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {providers.map((provider) => (
                          <ListBox.Item key={provider.key} id={provider.key} textValue={provider.label}>
                            <div className="flex flex-col gap-0.5">
                              <span>{provider.label}</span>
                              <span className="text-xs text-muted">{provider.chatModel}</span>
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <Button size="sm" variant="secondary" onPress={openFullChat}>
                    <ExternalLink className="h-4 w-4" />
                    Öffnen
                  </Button>
                </div>

                <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
                  {messages.length === 0 ? (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <MessageCircle className="h-6 w-6" />
                      </div>
                      <p className="text-lg font-semibold text-foreground">Wobei kann ich helfen?</p>
                      {guestMode && <p className="text-xs text-muted">Verlauf bleibt nur in diesem Browser gespeichert.</p>}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-accent text-white' : 'border border-border bg-surface-secondary text-foreground'}`}>
                            {message.role === 'assistant'
                              ? <ChatMarkdown content={message.content} />
                              : <p className="whitespace-pre-wrap">{message.content}</p>}
                            {message.sources && message.sources.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {message.sources.slice(0, 3).map((source) => (
                                  <span key={`${source.chunkId}-${source.sourceId}`} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
                                    {source.appName || source.title}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {loading && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl border border-border bg-surface-secondary px-4 py-3 text-sm text-muted">
                            <Loader2 className="inline h-4 w-4 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {error && <div className="mx-4 mb-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

                <Surface className="rounded-none border-x-0 border-b-0 border-border/60 p-3">
                  <div className="flex items-end gap-2">
                    <TextArea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder="Frage zu Apps, Konfiguration oder Deployment"
                      rows={2}
                      fullWidth
                      variant="secondary"
                    />
                    <Button isIconOnly aria-label="Senden" className="h-10 w-10 bg-accent text-white" isDisabled={loading || !draft.trim() || providers.length === 0} onPress={handleSend}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  {providers.length === 0 && <p className="mt-2 text-xs text-muted">Kein aktiver AI-Provider konfiguriert.</p>}
                </Surface>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
