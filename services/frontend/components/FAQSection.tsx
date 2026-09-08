'use client';

import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { AlertDialog, Button, Card, Chip, Label, TextArea, TextField, toast } from '@heroui/react';
import { ArrowUp, Heart, Loader2, MessageCircleQuestion, Pin, Send, Trash2, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface FAQAnswer {
  id: string;
  questionId: string;
  userId: string;
  username: string;
  answer: string;
  isPinned: boolean;
  creatorLiked: boolean;
  createdAt: string;
  upvoteCount: number;
  userUpvoted: boolean;
}

interface FAQQuestion {
  id: string;
  userId: string;
  username: string;
  question: string;
  createdAt: string;
  answerCount: number;
  answers: FAQAnswer[];
}

interface FAQSectionProps {
  appId: string;
  /** The app owner and admins can promote or moderate answers. */
  canManageHighlights: boolean;
}

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
          className="h-auto min-w-0 gap-1 px-0 py-0 text-[10px] font-bold text-danger"
          aria-label={title}
        >
          <Trash2 className="h-3 w-3" />
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

export function FAQSection({ appId, canManageHighlights }: FAQSectionProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<FAQQuestion[]>([]);
  const [questionDraft, setQuestionDraft] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFAQ = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi(`/apps/${appId}/faq`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await responseError(response, 'FAQ konnte nicht geladen werden.'));
      }
      const data = await response.json() as { questions?: FAQQuestion[] };
      const nextQuestions = Array.isArray(data.questions)
        ? data.questions.map((question) => {
            const answers = Array.isArray(question.answers) ? question.answers : [];
            return {
              ...question,
              answers,
              answerCount: Number.isFinite(question.answerCount) ? question.answerCount : answers.length,
            };
          })
        : [];
      setQuestions(nextQuestions);
      setError(null);
      return true;
    } catch (reason) {
      const message = userFacingError(reason, 'FAQ konnte nicht geladen werden. Bitte versuchen Sie es erneut.');
      setError(message);
      toast.danger(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadFAQ();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadFAQ]);

  const handleAskQuestion = async () => {
    const question = questionDraft.trim();
    if (!user || !question || submitting) return;

    setSubmitting('question');
    setError(null);
    try {
      const response = await fetchApi(`/apps/${appId}/faq/questions`, {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Frage konnte nicht veröffentlicht werden.'));
      }
      setQuestionDraft('');
      if (await loadFAQ()) {
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
      const response = await fetchApi(`/apps/${appId}/faq/questions/${questionId}/answers`, {
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
      if (await loadFAQ()) {
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
      const response = await fetchApi(`/apps/${appId}/faq/questions/${questionId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Frage konnte nicht gelöscht werden.'));
      }
      if (await loadFAQ()) {
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
      const response = await fetchApi(`/apps/${appId}/faq/questions/${questionId}/answers/${answerId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Antwort konnte nicht gelöscht werden.'));
      }
      if (await loadFAQ()) {
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
      const response = await fetchApi(`/apps/${appId}/faq/answers/${answer.id}/upvote`, { method });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Stimme konnte nicht gespeichert werden.'));
      }
      const result = await response.json().catch(() => ({})) as { upvoted?: boolean; upvoteCount?: number };
      setQuestions((previous) => previous.map((question) => ({
        ...question,
        answers: question.answers.map((candidate) => candidate.id === answer.id
          ? {
              ...candidate,
              userUpvoted: result.upvoted ?? !answer.userUpvoted,
              upvoteCount: result.upvoteCount ?? candidate.upvoteCount + (answer.userUpvoted ? -1 : 1),
            }
          : candidate),
      })));
      toast.success(answer.userUpvoted ? 'Stimme entfernt.' : 'Antwort als hilfreich markiert.');
    } catch (reason) {
      const message = userFacingError(reason, 'Stimme konnte nicht gespeichert werden.');
      setError(message);
      toast.danger(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleHighlight = async (answer: FAQAnswer, field: 'isPinned' | 'creatorLiked') => {
    if (!canManageHighlights) return;
    const action = `${field}:${answer.id}`;
    setBusyAction(action);
    setError(null);
    const enabled = !answer[field];
    try {
      const response = await fetchApi(`/apps/${appId}/faq/answers/${answer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: enabled }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, 'Hervorhebung konnte nicht gespeichert werden.'));
      }
      if (await loadFAQ()) {
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
    <div className="mt-2 space-y-6">
      <div className="flex items-center gap-2 text-lg font-bold text-foreground">
        <MessageCircleQuestion className="h-5 w-5 text-accent" />
        Fragen & Antworten
        {questions.length > 0 && (
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold text-muted shadow-sm">
            {questions.length}
          </span>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-foreground">Gemeinsam Antworten finden</span>
        <span aria-hidden="true">·</span>
        Stellen Sie Fragen oder teilen Sie Ihr Wissen. Hilfreiche Antworten werden durch Stimmen und Empfehlungen sichtbarer.
      </p>

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      {user ? (
        <Card className="border-border bg-surface-secondary shadow-sm" variant="default">
          <Card.Content className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <TextField
              value={questionDraft}
              onChange={setQuestionDraft}
              className="flex min-w-0 flex-1 flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-4">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Eine Frage stellen
                </Label>
                <span className="text-[10px] text-muted">Max. 1.000 Zeichen</span>
              </div>
              <TextArea
                aria-label="Ihre Frage"
                placeholder="Was möchten Sie über diese App wissen?"
                variant="secondary"
                className="min-h-16 w-full rounded-lg border border-border bg-default text-sm"
                rows={2}
                maxLength={1000}
              />
            </TextField>
            <Button
              size="sm"
              onPress={handleAskQuestion}
              isDisabled={!questionDraft.trim() || submitting !== null}
              isPending={submitting === 'question'}
              className="w-full shrink-0 gap-2 rounded-lg bg-accent px-4 text-xs font-bold text-white shadow-sm hover:bg-accent/90 sm:w-auto"
            >
              <Send className="h-3.5 w-3.5" />
              Frage veröffentlichen
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <Card variant="secondary" className="rounded-xl border border-border bg-surface-secondary/50 shadow-sm">
          <Card.Content className="p-6 text-center text-sm">
            <p className="font-medium text-muted">Bitte melden Sie sich an, um Fragen zu stellen, Antworten zu geben oder abzustimmen.</p>
          </Card.Content>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          Fragen und Antworten werden geladen …
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-secondary/10 py-12 text-center text-muted">
          <MessageCircleQuestion className="mx-auto mb-3 h-8 w-8 opacity-20" />
          <p className="text-sm font-medium">Noch keine Fragen. Stellen Sie die erste Frage!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {questions.map((question) => {
            const canDeleteQuestion = canManageHighlights || user?.id === question.userId;
            const answerDraft = answerDrafts[question.id] || '';

            return (
              <article key={question.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                <div className="flex items-start justify-between gap-4 border-b border-border bg-surface-secondary/40 p-5">
                  <div className="min-w-0 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Frage</p>
                    <h3 className="text-base font-bold leading-relaxed text-foreground">{question.question}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                      <span>{question.username || 'Anonymer Nutzer'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(question.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{question.answerCount} {question.answerCount === 1 ? 'Antwort' : 'Antworten'}</span>
                      {question.answerCount === 0 && (
                        <Chip size="sm" color="warning" variant="soft" className="text-[10px] font-bold">
                          Antwort gesucht
                        </Chip>
                      )}
                    </div>
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

                <div className="space-y-3 p-5">
                  {question.answers.length > 0 ? question.answers.map((answer) => {
                    const canDeleteAnswer = canManageHighlights || user?.id === answer.userId;
                    const answerBusy = busyAction === `upvote:${answer.id}`
                      || busyAction === `isPinned:${answer.id}`
                      || busyAction === `creatorLiked:${answer.id}`
                      || busyAction === `delete-answer:${answer.id}`;

                    return (
                      <div
                        key={answer.id}
                        className={`rounded-xl border p-4 transition-colors ${answer.isPinned || answer.creatorLiked ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface-secondary/30'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface shadow-sm">
                              <User className="h-4 w-4 text-muted" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-foreground">{answer.username || 'Anonymer Nutzer'}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{formatDate(answer.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
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

                        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted">{answer.answer}</p>

                        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/70 pt-3">
                          <Button
                            size="sm"
                            variant={answer.userUpvoted ? 'primary' : 'secondary'}
                            isDisabled={!user || answerBusy}
                            onPress={() => void handleUpvote(answer)}
                            className={`gap-1.5 ${answer.userUpvoted ? 'bg-accent text-white' : ''}`}
                            aria-label={user ? 'Antwort hochstufen' : 'Zum Abstimmen anmelden'}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                            <span>{answer.upvoteCount}</span>
                            <span className="text-xs">Hilfreich</span>
                          </Button>

                          {canManageHighlights && (
                            <>
                              <Button
                                size="sm"
                                variant={answer.isPinned ? 'primary' : 'ghost'}
                                isDisabled={answerBusy}
                                onPress={() => void handleHighlight(answer, 'isPinned')}
                                className={`gap-1.5 text-xs ${answer.isPinned ? 'bg-accent text-white' : 'text-muted'}`}
                              >
                                <Pin className="h-3.5 w-3.5" />
                                {answer.isPinned ? 'Lösen' : 'Anheften'}
                              </Button>
                              <Button
                                size="sm"
                                variant={answer.creatorLiked ? 'primary' : 'ghost'}
                                isDisabled={answerBusy}
                                onPress={() => void handleHighlight(answer, 'creatorLiked')}
                                className={`gap-1.5 text-xs ${answer.creatorLiked ? 'bg-accent text-white' : 'text-muted'}`}
                              >
                                <Heart className={`h-3.5 w-3.5 ${answer.creatorLiked ? 'fill-current' : ''}`} />
                                {answer.creatorLiked ? 'Empfehlung entfernen' : 'Empfehlen'}
                              </Button>
                            </>
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

                  {user && (
                    <div className="border-t border-border pt-4">
                      <TextField
                        value={answerDraft}
                        onChange={(value) => setAnswerDrafts((previous) => ({ ...previous, [question.id]: value }))}
                        className="flex flex-col gap-1.5"
                      >
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted">Antwort hinzufügen</Label>
                        <TextArea
                          aria-label={`Antwort auf: ${question.question}`}
                          placeholder="Was ist Ihre Erfahrung oder Empfehlung?"
                          variant="secondary"
                          className="min-h-20 w-full rounded-lg border border-border bg-default text-sm"
                          rows={3}
                          maxLength={5000}
                        />
                      </TextField>
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
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
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
