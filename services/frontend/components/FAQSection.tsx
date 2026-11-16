'use client';

import { useAuth } from '@/context/AuthContext';
import { useStoreName } from '@/context/SettingsContext';
import { fetchApi } from '@/lib/api';
import { groupFAQThreads } from '@/lib/faqThreads';
import { Alert } from '@/components/panelui/alert';
import { AlertDialog } from '@/components/panelui/alert-dialog';
import { Avatar } from '@/components/panelui/avatar';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { Menu } from '@/components/panelui/menu';
import { Select } from '@/components/panelui/select';
import { Spinner } from '@/components/panelui/spinner';
import { Textarea } from '@/components/panelui/textarea';
import { toast } from '@/lib/toast';
import { ArrowUp, ArrowUpDown, ChevronDown, Heart, MessageCircleQuestion, MoreHorizontal, Reply, Pin, Plus, Search, Send, Trash2, UserRound, X } from 'lucide-react';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { getImageAssetUrl } from '@/lib/assets';
import { useCallback, useEffect, useRef, useState } from 'react';

interface FAQAnswer {
  id: string;
  questionId: string;
  userId: string;
  username: string;
  answer: string;
  replyToAnswerId?: string;
  replyToUsername?: string;
  replyToText?: string;
  isPinned: boolean;
  creatorLiked: boolean;
  acceptedByAuthor: boolean;
  createdAt: string;
  upvoteCount: number;
  userUpvoted: boolean;
}

interface FAQQuestion {
  id: string;
  scope?: 'global' | 'app';
  appId?: string | null;
  appName?: string | null;
  appIcon?: string | null;
  userId: string;
  username: string;
  question: string;
  createdAt: string;
  answerCount: number;
  answers: FAQAnswer[];
}

interface FAQSectionProps {
  appId?: string;
  canDeleteQuestions: boolean;
  canDeleteAnswers: boolean;
  canPinAnswers: boolean;
  canRecommendAnswers: boolean;
  global?: boolean;
}

type FAQStatusFilter = 'all' | 'open' | 'answered';
type FAQSort = 'newest' | 'most-answered';
type FAQScopeFilter = 'all' | 'global' | 'app';
type FAQAppOption = { id: string; name: string; icon?: string };
type FAQAnswerPage = { answers: FAQAnswer[]; page: number; hasMore: boolean; loading: boolean };

const FAQ_PAGE_SIZE = 20;
const FAQ_ANSWER_PAGE_SIZE = 20;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  return body.message || fallback;
}

function userFacingError(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message.trim() && !/^failed to fetch$/i.test(reason.message.trim())) {
    return reason.message;
  }
  return fallback;
}

function FAQDeleteConfirmation({ title, description, isOpen, onOpenChange, onConfirm }: {
  title: string;
  description: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Content tone="destructive">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onConfirm}>Löschen</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}

function FAQAnswerComposer({ recipient, value, onChange, onSubmit, onCancel, pending, disabled }: {
  recipient?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  pending: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field>
        <Field.Label>{recipient ? `Antwort an ${recipient}` : 'Deine Antwort'}</Field.Label>
        <Textarea
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={recipient ? 'Diskussion fortsetzen …' : 'Teile deine Erfahrung oder Empfehlung …'}
          rows={3}
          maxLength={5000}
        />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Abbrechen</Button>}
        <Button size="sm" onClick={onSubmit} disabled={!value.trim() || disabled} loading={pending}>
          <Send />{recipient ? 'Antwort senden' : 'Antwort veröffentlichen'}
        </Button>
      </div>
    </div>
  );
}

export function FAQSection({ appId, canDeleteQuestions, canDeleteAnswers, canPinAnswers, canRecommendAnswers, global = false }: FAQSectionProps) {
  const { user } = useAuth();
  const storeName = useStoreName();
  const [questions, setQuestions] = useState<FAQQuestion[]>([]);
  const [questionDraft, setQuestionDraft] = useState('');
  const [questionToDelete, setQuestionToDelete] = useState<FAQQuestion | null>(null);
  const [answerToDelete, setAnswerToDelete] = useState<FAQAnswer | null>(null);
  const [replyTargets, setReplyTargets] = useState<Record<string, FAQAnswer | undefined>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [collapsedThreads, setCollapsedThreads] = useState<Record<string, boolean>>({});
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FAQStatusFilter>('all');
  const [sort, setSort] = useState<FAQSort>('newest');
  const [mineOnly, setMineOnly] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<FAQScopeFilter>('all');
  const [selectedAppId, setSelectedAppId] = useState('');
  const [faqApps, setFAQApps] = useState<FAQAppOption[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [questionPage, setQuestionPage] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [loadingMoreQuestions, setLoadingMoreQuestions] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [answerPages, setAnswerPages] = useState<Record<string, FAQAnswerPage>>({});
  const loadMoreQuestionsRef = useRef<HTMLDivElement>(null);
  const loadMoreAnswersRef = useRef<HTMLDivElement>(null);
  const endpoint = global ? '/faq' : `/apps/${appId}/faq`;

  useEffect(() => {
    for (const questionId of Object.keys(replyTargets)) {
      if (!replyTargets[questionId]) continue;
      const composer = document.getElementById(`faq-reply-composer-${questionId}`);
      composer?.querySelector('textarea')?.focus({ preventScroll: true });
      composer?.scrollIntoView({ block: 'nearest' });
    }
  }, [replyTargets]);

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || sort !== 'newest' || mineOnly || scopeFilter !== 'all' || selectedAppId !== '';

  const loadFAQ = useCallback(async (page = 1, append = false) => {
    if (append) setLoadingMoreQuestions(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(FAQ_PAGE_SIZE), status: statusFilter, sort });
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (mineOnly) params.set('owner', 'me');
      if (global) params.set('scope', scopeFilter);
      if (global && selectedAppId) params.set('appId', selectedAppId);
      const response = await fetchApi(`${endpoint}?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await responseError(response, 'FAQ konnte nicht geladen werden.'));
      }
      const data = await response.json() as { questions?: FAQQuestion[]; apps?: FAQAppOption[]; page?: number; total?: number; hasMore?: boolean };
      const nextQuestions = Array.isArray(data.questions)
        ? data.questions.map((question) => ({ ...question, answers: [] }))
        : [];
      setQuestions((current) => append ? [...current, ...nextQuestions] : nextQuestions);
      setQuestionPage(data.page ?? page);
      setTotalQuestions(data.total ?? nextQuestions.length);
      setHasMoreQuestions(data.hasMore === true);
      if (global && Array.isArray(data.apps)) setFAQApps(data.apps);
      if (!append) {
        setExpandedQuestionId(null);
        setAnswerPages({});
      }
      setError(null);
      return true;
    } catch (reason) {
      const message = userFacingError(reason, 'FAQ konnte nicht geladen werden. Bitte versuchen Sie es erneut.');
      setError(message);
      toast.danger(message);
      return false;
    } finally {
      if (append) setLoadingMoreQuestions(false);
      else setLoading(false);
    }
  }, [endpoint, global, mineOnly, scopeFilter, searchQuery, selectedAppId, sort, statusFilter]);

  const endpointForQuestion = useCallback((questionId: string) => {
    const question = questions.find((candidate) => candidate.id === questionId);
    return global && question?.scope === 'app' && question.appId ? `/apps/${question.appId}/faq` : endpoint;
  }, [endpoint, global, questions]);

  const loadAnswers = useCallback(async (questionId: string, page = 1, append = false) => {
    setAnswerPages((current) => ({
      ...current,
      [questionId]: { answers: append ? current[questionId]?.answers ?? [] : [], page, hasMore: false, loading: true },
    }));
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(FAQ_ANSWER_PAGE_SIZE), threaded: 'true' });
      const response = await fetchApi(`${endpointForQuestion(questionId)}/questions/${questionId}/answers?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response, 'Antworten konnten nicht geladen werden.'));
      const data = await response.json() as { answers?: FAQAnswer[]; page?: number; hasMore?: boolean };
      const answers = Array.isArray(data.answers) ? data.answers : [];
      setAnswerPages((current) => ({
        ...current,
        [questionId]: {
          answers: append ? [...(current[questionId]?.answers ?? []), ...answers] : answers,
          page: data.page ?? page,
          hasMore: data.hasMore === true,
          loading: false,
        },
      }));
      return true;
    } catch (reason) {
      const message = userFacingError(reason, 'Antworten konnten nicht geladen werden.');
      setAnswerPages((current) => ({ ...current, [questionId]: { ...(current[questionId] ?? { answers: [], page, hasMore: false }), loading: false } }));
      setError(message);
      toast.danger(message);
      return false;
    }
  }, [endpointForQuestion]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadFAQ(1, false), 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadFAQ]);

  useEffect(() => {
    const target = loadMoreQuestionsRef.current;
    if (!target || !hasMoreQuestions || loading || loadingMoreQuestions) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadFAQ(questionPage + 1, true);
    }, { rootMargin: '320px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreQuestions, loadFAQ, loading, loadingMoreQuestions, questionPage]);

  useEffect(() => {
    if (!expandedQuestionId) return;
    const page = answerPages[expandedQuestionId];
    const target = loadMoreAnswersRef.current;
    if (!target || !page?.hasMore || page.loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadAnswers(expandedQuestionId, page.page + 1, true);
    }, { rootMargin: '240px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [answerPages, expandedQuestionId, loadAnswers]);

  const toggleQuestion = (questionId: string) => {
    if (expandedQuestionId === questionId) {
      setExpandedQuestionId(null);
      return;
    }
    setExpandedQuestionId(questionId);
    if (!answerPages[questionId]) void loadAnswers(questionId);
  };

  const handleAskQuestion = async () => {
    const question = questionDraft.trim();
    if (!user || !question || submitting) return;

    setSubmitting('question');
    setError(null);
    try {
      const response = await fetchApi(`${endpoint}/questions`, {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Frage konnte nicht veröffentlicht werden.'));
      }
      setQuestionDraft('');
      setComposerOpen(false);
      if (await loadFAQ(1, false)) {
        window.dispatchEvent(new Event('faq:changed'));
        toast.success('Frage veröffentlicht.');
      }
    } catch (reason) {
      const message = userFacingError(reason, 'Frage konnte nicht veröffentlicht werden.');
      setError(message);
      toast.danger(message);
    } finally {
      setSubmitting(null);
    }
  };

  const handleAnswer = async (questionId: string, reply = false) => {
    const target = reply ? replyTargets[questionId] : undefined;
    const answer = ((reply ? replyDrafts : answerDrafts)[questionId] || '').trim();
    if (!user || !answer || submitting || (reply && !target)) return;

    setSubmitting(`answer:${questionId}`);
    setError(null);
    try {
      const response = await fetchApi(`${endpointForQuestion(questionId)}/questions/${questionId}/answers`, {
        method: 'POST',
        body: JSON.stringify({ answer, replyToAnswerId: target?.id }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Antwort konnte nicht veröffentlicht werden.'));
      }
      if (reply) setReplyTargets((previous) => ({ ...previous, [questionId]: undefined }));
      const clearDraft = reply ? setReplyDrafts : setAnswerDrafts;
      clearDraft((previous) => {
        const next = { ...previous };
        delete next[questionId];
        return next;
      });
      if (await loadFAQ(1, false)) {
        setExpandedQuestionId(questionId);
        await loadAnswers(questionId);
        if (reply) {
          for (let page = 2; page <= (answerPages[questionId]?.page ?? 1); page++) {
            if (!await loadAnswers(questionId, page, true)) break;
          }
        }
        window.dispatchEvent(new Event('faq:changed'));
        toast.success('Antwort veröffentlicht.');
      }
    } catch (reason) {
      const message = userFacingError(reason, 'Antwort konnte nicht veröffentlicht werden.');
      setError(message);
      toast.danger(message);
    } finally {
      setSubmitting(null);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const action = `delete-question:${questionId}`;
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetchApi(`${endpointForQuestion(questionId)}/questions/${questionId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Frage konnte nicht gelöscht werden.'));
      }
      if (await loadFAQ(1, false)) {
        window.dispatchEvent(new Event('faq:changed'));
        toast.success('Frage gelöscht.');
      }
    } catch (reason) {
      const message = userFacingError(reason, 'Frage konnte nicht gelöscht werden.');
      setError(message);
      toast.danger(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteAnswer = async (questionId: string, answerId: string) => {
    const action = `delete-answer:${answerId}`;
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetchApi(`${endpointForQuestion(questionId)}/questions/${questionId}/answers/${answerId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Antwort konnte nicht gelöscht werden.'));
      }
      if (await loadFAQ(1, false)) {
        setExpandedQuestionId(questionId);
        await loadAnswers(questionId);
        window.dispatchEvent(new Event('faq:changed'));
        toast.success('Antwort gelöscht.');
      }
    } catch (reason) {
      const message = userFacingError(reason, 'Antwort konnte nicht gelöscht werden.');
      setError(message);
      toast.danger(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpvote = async (answer: FAQAnswer) => {
    if (!user) return;
    const action = `upvote:${answer.id}`;
    setBusyAction(action);
    setError(null);
    try {
      const method = answer.userUpvoted ? 'DELETE' : 'POST';
      const response = await fetchApi(`${endpointForQuestion(answer.questionId)}/answers/${answer.id}/upvote`, { method });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Stimme konnte nicht gespeichert werden.'));
      }
      const result = await response.json().catch(() => ({})) as { upvoted?: boolean; upvoteCount?: number };
      setAnswerPages((current) => ({
        ...current,
        [answer.questionId]: {
          ...current[answer.questionId],
          answers: (current[answer.questionId]?.answers ?? []).map((candidate) => candidate.id === answer.id
            ? {
                ...candidate,
                userUpvoted: result.upvoted ?? !answer.userUpvoted,
                upvoteCount: result.upvoteCount ?? candidate.upvoteCount + (answer.userUpvoted ? -1 : 1),
              }
            : candidate),
        },
      }));
      toast.success(answer.userUpvoted ? 'Stimme entfernt.' : 'Antwort als hilfreich markiert.');
    } catch (reason) {
      const message = userFacingError(reason, 'Stimme konnte nicht gespeichert werden.');
      setError(message);
      toast.danger(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleAcceptance = async (answer: FAQAnswer) => {
    setBusyAction(`acceptance:${answer.id}`);
    try {
      const response = await fetchApi(`${endpointForQuestion(answer.questionId)}/answers/${answer.id}/acceptance`, {
        method: 'PATCH',
        body: JSON.stringify({ acceptedByAuthor: !answer.acceptedByAuthor }),
      });
      if (!response.ok) throw new Error(await responseError(response, 'Markierung konnte nicht gespeichert werden.'));
      await loadAnswers(answer.questionId);
    } catch (reason) {
      toast.danger(userFacingError(reason, 'Markierung konnte nicht gespeichert werden.'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleHighlight = async (answer: FAQAnswer, field: 'isPinned' | 'creatorLiked') => {
    if (field === 'isPinned' && !canPinAnswers) return;
    if (field === 'creatorLiked' && !canRecommendAnswers) return;
    const action = `${field}:${answer.id}`;
    setBusyAction(action);
    setError(null);
    const enabled = !answer[field];
    try {
      const response = await fetchApi(`${endpointForQuestion(answer.questionId)}/answers/${answer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: enabled }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Hervorhebung konnte nicht gespeichert werden.'));
      }
      if (await loadAnswers(answer.questionId)) {
        if (field === 'isPinned') {
          toast.success(enabled ? 'Antwort angeheftet.' : 'Anheftung entfernt.');
        } else {
          toast.success(enabled ? 'Antwort empfohlen.' : 'Empfehlung entfernt.');
        }
      }
    } catch (reason) {
      const message = userFacingError(reason, 'Hervorhebung konnte nicht gespeichert werden.');
      setError(message);
      toast.danger(message);
    } finally {
      setBusyAction(null);
    }
  };

  const scopeItems = [
    { value: 'all', label: 'Alle Bereiche' },
    { value: 'global', label: `${storeName} allgemein` },
    { value: 'app', label: 'App-FAQs' },
  ];
  const appItems = [{ value: 'all', label: 'Alle Apps' }, ...faqApps.map((app) => ({ value: app.id, label: app.name }))];
  const statusItems = [
    { value: 'all', label: 'Alle Status' },
    { value: 'open', label: 'Offen' },
    { value: 'answered', label: 'Beantwortet' },
  ];
  const sortItems = [
    { value: 'newest', label: 'Neueste zuerst' },
    { value: 'most-answered', label: 'Meiste Antworten' },
  ];
  const pillSelect = (label: string, items: { value: string; label: string }[], value: string, onChange: (value: string) => void) => (
    <Select items={items} value={value} onValueChange={(next) => next && onChange(next)}>
      <Select.Trigger variant="pill" size="sm" aria-label={label}>
        <Select.Value />
      </Select.Trigger>
      <Select.Content alignItemWithTrigger={false}>
        {items.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
      </Select.Content>
    </Select>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {global ? 'Alle Fragen' : 'Fragen und Antworten'}
          {totalQuestions > 0 && <Badge variant="secondary" size="sm">{totalQuestions}</Badge>}
        </h2>
        {user && (
          <Button size="sm" variant={composerOpen ? 'secondary' : 'default'} onClick={() => setComposerOpen(!composerOpen)} aria-expanded={composerOpen} aria-controls="faq-composer">
            <Plus />Frage stellen
          </Button>
        )}
      </div>

      {user && composerOpen && (
        <Card id="faq-composer">
          <Card.Content className="flex flex-col gap-3">
            <Field>
              <Field.Label>Deine Frage</Field.Label>
              <Textarea
                autoFocus
                value={questionDraft}
                onChange={(event) => setQuestionDraft(event.target.value)}
                placeholder={global ? `Was möchtest du über ${storeName} wissen?` : 'Was möchtest du über diese App wissen?'}
                rows={2}
                maxLength={1000}
              />
              <Field.Description>Höchstens 1.000 Zeichen.</Field.Description>
            </Field>
          </Card.Content>
          <Card.Footer variant="panel" className="justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setComposerOpen(false)}>Abbrechen</Button>
            <Button size="sm" onClick={() => void handleAskQuestion()} disabled={!questionDraft.trim() || submitting !== null} loading={submitting === 'question'}>
              <Send />Frage veröffentlichen
            </Button>
          </Card.Footer>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Input.Group>
          <Input.Addon><Search /></Input.Addon>
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Fragen, Antworten oder Personen durchsuchen"
            aria-label="FAQ durchsuchen"
          />
          {searchQuery && (
            <Input.Addon align="end">
              <Button size="icon-sm" variant="ghost" aria-label="Suche löschen" onClick={() => setSearchQuery('')}><X /></Button>
            </Input.Addon>
          )}
        </Input.Group>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter und Sortierung">
          {global && pillSelect('FAQ-Bereich filtern', scopeItems, scopeFilter, (value) => {
            setScopeFilter(value as FAQScopeFilter);
            if (value !== 'app') setSelectedAppId('');
          })}
          {global && scopeFilter === 'app' && pillSelect('Nach App filtern', appItems, selectedAppId || 'all', (value) => setSelectedAppId(value === 'all' ? '' : value))}
          {pillSelect('Antwortstatus filtern', statusItems, statusFilter, (value) => setStatusFilter(value as FAQStatusFilter))}
          {user && (
            <Button size="sm" shape="pill" variant={mineOnly ? 'default' : 'outline'} aria-pressed={mineOnly} onClick={() => setMineOnly((current) => !current)}>
              <UserRound />Meine Fragen
            </Button>
          )}
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setSort('newest'); setMineOnly(false); setScopeFilter('all'); setSelectedAppId(''); }}>
              Zurücksetzen
            </Button>
          )}
          <Select items={sortItems} value={sort} onValueChange={(value) => value && setSort(value as FAQSort)}>
            <Select.Trigger variant="ghost" size="sm" aria-label="Fragen sortieren" className="ms-auto">
              <ArrowUpDown />
              <Select.Value />
            </Select.Trigger>
            <Select.Content align="end">
              {sortItems.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
            </Select.Content>
          </Select>
        </div>
        <span role="status" className="sr-only">{loading ? 'Fragen werden geladen' : `${totalQuestions} ${totalQuestions === 1 ? 'Frage' : 'Fragen'}`}</span>
      </div>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}

      {loading && questions.length === 0 ? (
        <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
          <Spinner />
          Fragen werden geladen …
        </div>
      ) : questions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <MessageCircleQuestion className="size-6 opacity-40" />
          <p className="text-sm">{hasActiveFilters ? 'Keine Fragen passen zu deiner Suche.' : 'Noch keine Fragen. Stell die erste!'}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {questions.map((question) => {
            const canDeleteQuestion = canDeleteQuestions || user?.id === question.userId;
            const replyTarget = replyTargets[question.id];
            const answerDraft = answerDrafts[question.id] || '';
            const answerPage = answerPages[question.id];
            const isExpanded = expandedQuestionId === question.id;
            const appIconSrc = getImageAssetUrl(question.appIcon);

            const threads = groupFAQThreads(answerPage?.answers ?? []);
            const renderAnswer = (answer: FAQAnswer, isReply: boolean, threadRootId: string) => {
              const canDeleteAnswer = canDeleteAnswers || user?.id === answer.userId;
              const answerBusy = busyAction === `upvote:${answer.id}`
                || busyAction === `acceptance:${answer.id}`
                || busyAction === `isPinned:${answer.id}`
                || busyAction === `creatorLiked:${answer.id}`
                || busyAction === `delete-answer:${answer.id}`;
              const name = answer.username || 'Anonymer Nutzer';

              return (
                <div id={`faq-answer-${answer.id}`} key={answer.id} className="flex min-w-0 gap-3 py-3">
                  <Avatar name={name} size="xs" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium break-words">{name}</span>
                      <time dateTime={answer.createdAt} className="text-xs text-muted-foreground">{formatDate(answer.createdAt)}</time>
                      {answer.isPinned && <Badge variant="info" size="sm"><Pin />Angeheftet</Badge>}
                      {answer.creatorLiked && <Badge variant="success" size="sm"><Heart />Empfohlen</Badge>}
                      {answer.acceptedByAuthor && <Badge variant="success" size="sm" title="Vom Fragesteller bestätigt"><CheckCircle2 />Bestätigt</Badge>}
                      {(canPinAnswers || canRecommendAnswers || canDeleteAnswer || user?.id === question.userId) && (
                        <Menu>
                          <Menu.Trigger
                            render={<Button size="icon-sm" variant="ghost" disabled={answerBusy} className="ms-auto" aria-label={`Weitere Aktionen für die Antwort von ${name}`} />}
                          >
                            <MoreHorizontal />
                          </Menu.Trigger>
                          <Menu.Content align="end">
                            {canPinAnswers && (
                              <Menu.Item onClick={() => void handleHighlight(answer, 'isPinned')}>
                                <Pin />{answer.isPinned ? 'Anheftung entfernen' : 'Antwort anheften'}
                              </Menu.Item>
                            )}
                            {canRecommendAnswers && (
                              <Menu.Item onClick={() => void handleHighlight(answer, 'creatorLiked')}>
                                <Heart />{answer.creatorLiked ? 'Empfehlung entfernen' : 'Antwort empfehlen'}
                              </Menu.Item>
                            )}
                            {user?.id === question.userId && (
                              <Menu.Item onClick={() => void handleAcceptance(answer)}>
                                <CheckCircle2 />{answer.acceptedByAuthor ? 'Bestätigung zurücknehmen' : 'Hat meine Frage beantwortet'}
                              </Menu.Item>
                            )}
                            {canDeleteAnswer && (
                              <Menu.Item variant="destructive" onClick={() => setAnswerToDelete(answer)}>
                                <Trash2 />Antwort löschen
                              </Menu.Item>
                            )}
                          </Menu.Content>
                        </Menu>
                      )}
                    </div>
                    {isReply && answer.replyToAnswerId !== threadRootId && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Reply className="size-3" />an {answer.replyToUsername || 'Anonymer Nutzer'}</p>
                    )}
                    <p className="max-w-3xl text-sm leading-6 break-words whitespace-pre-wrap">{answer.answer}</p>
                    <div className="-ms-2 flex flex-wrap items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!user || answerBusy}
                        onClick={() => void handleUpvote(answer)}
                        className={answer.userUpvoted ? 'text-primary' : 'text-muted-foreground'}
                        aria-pressed={answer.userUpvoted}
                        aria-label={user ? `Hilfreich, ${answer.upvoteCount} Stimmen` : 'Zum Abstimmen anmelden'}
                      >
                        <ArrowUp />{answer.upvoteCount} Hilfreich
                      </Button>
                      {user && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          aria-label={`Auf die Antwort von ${name} antworten`}
                          onClick={() => {
                            setReplyTargets((previous) => ({ ...previous, [question.id]: answer }));
                            setCollapsedThreads((previous) => ({ ...previous, [threadRootId]: false }));
                          }}
                        >
                          <Reply />Antworten
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <li key={question.id} className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-start gap-2 p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => toggleQuestion(question.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`faq-answer-panel-${question.id}`}
                    className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-4 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      {global && (
                        <span className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
                          {question.scope === 'app' && (
                            <span className="relative flex size-4 shrink-0 items-center justify-center overflow-hidden rounded text-[10px]">
                              {appIconSrc ? <Image src={appIconSrc} alt="" fill sizes="16px" className="object-contain" unoptimized /> : (question.appIcon || question.appName?.charAt(0) || 'A')}
                            </span>
                          )}
                          {question.scope === 'app' ? question.appName : `${storeName} allgemein`}
                        </span>
                      )}
                      <h3 className="text-base leading-snug font-semibold break-words">{question.question}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{question.username || 'Anonymer Nutzer'}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
                        <span aria-hidden="true">·</span>
                        {question.answerCount === 0 ? (
                          <Badge variant="warning" size="sm">Antwort gesucht</Badge>
                        ) : (
                          <span>{question.answerCount} {question.answerCount === 1 ? 'Antwort' : 'Antworten'}</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {canDeleteQuestion && (
                    <Menu>
                      <Menu.Trigger
                        render={<Button size="icon-sm" variant="ghost" aria-label="Weitere Aktionen für diese Frage" disabled={busyAction === `delete-question:${question.id}`} />}
                      >
                        <MoreHorizontal />
                      </Menu.Trigger>
                      <Menu.Content align="end">
                        <Menu.Item variant="destructive" onClick={() => setQuestionToDelete(question)}>
                          <Trash2 />Frage löschen
                        </Menu.Item>
                      </Menu.Content>
                    </Menu>
                  )}
                </div>

                {isExpanded && (
                  <div id={`faq-answer-panel-${question.id}`} className="border-t px-4 pb-4 sm:px-5">
                    {global && question.scope === 'app' && question.appId && (
                      <Link href={`/apps/${question.appId}`} className="mt-3 inline-block text-xs font-medium underline-offset-4 hover:underline">
                        Zu {question.appName || 'dieser App'}
                      </Link>
                    )}
                    {answerPage?.loading && answerPage.answers.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Spinner /> Antworten werden geladen …
                      </div>
                    ) : (answerPage?.answers.length ?? 0) > 0 ? (
                      <div className="divide-y">
                        {threads.map(({ root, replies }) => {
                          const targetInThread = replyTarget && (replyTarget.id === root.id || replies.some((reply) => reply.id === replyTarget.id));
                          const expanded = !collapsedThreads[root.id];
                          return (
                            <section key={root.id} className="py-1" aria-label={`Antwort von ${root.username || 'Anonymer Nutzer'} mit Diskussion`}>
                              {renderAnswer(root, false, root.id)}
                              {(replies.length > 0 || targetInThread) && (
                                <div className="ms-3 border-s ps-4 sm:ps-6">
                                  {replies.length > 0 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="-ms-2 text-muted-foreground"
                                      aria-expanded={expanded}
                                      aria-controls={`faq-thread-${root.id}`}
                                      onClick={() => setCollapsedThreads((previous) => ({ ...previous, [root.id]: expanded }))}
                                    >
                                      <ChevronDown className={expanded ? '' : '-rotate-90'} />
                                      {replies.length} {replies.length === 1 ? 'Antwort' : 'Antworten'} in dieser Diskussion
                                    </Button>
                                  )}
                                  <div id={`faq-thread-${root.id}`} hidden={!expanded}>
                                    {replies.map((reply) => renderAnswer(reply, true, root.id))}
                                  </div>
                                  {targetInThread && user && (
                                    <div id={`faq-reply-composer-${question.id}`} className="pt-2 pb-4">
                                      <FAQAnswerComposer
                                        recipient={replyTarget.username || 'Anonymer Nutzer'}
                                        value={replyDrafts[question.id] || ''}
                                        onChange={(value) => setReplyDrafts((previous) => ({ ...previous, [question.id]: value }))}
                                        onSubmit={() => void handleAnswer(question.id, true)}
                                        onCancel={() => setReplyTargets((previous) => ({ ...previous, [question.id]: undefined }))}
                                        pending={submitting === `answer:${question.id}`}
                                        disabled={submitting !== null}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Antwort. Teile dein Wissen!</p>
                    )}

                    {answerPage?.hasMore && (
                      <div ref={loadMoreAnswersRef} className="flex justify-center py-2" aria-live="polite">
                        {answerPage.loading ? <Spinner /> : (
                          <Button size="sm" variant="ghost" onClick={() => void loadAnswers(question.id, answerPage.page + 1, true)}>Weitere Antworten laden</Button>
                        )}
                      </div>
                    )}

                    {user && (
                      <details id={`faq-composer-${question.id}`} className="group border-t pt-2">
                        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                          <Plus className="size-4 transition-transform group-open:rotate-45" />Antwort schreiben
                        </summary>
                        <div className="pt-2 pb-1">
                          <FAQAnswerComposer
                            value={answerDraft}
                            onChange={(value) => setAnswerDrafts((previous) => ({ ...previous, [question.id]: value }))}
                            onSubmit={() => void handleAnswer(question.id)}
                            pending={submitting === `answer:${question.id}`}
                            disabled={submitting !== null}
                          />
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasMoreQuestions && (
        <div ref={loadMoreQuestionsRef} className="flex justify-center py-4" aria-live="polite">
          {loadingMoreQuestions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />Weitere Fragen werden geladen …</div>
          ) : (
            <Button variant="outline" onClick={() => void loadFAQ(questionPage + 1, true)}>Weitere Fragen laden</Button>
          )}
        </div>
      )}
      <FAQDeleteConfirmation
        title="Antwort löschen?"
        description="Die Antwort wird unwiderruflich entfernt."
        isOpen={answerToDelete !== null}
        onOpenChange={(open) => { if (!open) setAnswerToDelete(null); }}
        onConfirm={() => { if (answerToDelete) void handleDeleteAnswer(answerToDelete.questionId, answerToDelete.id); }}
      />
      <FAQDeleteConfirmation
        title="Frage löschen?"
        description="Die Frage wird mit allen Antworten unwiderruflich entfernt."
        isOpen={questionToDelete !== null}
        onOpenChange={(open) => { if (!open) setQuestionToDelete(null); }}
        onConfirm={() => { if (questionToDelete) void handleDeleteQuestion(questionToDelete.id); }}
      />
      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          <a href="/login" className="font-medium text-foreground underline underline-offset-4">Anmelden</a>, um Fragen zu stellen oder zu beantworten.
        </p>
      )}
    </div>
  );
}
