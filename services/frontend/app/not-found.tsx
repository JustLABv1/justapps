import NextLink from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-8xl font-black text-foreground/10 select-none leading-none">404</span>
        <h1 className="text-2xl font-bold text-foreground">Seite nicht gefunden</h1>
        <p className="text-sm text-muted max-w-sm">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <NextLink
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold shadow-sm hover:bg-accent/90 transition-colors"
        >
          Zur Startseite
        </NextLink>
        <NextLink
          href="/verwaltung"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-surface text-sm font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
        >
          Verwaltung
        </NextLink>
      </div>
    </div>
  );
}
