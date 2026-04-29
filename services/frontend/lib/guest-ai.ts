import type {
	AIConversation,
	AIMessage,
	PublicAIAssistantMessage,
	PublicAIHistoryMessage,
} from './ai';

const GUEST_AI_STORAGE_KEY = 'justapps:guest-ai-conversations';
const MAX_GUEST_CONVERSATIONS = 25;

function generateGuestId(prefix: string): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${prefix}-${crypto.randomUUID()}`;
	}
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toTimestamp(value: string | undefined): number {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function buildNormalizedTitle(title: string | undefined, messages: AIMessage[]): string {
	const trimmedTitle = title?.trim();
	if (trimmedTitle) return trimmedTitle;
	const firstUserMessage = messages.find((message) => message.role === 'user')?.content || '';
	return buildGuestConversationTitle(firstUserMessage);
}

function normalizeGuestMessage(value: unknown, conversationId: string): AIMessage | null {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Partial<AIMessage>;
	const role = candidate.role === 'user' || candidate.role === 'assistant' ? candidate.role : null;
	const content = typeof candidate.content === 'string' ? candidate.content.trim() : '';
	if (!role || content === '') return null;
	const createdAt = typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
		? candidate.createdAt
		: new Date().toISOString();
	return {
		id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : generateGuestId(`guest-${role}`),
		conversationId,
		role,
		content,
		providerKey: typeof candidate.providerKey === 'string' ? candidate.providerKey : undefined,
		providerType: typeof candidate.providerType === 'string' ? candidate.providerType : undefined,
		model: typeof candidate.model === 'string' ? candidate.model : undefined,
		promptTokens: typeof candidate.promptTokens === 'number' ? candidate.promptTokens : undefined,
		responseTokens: typeof candidate.responseTokens === 'number' ? candidate.responseTokens : undefined,
		sources: Array.isArray(candidate.sources) ? candidate.sources : [],
		error: typeof candidate.error === 'string' ? candidate.error : undefined,
		createdAt,
	};
}

function normalizeGuestConversation(value: unknown): AIConversation | null {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Partial<AIConversation>;
	const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
	if (id === '') return null;
	const messages = Array.isArray(candidate.messages)
		? candidate.messages
			.map((message) => normalizeGuestMessage(message, id))
			.filter((message): message is AIMessage => message !== null)
		: [];
	const createdAt = typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
		? candidate.createdAt
		: messages[0]?.createdAt || new Date().toISOString();
	const updatedAt = typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim()
		? candidate.updatedAt
		: messages[messages.length - 1]?.createdAt || createdAt;
	const appId = typeof candidate.appId === 'string' && candidate.appId.trim() ? candidate.appId : undefined;
	return {
		id,
		userId: 'guest',
		title: buildNormalizedTitle(candidate.title, messages),
		scopeType: appId ? 'app' : 'global',
		appId,
		createdAt,
		updatedAt,
		messages,
	};
	}

function sortGuestConversations(conversations: AIConversation[]): AIConversation[] {
	return [...conversations].sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt));
}

function readGuestConversations(): AIConversation[] {
	if (typeof window === 'undefined') return [];
	try {
		const rawValue = localStorage.getItem(GUEST_AI_STORAGE_KEY);
		if (!rawValue) return [];
		const parsed = JSON.parse(rawValue) as unknown;
		if (!Array.isArray(parsed)) return [];
		return sortGuestConversations(
			parsed
				.map((conversation) => normalizeGuestConversation(conversation))
				.filter((conversation): conversation is AIConversation => conversation !== null),
		);
	} catch {
		return [];
	}
}

function writeGuestConversations(conversations: AIConversation[]): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(GUEST_AI_STORAGE_KEY, JSON.stringify(sortGuestConversations(conversations).slice(0, MAX_GUEST_CONVERSATIONS)));
}

export function createGuestConversationId(): string {
	return generateGuestId('guest-conversation');
}

export function buildGuestConversationTitle(message: string): string {
	const normalized = message.replace(/\s+/g, ' ').trim();
	if (normalized === '') return 'Neuer Chat';
	return normalized.length > 72 ? `${normalized.slice(0, 69).trimEnd()}...` : normalized;
}

export function listGuestAIConversations(): AIConversation[] {
	return readGuestConversations();
}

export function getGuestAIConversation(conversationId: string): AIConversation | null {
	return readGuestConversations().find((conversation) => conversation.id === conversationId) || null;
}

export function getPreferredGuestAIConversation(appId?: string, preferredConversationId?: string): AIConversation | null {
	const conversations = readGuestConversations();
	if (preferredConversationId) {
		const preferredConversation = conversations.find((conversation) => conversation.id === preferredConversationId);
		if (preferredConversation) return preferredConversation;
	}
	if (appId) {
		const scopedConversation = conversations.find((conversation) => conversation.appId === appId);
		if (scopedConversation) return scopedConversation;
	}
	return conversations[0] || null;
}

export function deleteGuestAIConversation(conversationId: string): AIConversation[] {
	const nextConversations = readGuestConversations().filter((conversation) => conversation.id !== conversationId);
	writeGuestConversations(nextConversations);
	return nextConversations;
}

export function createGuestUserMessage(conversationId: string, content: string): AIMessage {
	return {
		id: generateGuestId('guest-user'),
		conversationId,
		role: 'user',
		content,
		sources: [],
		createdAt: new Date().toISOString(),
	};
}

export function normalizePublicAssistantMessage(conversationId: string, message: PublicAIAssistantMessage): AIMessage {
	return {
		id: generateGuestId('guest-assistant'),
		conversationId,
		role: 'assistant',
		content: message.content,
		providerKey: message.providerKey,
		providerType: message.providerType,
		model: message.model,
		promptTokens: message.promptTokens,
		responseTokens: message.responseTokens,
		sources: Array.isArray(message.sources) ? message.sources : [],
		error: message.error,
		createdAt: message.createdAt || new Date().toISOString(),
	};
}

export function toPublicAIHistory(messages: AIMessage[]): PublicAIHistoryMessage[] {
	return messages
		.filter((message) => message.role === 'user' || message.role === 'assistant')
		.map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content }));
}

export function upsertGuestAIConversation(input: {
	conversationId: string;
	appId?: string;
	title?: string;
	createdAt?: string;
	messages: AIMessage[];
}): { conversation: AIConversation; conversations: AIConversation[] } {
	const conversations = readGuestConversations();
	const existingConversation = conversations.find((conversation) => conversation.id === input.conversationId) || null;
	const createdAt = existingConversation?.createdAt || input.createdAt || input.messages[0]?.createdAt || new Date().toISOString();
	const updatedAt = input.messages[input.messages.length - 1]?.createdAt || existingConversation?.updatedAt || createdAt;
	const conversation: AIConversation = {
		id: input.conversationId,
		userId: 'guest',
		title: buildNormalizedTitle(input.title || existingConversation?.title, input.messages),
		scopeType: (input.appId || existingConversation?.appId) ? 'app' : 'global',
		appId: input.appId ?? existingConversation?.appId,
		createdAt,
		updatedAt,
		messages: input.messages,
	};
	const nextConversations = sortGuestConversations([
		conversation,
		...conversations.filter((entry) => entry.id !== conversation.id),
	]).slice(0, MAX_GUEST_CONVERSATIONS);
	writeGuestConversations(nextConversations);
	return { conversation, conversations: nextConversations };
}