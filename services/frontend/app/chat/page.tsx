'use client';

import { ChatMarkdown } from '@/components/ChatMarkdown';
import {
    AIConversation,
    AIMessage,
    AIProviderSummary,
    deleteAIConversation,
    getAIConversation,
    listAIConversations,
    listAIProviders,
    sendAIMessage,
} from '@/lib/ai';
import { Button, ListBox, Select, Surface, TextArea } from '@heroui/react';
import { Bot, Loader2, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

function initialAppId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get('appId') || undefined;
}

export default function ChatPage() {
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);
  const [providerKey, setProviderKey] = useState('');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const appId = useMemo(() => initialAppId(), []);
  const activeSources = messages.flatMap((message) => message.sources || []).slice(-8).reverse();

  useEffect(() => {
    let active = true;
    Promise.all([listAIProviders(), listAIConversations()])
      .then(([providerData, conversationData]) => {
        if (!active) return;
        setProviders(providerData);
        setProviderKey((providerData.find((provider) => provider.default) || providerData[0])?.key || '');
        setConversations(conversationData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'AI Chat konnte nicht geladen werden.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const loadConversation = async (conversation: AIConversation) => {
    setError(null);
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

  const startNewChat = () => {
    setActiveConversation(null);
    setMessages([]);
    setDraft('');
    setError(null);
  };

  const removeConversation = async (conversation: AIConversation) => {
    try {
      await deleteAIConversation(conversation.id);
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      if (activeConversation?.id === conversation.id) startNewChat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konversation konnte nicht gelöscht werden.');
    }
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft('');
    setError(null);
    setSending(true);
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
        const withoutCurrent = current.filter((item) => item.id !== response.conversation.id);
        return [response.conversation, ...withoutCurrent];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die AI-Antwort konnte nicht erzeugt werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative left-1/2 grid h-full w-screen min-h-0 max-w-[1720px] -translate-x-1/2 gap-5 px-4 pb-4 pt-4 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:px-8 xl:px-10">
      <Surface className="flex h-full min-h-0 flex-col border border-border/60 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">AI Chat</h1>
              <p className="text-xs text-muted">JustApps</p>
            </div>
          </div>
          <Button isIconOnly aria-label="Neuer Chat" size="sm" variant="secondary" onPress={startNewChat}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <Select
          aria-label="AI-Provider"
          className="mb-4"
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

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {conversations.map((conversation) => (
            <div key={conversation.id} className={`group flex items-center gap-2 rounded-xl border px-3 py-2 ${activeConversation?.id === conversation.id ? 'border-accent/40 bg-accent/8' : 'border-border bg-surface-secondary/40'}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => void loadConversation(conversation)} type="button">
                <p className="truncate text-sm font-semibold text-foreground">{conversation.title || 'Neuer Chat'}</p>
                <p className="text-xs text-muted">{new Date(conversation.updatedAt).toLocaleDateString('de-DE')}</p>
              </button>
              <Button isIconOnly aria-label="Konversation löschen" size="sm" variant="ghost" className="h-7 w-7 text-muted opacity-0 group-hover:opacity-100" onPress={() => void removeConversation(conversation)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="flex h-full min-h-0 flex-col border border-border/60 p-0 shadow-sm">
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex h-full min-h-[420px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <MessageCircle className="h-7 w-7" />
              </div>
              <p className="text-xl font-semibold text-foreground">Wobei kann ich helfen?</p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-accent text-white' : 'border border-border bg-surface-secondary text-foreground'}`}>
                    {message.role === 'assistant'
                      ? <ChatMarkdown content={message.content} />
                      : <p className="whitespace-pre-wrap">{message.content}</p>}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-border bg-surface-secondary px-4 py-3 text-sm text-muted">
                    <Loader2 className="inline h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && <div className="mx-5 mb-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

        <div className="border-t border-border bg-surface-secondary/35 p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
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
              rows={3}
              fullWidth
              variant="secondary"
            />
            <Button isIconOnly aria-label="Senden" className="h-11 w-11 bg-accent text-white" isDisabled={sending || !draft.trim() || providers.length === 0} onPress={handleSend}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {providers.length === 0 && <p className="mx-auto mt-2 max-w-3xl text-xs text-muted">Kein aktiver AI-Provider konfiguriert.</p>}
        </div>
      </Surface>

      <Surface className="flex h-full min-h-0 flex-col border border-border/60 p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Quellen</h2>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {activeSources.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Quellen.</p>
          ) : activeSources.map((source) => (
            <div key={`${source.chunkId}-${source.sourceId}`} className="rounded-xl border border-border bg-surface-secondary/50 p-3">
              <p className="text-sm font-semibold text-foreground">{source.appName || source.title}</p>
              <p className="mt-1 text-xs font-medium text-muted">{source.sourceType}</p>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-muted">{source.snippet}</p>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
