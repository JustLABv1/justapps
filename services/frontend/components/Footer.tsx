'use client';

import { resolveAssetUrl } from '@/lib/assets';
import { useSettings } from '../context/SettingsContext';
import { JustAppsLogo } from './JustAppsLogo';

const defaultFooterLinks = [
  { label: 'Impressum',       url: '#' },
  { label: 'Datenschutz',     url: '#' },
  { label: 'Barrierefreiheit',url: '#' },
];

export function Footer({ className = '', contentClassName = '' }: { className?: string; contentClassName?: string }) {
  const { settings } = useSettings();

  const storeName = settings.storeName || 'JustApps';
  const footerText = settings.footerText || 'Die Plattform für moderne, souveräne Software-Lösungen für die öffentliche Verwaltung in Deutschland.';
  const logoSrc = settings.logoUrl || null;
  const resolvedLogoSrc = resolveAssetUrl(logoSrc);
  const links = settings.footerLinks && settings.footerLinks.length > 0
    ? settings.footerLinks
    : defaultFooterLinks;

  return (
    <footer className={`border-t border-border bg-surface mt-auto ${className}`.trim()}>
      <div className={`max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 ${contentClassName}`.trim()}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-3">
            <div className="flex flex-cols mb-3 gap-2 items-center">
              {resolvedLogoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolvedLogoSrc} alt={`${storeName} Logo`} width={24} height={24} className="rounded-sm object-contain" style={{ maxHeight: 24 }} />
              ) : (
                <JustAppsLogo className="w-6 h-6" />
              )}
              <span className="text-[9px] font-bold tracking-[0.2em]">{storeName}</span>
            </div>
            <p className="text-sm text-muted max-w-sm leading-relaxed">
              {footerText}
            </p>
          </div>
          <div className="col-span-1 md:col-span-1">
            <h3 className="text-sm font-semibold text-foreground mb-3">Rechtliches</h3>
            <ul className="space-y-2 text-sm">
              {links.map((link, i) => (
                <li key={i}>
                  <a href={link.url || '#'} className="text-muted hover:text-accent transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border/50 pt-6 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted/50">
            <span>© {new Date().getFullYear()} JustLAB</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/JustLABv1/justapps/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-transparent underline-offset-2 transition-colors hover:text-accent hover:decoration-current"
            >
              Lizenziert unter GNU AGPL v3.0
            </a>
          </div>
          {process.env.NEXT_PUBLIC_APP_VERSION && (
            <span className="text-[11px] text-muted/40 font-mono">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
