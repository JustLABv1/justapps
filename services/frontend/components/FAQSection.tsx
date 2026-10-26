'use client';

import { useAuth } from '@/context/AuthContext';
import { useStoreName } from '@/context/SettingsContext';
import { PageFilters } from '@/components/PageHeader';
import { fetchApi } from '@/lib/api';
import { groupFAQThreads } from '@/lib/faqThreads';
import { AlertDialog, Button, Card, Chip, Dropdown, Input, Label, ListBox, Select, TextArea, TextField, toast } from '@heroui/react';
import { ArrowUp, ChevronDown, Heart, Loader2, MessageCircleQuestion, MoreHorizontal, Reply, Pin, Plus, Search, Send, Trash2, UserRound, X } from 'lucide-react';
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
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[420px]">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>{description}</AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">Abbrechen</Button>
            <Button slot="close" variant="danger" onPress={onConfirm}>Löschen</Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
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
    <div className="space-y-3">
      <TextField value={value} onChange={onChange} className="flex flex-col gap-2">
        <Label className="text-xs font-medium text-muted">{recipient ? `Antwort an ${recipient}` : 'Ihre Antwort auf die Frage'}</Label>
        <TextArea autoComplete="off" placeholder={recipient ? 'Diskussion fortsetzen …' : 'Teilen Sie Ihre Erfahrung oder Empfehlung …'}
          variant="secondary" className="min-h-24 w-full rounded-lg border border-border bg-surface text-sm leading-relaxed" rows={3} maxLength={5000} />
      </TextField>
      <div className="flex justify-end gap-2">
        {onCancel && <Button size="sm" variant="ghost" onPress={onCancel} isDisabled={pending}>Abbrechen</Button>}
        <Button size="sm" variant="primary" onPress={onSubmit} isDisabled={!value.trim() || disabled} isPending={pending} className="gap-1.5">
          <Send className="h-3.5 w-3.5" />{recipient ? 'Antwort senden' : 'Antwort veröffentlichen'}
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

  return (
    <div className={`${global ? '' : 'mt-2'} space-y-5`}>
      {(
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{global ? 'Alle Fragen' : 'Häufige Fragen'}</h2>
            {totalQuestions > 0 && (
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold text-muted shadow-sm">
                {totalQuestions}
              </span>
            )}
            </div>
            {user && <Button size="sm" variant="secondary" onPress={() => setComposerOpen(!composerOpen)} aria-expanded={composerOpen} aria-controls="faq-composer"><Plus className="h-4 w-4" />Frage stellen</Button>}
          </div>
        </>
      )}

      {(
        <div className="space-y-4">
          <div className="space-y-4">
            <PageFilters>
              <div className="flex w-full flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Fragen, Antworten oder Personen durchsuchen"
                      aria-label="FAQ durchsuchen"
                      className="h-12 w-full rounded-xl pl-10 pr-9"
                      variant="secondary"
                    />
                    {searchQuery && (
                      <Button isIconOnly size="sm" variant="ghost" aria-label="Suche löschen" onPress={() => setSearchQuery('')} className="absolute right-1 top-1/2 min-w-7 -translate-y-1/2">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 items-center gap-2 border-t border-border/60 pt-3 sm:flex sm:flex-wrap" role="group" aria-label="Filter und Sortierung">
                  {global && (
                    <Select
                      aria-label="FAQ-Bereich filtern"
                      selectedKey={scopeFilter}
                      onSelectionChange={(key) => {
                        const value = String(key) as FAQScopeFilter;
                        setScopeFilter(value);
                        if (value !== 'app') setSelectedAppId('');
                      }}
                      variant="secondary"
                      className="min-w-0 w-full sm:w-44"
                    >
                      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="all" textValue="Alle Bereiche">Alle Bereiche<ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="global" textValue={`${storeName} allgemein`}>{storeName} allgemein<ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="app" textValue="App-FAQs">App-FAQs<ListBox.ItemIndicator /></ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                  {global && scopeFilter === 'app' && (
                    <Select aria-label="Nach App filtern" selectedKey={selectedAppId || 'all'} onSelectionChange={(key) => setSelectedAppId(String(key) === 'all' ? '' : String(key))} variant="secondary" className="min-w-0 w-full sm:w-52">
                      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="all" textValue="Alle Apps">Alle Apps<ListBox.ItemIndicator /></ListBox.Item>
                          {faqApps.map((app) => <ListBox.Item key={app.id} id={app.id} textValue={app.name}>{app.name}<ListBox.ItemIndicator /></ListBox.Item>)}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                  <Select aria-label="Antwortstatus filtern" selectedKey={statusFilter} onSelectionChange={(key) => setStatusFilter(String(key) as FAQStatusFilter)} variant="secondary" className="min-w-0 w-full sm:w-40">
                    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="all" textValue="Alle Status">Alle Status<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="open" textValue="Offen">Offen<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="answered" textValue="Beantwortet">Beantwortet<ListBox.ItemIndicator /></ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {user && (
                    <Button size="sm" className="h-9" variant={mineOnly ? 'primary' : 'secondary'} aria-pressed={mineOnly} onPress={() => setMineOnly((current) => !current)}>
                      <UserRound className="h-4 w-4" />Meine Fragen
                    </Button>
                  )}
                  <Select aria-label="Fragen sortieren" selectedKey={sort} onSelectionChange={(key) => setSort(String(key) as FAQSort)} variant="secondary" className="min-w-0 w-full sm:ml-auto sm:w-48">
                    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="newest" textValue="Neueste zuerst">Neueste zuerst<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="most-answered" textValue="Meiste Antworten">Meiste Antworten<ListBox.ItemIndicator /></ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
            </PageFilters>
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span role="status">{loading ? 'Fragen werden geladen …' : `${totalQuestions} ${totalQuestions === 1 ? 'Frage' : 'Fragen'}`}</span>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => { setSearchQuery(''); setStatusFilter('all'); setSort('newest'); setMineOnly(false); setScopeFilter('all'); setSelectedAppId(''); }}
                  className="h-auto px-0 py-0 text-xs"
                >
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      {user && composerOpen ? (
        <Card id="faq-composer" className="rounded-2xl border border-border bg-surface shadow-none" variant="default">
          <Card.Content className="flex flex-col gap-3 p-4 sm:p-5">
            <TextField
              value={questionDraft}
              onChange={setQuestionDraft}
              className="flex min-w-0 flex-1 flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm font-medium text-foreground">
                  Eine Frage stellen
                </Label>
                <span className="text-[10px] text-muted">Max. 1.000 Zeichen</span>
              </div>
              <TextArea
                autoFocus
                aria-label="Ihre Frage"
                placeholder={global ? `Was möchten Sie über ${storeName} wissen?` : 'Was möchten Sie über diese App wissen?'}
                variant="secondary"
                className="min-h-20 w-full rounded-xl border border-border bg-surface-secondary text-sm"
                rows={2}
                maxLength={1000}
              />
            </TextField>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="mr-2" onPress={() => setComposerOpen(false)}>Abbrechen</Button>
              <Button
                size="sm"
                onPress={handleAskQuestion}
                isDisabled={!questionDraft.trim() || submitting !== null}
                isPending={submitting === 'question'}
                className="w-full gap-2 font-bold sm:w-auto"
              >
                <Send className="h-3.5 w-3.5" />
                Frage veröffentlichen
              </Button>
            </div>
          </Card.Content>
        </Card>
      ) : null}

      {loading && questions.length === 0 ? (
        <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          Fragen und Antworten werden geladen …
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-secondary/10 py-12 text-center text-muted">
          <MessageCircleQuestion className="mx-auto mb-3 h-8 w-8 opacity-20" />
          <p className="text-sm font-medium">
            {hasActiveFilters ? 'Keine Fragen passen zu Ihrer Suche.' : 'Noch keine Fragen. Stellen Sie die erste Frage!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
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

              return (
                <div id={`faq-answer-${answer.id}`} key={answer.id}
                  className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-start gap-x-2.5 py-3">
                  <span aria-hidden="true" className="row-span-3 flex h-7 w-7 items-center justify-center rounded-full bg-surface-secondary text-[10px] font-semibold uppercase text-muted">
                    {(answer.username || 'Anonymer Nutzer').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('')}
                  </span>
                  <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words text-sm font-semibold text-foreground">{answer.username || 'Anonymer Nutzer'}</span>
                    <time dateTime={answer.createdAt} className="text-[11px] text-muted">{formatDate(answer.createdAt)}</time>
                    {answer.isPinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-accent"><Pin className="h-3 w-3" />Angepinnt</span>
                    )}
                    {answer.creatorLiked && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-success"><Heart className="h-3 w-3" />Empfohlen</span>
                    )}
                    {answer.acceptedByAuthor && (
                      <span title="Vom Fragensteller bestätigt" className="inline-flex items-center gap-1 text-[11px] text-success"><CheckCircle2 className="h-3 w-3" />Bestätigt</span>
                    )}
                  </div>
                  {(canPinAnswers || canRecommendAnswers || canDeleteAnswer || user?.id === question.userId) ? (
                    <Dropdown>
                      <Button isIconOnly size="sm" variant="ghost" isDisabled={answerBusy}
                        aria-label={`Weitere Aktionen für die Antwort von ${answer.username || 'Anonymer Nutzer'}`}
                        className="h-7 min-h-7 w-7 min-w-7 text-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <Dropdown.Popover placement="bottom end" className="min-w-56">
                        <Dropdown.Menu aria-label="Antwort verwalten" onAction={(key) => {
                          if (key === 'pin') void handleHighlight(answer, 'isPinned');
                          if (key === 'recommend') void handleHighlight(answer, 'creatorLiked');
                          if (key === 'accept') void handleAcceptance(answer);
                          if (key === 'delete') setAnswerToDelete(answer);
                        }}>
                          {canPinAnswers && (
                            <Dropdown.Item id="pin" textValue={answer.isPinned ? 'Anheftung entfernen' : 'Antwort anheften'}>
                              <Pin className="h-4 w-4 text-muted" /><Label>{answer.isPinned ? 'Anheftung entfernen' : 'Antwort anheften'}</Label>
                            </Dropdown.Item>
                          )}
                          {canRecommendAnswers && (
                            <Dropdown.Item id="recommend" textValue={answer.creatorLiked ? 'Empfehlung entfernen' : 'Antwort empfehlen'}>
                              <Heart className="h-4 w-4 text-muted" /><Label>{answer.creatorLiked ? 'Empfehlung entfernen' : 'Antwort empfehlen'}</Label>
                            </Dropdown.Item>
                          )}
                          {user?.id === question.userId && (
                            <Dropdown.Item id="accept" textValue={answer.acceptedByAuthor ? 'Bestätigung zurücknehmen' : 'Hat meine Frage beantwortet'}>
                              <CheckCircle2 className="h-4 w-4 text-muted" /><Label>{answer.acceptedByAuthor ? 'Bestätigung zurücknehmen' : 'Hat meine Frage beantwortet'}</Label>
                            </Dropdown.Item>
                          )}
                          {canDeleteAnswer && (
                            <Dropdown.Item id="delete" textValue="Antwort löschen" variant="danger">
                              <Trash2 className="h-4 w-4 text-danger" /><Label>Antwort löschen</Label>
                            </Dropdown.Item>
                          )}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  ) : <span />}
                  <div className="col-start-2 col-end-4 min-w-0">
                    {isReply && answer.replyToAnswerId !== threadRootId && (
                      <p className="mb-1 flex items-center gap-1 text-[11px] text-muted"><Reply className="h-3 w-3" />an {answer.replyToUsername || 'Anonymer Nutzer'}</p>
                    )}
                    <p className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{answer.answer}</p>
                  </div>
                  <div className="col-start-2 col-end-4 mt-1 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" isDisabled={!user || answerBusy}
                      onPress={() => void handleUpvote(answer)}
                      className={`h-7 min-h-7 gap-1 px-1 text-xs ${answer.userUpvoted ? 'text-accent' : 'text-muted'}`}
                      aria-pressed={answer.userUpvoted} aria-label={user ? 'Antwort als hilfreich markieren' : 'Zum Abstimmen anmelden'}>
                      <ArrowUp className="h-3.5 w-3.5" />{answer.upvoteCount}<span>Hilfreich</span>
                    </Button>
                    {user && (
                      <Button size="sm" variant="ghost" className="h-7 min-h-7 gap-1 px-1 text-xs text-muted hover:text-foreground"
                        aria-label={`Auf die Antwort von ${answer.username || 'Anonymer Nutzer'} antworten`}
                        onPress={() => {
                          setReplyTargets((previous) => ({ ...previous, [question.id]: answer }));
                          setCollapsedThreads((previous) => ({ ...previous, [threadRootId]: false }));
                        }}>
                        <Reply className="h-3.5 w-3.5" />Antworten
                      </Button>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <article key={question.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="flex items-start gap-2 p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => toggleQuestion(question.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`faq-answer-panel-${question.id}`}
                  className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-4 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="min-w-0 space-y-2">
                    {global && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${question.scope === 'app' ? 'bg-accent/10 text-accent' : 'bg-surface-secondary text-muted'}`}>
                        {question.scope === 'app' && (
                          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded bg-surface text-[9px] font-bold">
                            {appIconSrc ? <Image src={appIconSrc} alt="" fill sizes="16px" className="object-contain p-0.5" unoptimized /> : (question.appIcon || question.appName?.charAt(0) || 'A')}
                          </span>
                        )}
                        {question.scope === 'app' ? question.appName : `${storeName} allgemein`}
                      </span>
                    )}
                    <h3 className="break-words text-lg font-semibold leading-snug text-foreground">{question.question}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-medium">{question.username || 'Anonymer Nutzer'}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
                      <span aria-hidden="true">·</span>
                      <span className="text-accent">{question.answerCount} {question.answerCount === 1 ? 'Antwort' : 'Antworten'}</span>
                      {question.answerCount === 0 && (
                        <Chip size="sm" color="warning" variant="soft" className="text-[10px] font-bold">
                          Antwort gesucht
                        </Chip>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-muted ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {canDeleteQuestion && (
                  <Dropdown>
                    <Button isIconOnly size="sm" variant="ghost"
                      aria-label="Weitere Aktionen für diese Frage"
                      isDisabled={busyAction === `delete-question:${question.id}`}
                      className="h-7 min-h-7 w-7 min-w-7 shrink-0 text-muted">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    <Dropdown.Popover placement="bottom end">
                      <Dropdown.Menu aria-label="Frage verwalten" onAction={(key) => {
                        if (key === 'delete') setQuestionToDelete(question);
                      }}>
                        <Dropdown.Item id="delete" textValue="Frage löschen" variant="danger">
                          <Trash2 className="h-4 w-4 text-danger" /><Label>Frage löschen</Label>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                )}
                </div>

                {isExpanded && (
                <div className="px-5 pb-6 sm:px-6">
                  <div id={`faq-answer-panel-${question.id}`}>
                  {global && question.scope === 'app' && question.appId && (
                    <Link href={`/apps/${question.appId}`} className="mb-2 inline-block text-xs font-medium text-accent hover:underline">
                      Zu {question.appName || 'dieser App'}
                    </Link>
                  )}
                <div className="space-y-3">
                  {answerPage?.loading && answerPage.answers.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" /> Antworten werden geladen …
                    </div>
                  ) : (answerPage?.answers.length ?? 0) > 0 ? threads.map(({ root, replies }) => {
                    const targetInThread = replyTarget && (replyTarget.id === root.id || replies.some((reply) => reply.id === replyTarget.id));
                    const expanded = !collapsedThreads[root.id];
                    return (
                      <section key={root.id} className="border-b border-border/60 pb-3 last:border-b-0" aria-label={`Antwort von ${root.username || 'Anonymer Nutzer'} mit Diskussion`}>
                        {renderAnswer(root, false, root.id)}
                        {(replies.length > 0 || targetInThread) && (
                          <div className="ml-3.5 border-l border-border pl-4 sm:pl-6">
                            {replies.length > 0 && (
                              <Button size="sm" variant="ghost" className="my-1 gap-1.5 text-xs text-muted"
                                aria-expanded={expanded} aria-controls={`faq-thread-${root.id}`}
                                onPress={() => setCollapsedThreads((previous) => ({ ...previous, [root.id]: expanded }))}>
                                <ChevronDown className={`h-3.5 w-3.5 ${expanded ? '' : '-rotate-90'}`} />
                                {replies.length} {replies.length === 1 ? 'Antwort' : 'Antworten'} in dieser Diskussion
                              </Button>
                            )}
                            <div id={`faq-thread-${root.id}`} hidden={!expanded}>
                              <div className="space-y-0.5">
                                {replies.map((reply) => renderAnswer(reply, true, root.id))}
                              </div>
                            </div>
                            {targetInThread && user && (
                              <div id={`faq-reply-composer-${question.id}`} className="pb-4 pt-3">
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
                  }) : (
                    <p className="rounded-xl border border-dashed border-border bg-surface-secondary/20 px-4 py-5 text-center text-sm text-muted">
                      Noch keine Antwort. Teilen Sie Ihr Wissen!
                    </p>
                  )}

                  {answerPage?.hasMore && (
                    <div ref={loadMoreAnswersRef} className="flex justify-center py-2" aria-live="polite">
                      {answerPage.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted" />
                      ) : (
                        <Button size="sm" variant="ghost" onPress={() => void loadAnswers(question.id, answerPage.page + 1, true)}>
                          Weitere Antworten laden
                        </Button>
                      )}
                    </div>
                  )}

                  {user && (
                    <details id={`faq-composer-${question.id}`} className="group border-t border-border/60 pt-2">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-2 text-sm font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden"><Plus className="h-4 w-4 group-open:rotate-45" />Antwort auf Frage schreiben</summary>
                      <div className="pb-3 pt-2">
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
                  </div>
                </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {hasMoreQuestions && (
        <div ref={loadMoreQuestionsRef} className="flex justify-center py-4" aria-live="polite">
          {loadingMoreQuestions ? (
            <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Weitere Fragen werden geladen …</div>
          ) : (
            <Button variant="secondary" onPress={() => void loadFAQ(questionPage + 1, true)}>Weitere Fragen laden</Button>
          )}
        </div>
      )}
      <FAQDeleteConfirmation
        title="Antwort löschen?"
        description="Möchten Sie diese Antwort wirklich unwiderruflich löschen?"
        isOpen={answerToDelete !== null}
        onOpenChange={(open) => { if (!open) setAnswerToDelete(null); }}
        onConfirm={() => { if (answerToDelete) void handleDeleteAnswer(answerToDelete.questionId, answerToDelete.id); }}
      />
      <FAQDeleteConfirmation
        title="Frage löschen?"
        description="Möchten Sie diese Frage einschließlich aller Antworten wirklich löschen?"
        isOpen={questionToDelete !== null}
        onOpenChange={(open) => { if (!open) setQuestionToDelete(null); }}
        onConfirm={() => { if (questionToDelete) void handleDeleteQuestion(questionToDelete.id); }}
      />
      {!user && <p className="text-center text-sm text-muted"><a href="/login" className="font-medium text-accent underline underline-offset-4">Anmelden</a>, um eigene Fragen zu stellen oder Antworten beizutragen.</p>}
    </div>
  );
}
