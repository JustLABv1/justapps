"use client";

import { Button } from "@/components/panelui/button";
import { Tooltip } from "@/components/panelui/tooltip";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

const ALIASES: Record<string, string> = { sh: "bash", shell: "bash", console: "bash", zsh: "bash", yml: "yaml", js: "javascript", ts: "typescript", dockerfile: "docker" };

/** Highlights code with Shiki in both themes; the colours switch through CSS variables. Plain text until it has loaded. */
function useHighlighted(code: string, language?: string) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    if (!language) return;
    let active = true;
    const lang = ALIASES[language.toLowerCase()] ?? language.toLowerCase();
    import("shiki")
      .then(({ codeToHtml }) => codeToHtml(code, { lang, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false }))
      .then((result) => active && setHtml(result))
      .catch(() => active && setHtml(null));
    return () => {
      active = false;
    };
  }, [code, language]);
  return language ? html : null;
}

/** A command or file, with a copy button that says when it has copied. */
export function CodeBlock({ code, label, filename, language }: { code: string; label: string; filename?: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const highlighted = useHighlighted(code, language);
  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/40">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{filename || label}</span>
        <Tooltip>
          <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`${label} kopieren`} onClick={copy} />}>
            {copied ? <Check className="text-success" /> : <Copy />}
          </Tooltip.Trigger>
          <Tooltip.Content>{copied ? "Kopiert" : "Kopieren"}</Tooltip.Content>
        </Tooltip>
      </div>
      {highlighted ? (
        <div
          className="code-highlight max-h-[28rem] overflow-auto font-mono text-[0.8125rem] leading-relaxed [&_pre]:w-max [&_pre]:min-w-full [&_pre]:p-4"
          // Shiki escapes the code it is given; the markup is its own.
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className="max-h-[28rem] overflow-auto p-4 font-mono text-[0.8125rem] leading-relaxed">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
