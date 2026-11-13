'use client';

import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { AIMessageActions } from '@/components/AIMessageActions';
import { AISourceList } from '@/components/AISourceList';
import {
  AIMessage,
  AIProviderSummary,
  listAIProviders,
  listPublicAIProviders,
  setAIMessageFeedback,
  sendAIMessage,
  sendPublicAIMessage,
} from '@/lib/ai';
import { allowsAnonymousAI, canAccessAI } from '@/lib/ai-access';
import {
  createGuestConversationId,
  createGuestUserMessage,
  getPreferredGuestAIConversation,
  normalizePublicAssistantMessage,
  toPublicAIHistory,
  upsertGuestAIConversation,
} from '@/lib/guest-ai';
import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Message } from '@/components/panelui/message';
import { Prompt } from '@/components/panelui/prompt';
import { Sheet } from '@/components/panelui/sheet';
import { Tooltip } from '@/components/panelui/tooltip';
import { Bot, ExternalLink, Layers, MessageCircle, UserRound } from 'lucide-react';
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
  const storeName = settings.storeName || 'JustApps';
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
  const endRef = useRef<HTMLDivElement>(null);
  const scopedAppId = useMemo(() => appIdFromPath(pathname), [pathname]);
  const guestMode = !user && allowsAnonymousAI(settings);
  const aiAccessible = canAccessAI(settings, !!user);
  const isAppEditorRoute = /^\/(?:meine-apps|verwaltung\/(?:katalog\/)?apps)(?:\/new|\/[^/]+\/edit)$/.test(pathname);

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
		if (guestMode) {
			const guestConversation = getPreferredGuestAIConversation(scopedAppId, conversationId);
			setConversationId(guestConversation?.id);
			setMessages(guestConversation?.messages || []);
			setError(null);
		}
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'AI-Provider konnten nicht geladen werden.');
      });
    return () => {
      active = false;
    };
  }, [aiAccessible, conversationId, guestMode, isOpen, pathname, scopedAppId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, loading]);

  if (!aiAccessible || pathname === '/chat') return null;

  const openFullChat = () => {
    setIsOpen(false);
	const params = new URLSearchParams();
	if (scopedAppId) params.set('appId', scopedAppId);
	if (guestMode && conversationId) params.set('guestConversationId', conversationId);
	router.push(params.size > 0 ? `/chat?${params.toString()}` : '/chat');
  };

  const handleSend = async (text: string) => {
    const message = text.trim();
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

  const handleMessageFeedback = async (messageId: string, feedback: 'positive' | 'negative' | '') => {
    if (guestMode || messageId.startsWith('guest-') || messageId.startsWith('local-')) return;
    try {
      const savedFeedback = await setAIMessageFeedback(messageId, feedback);
      setMessages((current) => current.map((message) => (
        message.id === messageId ? { ...message, feedback: savedFeedback } : message
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback konnte nicht gespeichert werden.');
    }
  };

  const contextLabel = scopedAppId ? 'App-Kontext aktiv' : guestMode ? 'Gastmodus, Verlauf nur in diesem Browser' : 'Persönlicher Verlauf';
  const lastAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;

  return (
    <>
      <div
        className={`fixed right-5 z-50 ${
          isAppEditorRoute
            ? "bottom-[calc(8rem+env(safe-area-inset-bottom))] sm:bottom-24"
            : "bottom-5"
        }`}
      >
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                size="icon-lg"
                shape="pill"
                aria-label="AI Chat öffnen"
                className="shadow-lg"
                onClick={() => setIsOpen(true)}
              />
            }
          >
            <Bot />
          </Tooltip.Trigger>
          <Tooltip.Content side="left">AI Chat</Tooltip.Content>
        </Tooltip>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen} side="right">
        <Sheet.Content>
          <Sheet.Header title={`${storeName} AI`} description={contextLabel} />

          <Sheet.Body>
            <div className="flex min-h-full flex-col px-6 pb-4">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <MessageCircle className="size-5" />
                  </div>
                  <p className="font-medium text-foreground">Wobei kann ich helfen?</p>
                  {guestMode && <p className="text-sm text-muted-foreground">Der Verlauf bleibt nur in diesem Browser gespeichert.</p>}
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {messages.map((message) => (
                    <Message key={message.id} from={message.role === 'user' ? 'user' : 'assistant'}>
                      <Message.Content>
                        <Message.Bubble>
                          <Message.BubbleContent>
                            {message.role === 'assistant'
                              ? <ChatMarkdown content={message.content} />
                              : <p className="whitespace-pre-wrap">{message.content}</p>}
                          </Message.BubbleContent>
                        </Message.Bubble>
                        {message.sources && message.sources.length > 0 && <AISourceList sources={message.sources} compact />}
                        {!guestMode && message.role === 'assistant' && !message.id.startsWith('local-') && (
                          <AIMessageActions
                            content={message.content}
                            feedback={message.feedback}
                            onFeedback={(feedback) => void handleMessageFeedback(message.id, feedback)}
                            reveal={message.id === lastAssistantId ? 'always' : 'hover'}
                          />
                        )}
                      </Message.Content>
                    </Message>
                  ))}
                  {loading && (
                    <Message from="assistant">
                      <Message.Content>
                        <Message.Status>Antwort wird geschrieben</Message.Status>
                      </Message.Content>
                    </Message>
                  )}
                </div>
              )}

              {error && (
                <Alert variant="plain" tone="destructive" className="mt-4">
                  <Alert.Icon />
                  <Alert.Title>{error}</Alert.Title>
                </Alert>
              )}
              <div ref={endRef} />
            </div>
          </Sheet.Body>

          <Sheet.Footer>
            <Prompt
              value={draft}
              onValueChange={setDraft}
              onSubmit={({ text }) => void handleSend(text)}
              status={loading ? 'submitted' : 'idle'}
              disabled={providers.length === 0}
            >
              <Prompt.Field>
                <Prompt.Textarea placeholder="Frage zu Apps, Konfiguration oder Deployment" />
                <Prompt.Footer>
                  <Prompt.Tools>
                    {providers.length > 0 && (
                      <Prompt.Model
                        label="AI-Provider"
                        items={providers.map((provider) => ({
                          value: provider.key,
                          label: provider.label,
                          description: provider.chatModel,
                        }))}
                        value={providerKey || providers[0].key}
                        onValueChange={setProviderKey}
                      />
                    )}
                  </Prompt.Tools>
                  <Prompt.Submit sendLabel="Senden" stopLabel="Stoppen" />
                </Prompt.Footer>
              </Prompt.Field>
              <Prompt.Context>
                <Prompt.ContextItem>
                  {scopedAppId ? <Layers /> : <UserRound />}
                  {contextLabel}
                </Prompt.ContextItem>
                <Prompt.ContextItem onSelect={openFullChat}>
                  <ExternalLink />
                  Im Chat öffnen
                </Prompt.ContextItem>
              </Prompt.Context>
            </Prompt>
            {providers.length === 0 && (
              <p className="text-sm text-muted-foreground">Kein aktiver AI-Provider konfiguriert.</p>
            )}
          </Sheet.Footer>
        </Sheet.Content>
      </Sheet>
    </>
  );
}
