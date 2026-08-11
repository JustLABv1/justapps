import defaultMdxComponents from "fumadocs-ui/mdx";
import DynamicLink from "fumadocs-core/dynamic-link";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

const documentationPrefixes = ["/admin", "/app-creators", "/reference"];

function isDocumentationPath(href: string) {
  return (
    href === "/" ||
    documentationPrefixes.some(
      (prefix) => href === prefix || href.startsWith(`${prefix}/`),
    )
  );
}

function LocaleAwareLink({
  href,
  ...props
}: ComponentProps<"a">): React.ReactElement {
  if (!href || !isDocumentationPath(href)) {
    const Link = defaultMdxComponents.a;
    return <Link href={href} {...props} />;
  }

  const target = href === "/" ? "/[lang]" : `/[lang]${href}`;
  return <DynamicLink href={target} {...props} />;
}

export function getMDXComponents(components?: MDXComponents, locale?: string) {
  return {
    ...defaultMdxComponents,
    ...(locale ? { a: LocaleAwareLink } : {}),
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
