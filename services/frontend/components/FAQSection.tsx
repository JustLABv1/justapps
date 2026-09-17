'use client';

import { useAuth } from '@/context/AuthContext';
import { useStoreName } from '@/context/SettingsContext';
import { PageFilters } from '@/components/PageHeader';
import { fetchApi } from '@/lib/api';
import { AlertDialog, Button, Card, Chip, Input, Label, ListBox, Select, TextArea, TextField, Tooltip, toast } from '@heroui/react';
import { ArrowUp, ChevronDown, Heart, Loader2, MessageCircleQuestion, Pin, Plus, Search, Send, Trash2, UserRound, X } from 'lucide-react';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { getImageAssetUrl } from '@/lib/assets';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface FAQAnswer {
  id: string;
  questionId: string;
  userId: string;
  username: string;
  answer: string;
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

function AnswerActionTooltip({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Tooltip delay={350} closeDelay={100}>
      {children}
      <Tooltip.Content showArrow placement="top" className="max-w-72 px-3 py-2.5">
        <Tooltip.Arrow />
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

function DeleteAction({
  title,
  description,
  isLoading,
  onConfirm,
}: {
  title: string;
  description: string;
  isLoading: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialog.Trigger>
        <Button
          variant="ghost"
          size="sm"
          isDisabled={isLoading}
          className="gap-1.5 text-xs text-muted hover:text-danger"
          aria-label={title}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Löschen
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[420px]">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{description}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">Abbrechen</Button>
              <Button slot="close" variant="danger" onPress={onConfirm} isPending={isLoading}>
                Löschen
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

export function FAQSection({ appId, canDeleteQuestions, canDeleteAnswers, canPinAnswers, canRecommendAnswers, global = false }: FAQSectionProps) {
  const { user } = useAuth();
  const storeName = useStoreName();
  const [questions, setQuestions] = useState<FAQQuestion[]>([]);
  const [questionDraft, setQuestionDraft] = useState('');
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
      const params = new URLSearchParams({ page: String(page), pageSize: String(FAQ_ANSWER_PAGE_SIZE) });
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

  const handleAnswer = async (questionId: string) => {
    const answer = (answerDrafts[questionId] || '').trim();
    if (!user || !answer || submitting) return;

    setSubmitting(`answer:${questionId}`);
    setError(null);
    try {
      const response = await fetchApi(`${endpointForQuestion(questionId)}/questions/${questionId}/answers`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Antwort konnte nicht veröffentlicht werden.'));
      }
      setAnswerDrafts((previous) => {
        const next = { ...previous };
        delete next[questionId];
        return next;
      });
      if (await loadFAQ(1, false)) {
        setExpandedQuestionId(questionId);
        await loadAnswers(questionId);
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
            const answerDraft = answerDrafts[question.id] || '';
            const answerPage = answerPages[question.id];
            const isExpanded = expandedQuestionId === question.id;
            const appIconSrc = getImageAssetUrl(question.appIcon);

            return (
              <article key={question.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => toggleQuestion(question.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`faq-answer-panel-${question.id}`}
                  className="flex w-full cursor-pointer items-start justify-between gap-4 p-5 text-left outline-none hover:bg-surface-secondary/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:p-6"
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

                {isExpanded && (
                <div className="px-5 pb-6 sm:px-6">
                  <div id={`faq-answer-panel-${question.id}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="font-medium text-foreground">{question.answerCount === 1 ? 'Antwort' : 'Antworten'}</h4>
                      {global && question.scope === 'app' && question.appId && (
                        <Link href={`/apps/${question.appId}`} className="font-medium text-accent hover:underline">
                          Zu {question.appName || 'dieser App'}
                        </Link>
                      )}
                    </div>
                  {canDeleteQuestion && (
                    <DeleteAction
                      title="Frage löschen?"
                      description="Möchten Sie diese Frage einschließlich aller Antworten wirklich löschen?"
                      isLoading={busyAction === `delete-question:${question.id}`}
                      onConfirm={() => void handleDeleteQuestion(question.id)}
                    />
                  )}
                </div>
                <div className="space-y-3">
                  {answerPage?.loading && answerPage.answers.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" /> Antworten werden geladen …
                    </div>
                  ) : (answerPage?.answers.length ?? 0) > 0 ? answerPage!.answers.map((answer) => {
                    const canDeleteAnswer = canDeleteAnswers || user?.id === answer.userId;
                    const answerBusy = busyAction === `upvote:${answer.id}`
                      || busyAction === `acceptance:${answer.id}`
                      || busyAction === `isPinned:${answer.id}`
                      || busyAction === `creatorLiked:${answer.id}`
                      || busyAction === `delete-answer:${answer.id}`;

                    return (
                      <div
                        key={answer.id}
                        className={`rounded-xl border p-4 sm:p-5 ${answer.isPinned || answer.creatorLiked ? 'border-accent/25 bg-accent/5' : 'border-transparent bg-surface-secondary/60'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface text-xs font-semibold uppercase text-accent">
                              {(answer.username || 'Anonymer Nutzer').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('')}
                            </span>
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-foreground">{answer.username || 'Anonymer Nutzer'}</p>
                              <time dateTime={answer.createdAt} className="text-xs text-muted">{formatDate(answer.createdAt)}</time>
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {answer.acceptedByAuthor && (
                              <Chip size="sm" variant="soft" color="success" className="gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" /> Vom Fragensteller bestätigt
                              </Chip>
                            )}
                            {answer.isPinned && (
                              <Chip size="sm" variant="soft" color="accent" className="gap-1 text-[10px] font-bold">
                                <Pin className="h-3 w-3" /> Angepinnt
                              </Chip>
                            )}
                            {answer.creatorLiked && (
                              <Chip size="sm" variant="soft" color="success" className="gap-1 text-[10px] font-bold">
                                <Heart className="h-3 w-3 fill-current" /> Empfohlen
                              </Chip>
                            )}
                          </div>
                        </div>

                        <p className="my-4 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-foreground sm:ml-12">{answer.answer}</p>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:ml-12">
                          <Button
                            size="sm"
                            variant={answer.userUpvoted ? 'secondary' : 'ghost'}
                            isDisabled={!user || answerBusy}
                            onPress={() => void handleUpvote(answer)}
                            className={`gap-1.5 text-xs ${answer.userUpvoted ? 'text-accent' : 'text-muted'}`}
                            aria-pressed={answer.userUpvoted}
                            aria-label={user ? 'Antwort hochstufen' : 'Zum Abstimmen anmelden'}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                            <span>{answer.upvoteCount}</span>
                            <span className="text-xs">Hilfreich</span>
                          </Button>

                          {(canPinAnswers || canRecommendAnswers) && (
                            <>
                              {canPinAnswers && <AnswerActionTooltip title="Anheften" description="Hält diese Antwort oben in der Liste. Das sagt nicht aus, ob das konkrete Anliegen gelöst wurde.">
                              <Button
                                size="sm"
                                variant="ghost"
                                isDisabled={answerBusy}
                                onPress={() => void handleHighlight(answer, 'isPinned')}
                                className={`gap-1.5 text-xs ${answer.isPinned ? 'text-accent' : 'text-muted'}`}
                                aria-pressed={answer.isPinned}
                              >
                                <Pin className="h-3.5 w-3.5" />
                                {answer.isPinned ? 'Lösen' : 'Anheften'}
                              </Button>
                              </AnswerActionTooltip>}
                              {canRecommendAnswers && <AnswerActionTooltip title="Empfehlen" description="Zeichnet eine fachlich besonders hilfreiche Antwort aus. Das ist unabhängig von der Bestätigung des Fragenstellers.">
                              <Button
                                size="sm"
                                variant="ghost"
                                isDisabled={answerBusy}
                                onPress={() => void handleHighlight(answer, 'creatorLiked')}
                                className={`gap-1.5 text-xs ${answer.creatorLiked ? 'text-accent' : 'text-muted'}`}
                                aria-pressed={answer.creatorLiked}
                              >
                                <Heart className={`h-3.5 w-3.5 ${answer.creatorLiked ? 'fill-current' : ''}`} />
                                {answer.creatorLiked ? 'Empfehlung entfernen' : 'Empfehlen'}
                              </Button>
                              </AnswerActionTooltip>}
                            </>
                          )}

                          {user?.id === question.userId && (
                            <AnswerActionTooltip title="Hat meine Frage beantwortet" description="Nur der Fragensteller bestätigt damit, dass diese Antwort sein konkretes Anliegen gelöst hat. Das ist keine redaktionelle Empfehlung.">
                            <Button size="sm" variant="ghost" isDisabled={answerBusy}
                              aria-pressed={answer.acceptedByAuthor}
                              className={`gap-1.5 text-xs ${answer.acceptedByAuthor ? 'text-success' : 'text-muted'}`}
                              onPress={() => void handleAcceptance(answer)}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {answer.acceptedByAuthor ? 'Bestätigung zurücknehmen' : 'Hat meine Frage beantwortet'}
                            </Button>
                            </AnswerActionTooltip>
                          )}

                          {canDeleteAnswer && (
                            <DeleteAction
                              title="Antwort löschen?"
                              description="Möchten Sie diese Antwort wirklich unwiderruflich löschen?"
                              isLoading={busyAction === `delete-answer:${answer.id}`}
                              onConfirm={() => void handleDeleteAnswer(question.id, answer.id)}
                            />
                          )}
                        </div>
                      </div>
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
                    <details className="group rounded-xl border border-border">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden"><Plus className="h-4 w-4 group-open:rotate-45" />Antwort schreiben</summary>
                      <div className="px-4 pb-4">
                      <TextField
                        value={answerDraft}
                        onChange={(value) => setAnswerDrafts((previous) => ({ ...previous, [question.id]: value }))}
                        className="flex flex-col gap-1.5"
                      >
                        <Label className="sr-only">Ihre Antwort</Label>
                        <TextArea
                          aria-label={`Antwort auf: ${question.question}`}
                          placeholder="Was ist Ihre Erfahrung oder Empfehlung?"
                          variant="secondary"
                          className="min-h-28 w-full rounded-lg border border-border bg-surface text-sm leading-relaxed"
                          rows={3}
                          maxLength={5000}
                        />
                      </TextField>
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="primary"
                          onPress={() => void handleAnswer(question.id)}
                          isDisabled={!answerDraft.trim() || submitting !== null}
                          isPending={submitting === `answer:${question.id}`}
                          className="gap-1.5 font-bold"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Antwort senden
                        </Button>
                      </div>
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
      {!user && <p className="text-center text-sm text-muted"><a href="/login" className="font-medium text-accent underline underline-offset-4">Anmelden</a>, um eigene Fragen zu stellen oder Antworten beizutragen.</p>}
    </div>
  );
}
