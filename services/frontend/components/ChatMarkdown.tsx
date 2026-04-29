'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-2" />
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /\blanguage-/.test(className || '');
            if (isBlock) {
              return (
                <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                  <code className={className} {...props}>{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-surface px-1 py-0.5 text-[0.85em] font-mono" {...props}>
                {children}
              </code>
            );
          },
          ul: (props) => <ul className="my-2 ml-4 list-disc space-y-1" {...props} />,
          ol: (props) => <ol className="my-2 ml-4 list-decimal space-y-1" {...props} />,
          h1: (props) => <h1 className="mt-3 mb-2 text-base font-bold" {...props} />,
          h2: (props) => <h2 className="mt-3 mb-2 text-sm font-bold" {...props} />,
          h3: (props) => <h3 className="mt-2 mb-1 text-sm font-semibold" {...props} />,
          p: (props) => <p className="my-1 leading-6" {...props} />,
          blockquote: (props) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 text-muted" {...props} />
          ),
          table: (props) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...props} />
            </div>
          ),
          th: (props) => <th className="border border-border bg-surface px-2 py-1 text-left font-semibold" {...props} />,
          td: (props) => <td className="border border-border px-2 py-1 align-top" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
