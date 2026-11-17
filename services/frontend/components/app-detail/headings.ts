import { Children, isValidElement, type ReactNode } from "react";

export interface DocHeading {
  id: string;
  text: string;
  depth: number;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "abschnitt";
}

/** The plain text of rendered markdown children, for a heading's id. */
export function textOf(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) return textOf(child.props.children);
      return "";
    })
    .join("");
}

/** Headings (levels 1–3) of a markdown document, outside code blocks, with inline formatting removed. */
export function extractHeadings(markdown: string): DocHeading[] {
  const headings: { level: number; text: string }[] = [];
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      fence = fence === fenceMatch[1] ? null : fence ?? fenceMatch[1];
      continue;
    }
    if (fence) continue;
    const match = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const text = match[2]
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    if (text) headings.push({ level: match[1].length, text });
  }
  const top = Math.min(...headings.map((heading) => heading.level));
  return headings.map((heading) => ({ id: slugify(heading.text), text: heading.text, depth: heading.level - top }));
}
