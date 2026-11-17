"use client";

import { CodeBlock } from "@/components/CodeBlock";
import { Alert, type AlertTone } from "@/components/panelui/alert";
import { resolveRepositoryMarkdownImage, resolveRepositoryMarkdownLink } from "@/lib/markdown";
import { Children, type ComponentProps, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import { slugify, textOf } from "./headings";

type MarkdownRepository = Parameters<typeof resolveRepositoryMarkdownLink>[1];
type WithNode<T> = T & { node?: unknown };

/** A leading `# Title` usually repeats the app's name, which the page already shows. */
export function stripLeadingTitle(markdown: string) {
  return markdown.replace(/^\s*#\s+[^\n]*\n?/, "");
}

const heading = (Tag: "h1" | "h2" | "h3" | "h4") => {
  function Heading({ children, ...props }: WithNode<ComponentProps<"h1">>) {
    delete props.node;
    return <Tag {...props} id={slugify(textOf(children))} className="scroll-mt-32">{children}</Tag>;
  }
  return Heading;
};

/** Fenced code becomes the same copyable block as on the installation tab. */
function Pre({ children }: WithNode<ComponentProps<"pre">>) {
  const code = Children.toArray(children).find(isValidElement) as ReactElement<{ className?: string; children?: ReactNode }> | undefined;
  const text = textOf(code?.props.children ?? children).replace(/\n$/, "");
  const language = code?.props.className?.match(/language-([\w+-]+)/)?.[1];
  return (
    <div className="not-prose my-5">
      <CodeBlock code={text} label={language ? `${language}-Code` : "Code"} filename={language || "Code"} language={language} />
    </div>
  );
}

// ── Notes: GitHub's `> [!NOTE]` and the `> **Info**` pattern ──

const NOTE_KINDS: { match: RegExp; tone: AlertTone; title: string }[] = [
  { match: /^(note|info|information|hinweis)$/i, tone: "info", title: "Hinweis" },
  { match: /^(tip|tipp)$/i, tone: "success", title: "Tipp" },
  { match: /^(important|wichtig)$/i, tone: "info", title: "Wichtig" },
  { match: /^(warning|warnung|achtung)$/i, tone: "warning", title: "Warnung" },
  { match: /^(caution|danger|vorsicht|gefahr)$/i, tone: "destructive", title: "Vorsicht" },
];
const noteKind = (word: string) => NOTE_KINDS.find((kind) => kind.match.test(word.trim().replace(/:$/, "")));

type ElementWithChildren = ReactElement<{ children?: ReactNode }>;

function Blockquote({ children, ...props }: WithNode<ComponentProps<"blockquote">>) {
  delete props.node;
  const parts = Children.toArray(children).filter((child) => !(typeof child === "string" && !child.trim()));
  const first = parts[0];

  if (isValidElement(first) && first.type === "p") {
    const paragraph = first as ElementWithChildren;
    const inner = Children.toArray(paragraph.props.children);
    const head = inner[0];

    // `> [!NOTE]` followed by the text, in the same paragraph or after it.
    if (typeof head === "string") {
      const marker = head.match(/^\s*\[!(\w+)\]\s*/);
      const kind = marker && noteKind(marker[1]);
      if (marker && kind) {
        const restOfParagraph = [head.slice(marker[0].length), ...inner.slice(1)].filter((child) => !(typeof child === "string" && !child.trim()));
        const body = [restOfParagraph.length ? <p key="lead">{restOfParagraph}</p> : null, ...parts.slice(1)];
        return <Note tone={kind.tone} title={kind.title}>{body}</Note>;
      }
    }

    // `> **Info**` (or `> *Info*`) on its own line, then the content.
    if (inner.length === 1 && isValidElement(head) && (head.type === "strong" || head.type === "em")) {
      const label = textOf((head as ElementWithChildren).props.children);
      const kind = noteKind(label);
      if (kind) return <Note tone={kind.tone} title={label.replace(/:$/, "")}>{parts.slice(1)}</Note>;
    }
  }

  return <blockquote {...props}>{children}</blockquote>;
}

function Note({ tone, title, children }: { tone: AlertTone; title: string; children: ReactNode }) {
  return (
    <Alert variant="plain" tone={tone} className="not-prose my-5">
      <Alert.Icon />
      <Alert.Title>{title}</Alert.Title>
      <Alert.Description>
        <div className="flex flex-col gap-2 [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5">{children}</div>
      </Alert.Description>
    </Alert>
  );
}

/** Renderers for app documentation: anchored headings, copyable code, notes as alerts, repository-relative links. */
export function docComponents(repository: MarkdownRepository): Components {
  return {
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    h4: heading("h4"),
    pre: Pre,
    blockquote: Blockquote,
    // Wide tables scroll inside the column instead of pushing the page wider.
    table: ({ node: _node, ...props }) => {
      void _node;
      return (
        <div className="overflow-x-auto">
          <table {...props} className="my-0" />
        </div>
      );
    },
    // Relative images load from the repository the docs came from.
    img: ({ node: _node, src, alt, ...props }) => {
      void _node;
      const resolved = typeof src === "string" ? resolveRepositoryMarkdownImage(src, repository) : undefined;
      // eslint-disable-next-line @next/next/no-img-element
      return <img {...props} src={resolved} alt={alt ?? ""} loading="lazy" className="h-auto max-w-full rounded-lg" />;
    },
    a: ({ href, children, node: _node, ...props }) => {
      void _node;
      const resolved = resolveRepositoryMarkdownLink(href, repository);
      const external = resolved !== href;
      return (
        <a {...props} href={resolved} target={external ? "_blank" : props.target} rel={external ? "noreferrer noopener" : props.rel}>
          {children}
        </a>
      );
    },
  };
}
