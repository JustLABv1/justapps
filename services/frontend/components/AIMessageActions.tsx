'use client';

import { Message } from '@/components/panelui/message';
import type { AIMessageFeedback } from '@/lib/ai';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

/** Copy and thumbs-up/down under an assistant's answer. */
export function AIMessageActions({
  content,
  feedback,
  onFeedback,
  reveal = 'always',
}: {
  content: string;
  feedback?: AIMessageFeedback;
  onFeedback: (feedback: AIMessageFeedback) => void;
  /** `hover` for earlier answers: the actions show when the answer is hovered or focused. */
  reveal?: 'always' | 'hover';
}) {
  return (
    <Message.Actions reveal={reveal}>
      <Message.Action label="Antwort kopieren" copy={content} />
      <Message.Action
        label="Antwort hilfreich"
        pressed={feedback === 'positive'}
        onClick={() => onFeedback(feedback === 'positive' ? '' : 'positive')}
      >
        <ThumbsUp className={feedback === 'positive' ? 'fill-current' : undefined} />
      </Message.Action>
      <Message.Action
        label="Antwort nicht hilfreich"
        pressed={feedback === 'negative'}
        onClick={() => onFeedback(feedback === 'negative' ? '' : 'negative')}
      >
        <ThumbsDown className={feedback === 'negative' ? 'fill-current' : undefined} />
      </Message.Action>
    </Message.Actions>
  );
}
