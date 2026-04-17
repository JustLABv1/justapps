'use client';

import { resolveAssetUrl } from '@/lib/assets';
import Image from "next/image";
import { useSettings } from '../context/SettingsContext';
import JustLABLogo from '../public/justlab_logo_compact.png';

const defaultFooterLinks = [
  { label: 'Impressum',       url: '#' },
  { label: 'Datenschutz',     url: '#' },
  { label: 'Barrierefreiheit',url: '#' },
];

export function Footer() {
  const { settings } = useSettings();

  const storeName = settings.storeName || 'JustApps';
  const footerText = settings.footerText || 'Die Plattform für moderne, souveräne Software-Lösungen für die öffentliche Verwaltung in Deutschland.';
  const logoSrc = settings.logoUrl || null;
  const resolvedLogoSrc = resolveAssetUrl(logoSrc);
  const links = settings.footerLinks && settings.footerLinks.length > 0
    ? settings.footerLinks
    : defaultFooterLinks;

  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-3">
            <div className="flex flex-cols mb-3 gap-2 items-center">
              {resolvedLogoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolvedLogoSrc} alt={`${storeName} Logo`} width={24} height={24} className="rounded-sm object-contain" style={{ maxHeight: 24 }} />
              ) : (
                <Image src={JustLABLogo} alt="Logo" width={24} height={24} className="rounded-sm" />
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
        <div className="border-t border-border/50 pt-6 flex items-center justify-between">
          <span className="text-[11px] text-muted/50">
            © {new Date().getFullYear()} JustLAB. Alle Rechte vorbehalten.
          </span>
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
