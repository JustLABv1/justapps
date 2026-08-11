'use client';

import type { AIMessageFeedback } from '@/lib/ai';
import { Button } from '@heroui/react';
import { Check, Copy, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

export function AIMessageActions({
  content,
  feedback,
  onFeedback,
}: {
  content: string;
  feedback?: AIMessageFeedback;
  onFeedback: (feedback: AIMessageFeedback) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-1">
      <Button
        isIconOnly
        aria-label="Antwort kopieren"
        size="sm"
        variant="ghost"
        className="h-7 w-7 text-muted"
        onPress={() => void copyMessage()}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <Button
        isIconOnly
        aria-label="Antwort hilfreich"
        size="sm"
        variant="ghost"
        className={`h-7 w-7 ${feedback === 'positive' ? 'text-success' : 'text-muted'}`}
        onPress={() => onFeedback(feedback === 'positive' ? '' : 'positive')}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        isIconOnly
        aria-label="Antwort nicht hilfreich"
        size="sm"
        variant="ghost"
        className={`h-7 w-7 ${feedback === 'negative' ? 'text-danger' : 'text-muted'}`}
        onPress={() => onFeedback(feedback === 'negative' ? '' : 'negative')}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
