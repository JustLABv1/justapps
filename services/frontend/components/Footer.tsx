export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex flex-col mb-3">
              <span className="font-bold text-base text-foreground">PLAIN</span>
              <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-muted">App-Store</span>
            </div>
            <p className="text-sm text-muted max-w-sm leading-relaxed">
              Die Plattform für moderne, souveräne Software-Lösungen für die öffentliche Verwaltung in Deutschland.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Ressourcen</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-muted hover:text-accent transition-colors">Dokumentation</a></li>
              <li><a href="#" className="text-muted hover:text-accent transition-colors">API Referenz</a></li>
              <li><a href="#" className="text-muted hover:text-accent transition-colors">Best Practices</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Rechtliches</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-muted hover:text-accent transition-colors">Impressum</a></li>
              <li><a href="#" className="text-muted hover:text-accent transition-colors">Datenschutz</a></li>
              <li><a href="#" className="text-muted hover:text-accent transition-colors">Barrierefreiheit</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-separator flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} Justin Neubert. Alle Rechte vorbehalten.
          </p>
        </div>
      </div>
    </footer>
  );
}
