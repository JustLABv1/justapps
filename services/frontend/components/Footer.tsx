'use client';

import { Badge } from '@/components/panelui/badge';
import { resolveAssetUrl } from '@/lib/assets';
import { ArrowUpRight, BookOpen, Code2, Layers, Layers2, Lightbulb, MessageCircleQuestion, Newspaper } from 'lucide-react';
import { useTheme } from 'next-themes';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { useSettings } from '../context/SettingsContext';
import { JustAppsLogo } from './JustAppsLogo';
import { ThemeSwitcher } from './ThemeSwitcher';

const defaultFooterLinks = [
  { label: 'Impressum', url: '#' },
  { label: 'Datenschutz', url: '#' },
  { label: 'Barrierefreiheit', url: '#' },
];

const isExternal = (url: string) => /^https?:\/\//.test(url);

const linkClass =
  'group/link inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

function FooterLink({ href, icon, children }: { href: string; icon?: ReactNode; children: ReactNode }) {
  const inner = (
    <>
      {icon && <span className="text-muted-foreground/70 transition-colors group-hover/link:text-primary [&_svg]:size-4">{icon}</span>}
      {children}
    </>
  );
  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {inner}
        <ArrowUpRight aria-hidden="true" className="size-3.5 opacity-0 transition-opacity group-hover/link:opacity-60" />
        <span className="sr-only">(öffnet in neuem Tab)</span>
      </a>
    );
  }
  if (href.startsWith('/')) {
    return <NextLink href={href} className={linkClass}>{inner}</NextLink>;
  }
  return <a href={href} className={linkClass}>{inner}</a>;
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-xs font-medium tracking-wide text-foreground uppercase">{title}</h2>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </nav>
  );
}

export function Footer({ className = '', contentClassName = '' }: { className?: string; contentClassName?: string }) {
  const { settings } = useSettings();
  const { resolvedTheme } = useTheme();

  const storeName = settings.storeName || 'JustApps';
  const footerText = settings.footerText
    || 'Die Plattform für moderne, souveräne Software-Lösungen für die öffentliche Verwaltung in Deutschland.';
  const logoSrc = resolvedTheme === 'dark'
    ? settings.logoDarkUrl || settings.logoUrl || null
    : settings.logoUrl || null;
  const resolvedLogoSrc = resolveAssetUrl(logoSrc);
  const legalLinks = settings.footerLinks && settings.footerLinks.length > 0
    ? settings.footerLinks
    : defaultFooterLinks;
  const version = process.env.NEXT_PUBLIC_APP_VERSION;

  return (
    <footer className={`mt-auto w-full px-4 pt-12 pb-4 sm:px-6 lg:px-8 ${className}`.trim()}>
      <div
        className={`mx-auto max-w-7xl rounded-2xl bg-card ring-1 ring-foreground/[0.07] dark:ring-foreground/10 ${contentClassName}`.trim()}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 p-6 sm:p-8 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="col-span-2 flex flex-col gap-4 md:col-span-1">
            <NextLink
              href="/"
              className="flex w-fit items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {resolvedLogoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolvedLogoSrc} alt="" width={28} height={28} className="size-7 rounded-md object-contain" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                  <JustAppsLogo className="size-6" />
                </span>
              )}
              <span className="text-base font-semibold tracking-tight">{storeName}</span>
            </NextLink>
            <p className="max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground">{footerText}</p>
          </div>

          <Column title="Entdecken">
            <li><FooterLink href="/" icon={<Layers />}>Alle Apps</FooterLink></li>
            <li><FooterLink href="/gruppen" icon={<Layers2 />}>Gruppen</FooterLink></li>
            <li><FooterLink href="/neuigkeiten" icon={<Newspaper />}>Wochenrückblick</FooterLink></li>
            <li><FooterLink href="/bedarf" icon={<Lightbulb />}>Bedarfsmeldungen</FooterLink></li>
            {settings.faqEnabled && (
              <li><FooterLink href="/faq" icon={<MessageCircleQuestion />}>FAQ</FooterLink></li>
            )}
            <li>
              <a href="/docs" target="_blank" rel="noopener noreferrer" className={linkClass}>
                <span className="text-muted-foreground/70 transition-colors group-hover/link:text-primary [&_svg]:size-4"><BookOpen /></span>
                Dokumentation
                <ArrowUpRight aria-hidden="true" className="size-3.5 opacity-0 transition-opacity group-hover/link:opacity-60" />
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
            </li>
          </Column>

          <Column title="Rechtliches">
            {legalLinks.map((link, index) => (
              <li key={`${link.label}-${index}`}>
                <FooterLink href={link.url || '#'}>{link.label}</FooterLink>
              </li>
            ))}
          </Column>
        </div>

        <div className="flex flex-col gap-3 border-t border-foreground/[0.07] px-6 py-4 sm:flex-row sm:items-center sm:px-8 dark:border-foreground/10">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} JustLAB</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/JustLABv1/justapps/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="rounded-sm underline decoration-transparent underline-offset-2 outline-none transition-colors hover:text-foreground hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring"
            >
              GNU AGPL v3.0
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/JustLABv1/justapps"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Code2 className="size-3.5" aria-hidden="true" />
              Quellcode
            </a>
          </div>
          <div className="flex items-center gap-2 sm:ms-auto">
            {version && (
              <Badge variant="outline" size="sm" className="font-mono">v{version}</Badge>
            )}
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
