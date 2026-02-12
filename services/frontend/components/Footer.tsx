export function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="max-w-7xl mx-auto py-12 px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex flex-col no-underline text-bund-black dark:text-bund-gold mb-4">
              <p className="font-bold text-lg leading-none pt-1">PLAIN</p>
              <p className="text-[10px] tracking-widest uppercase">App-Store</p>
            </div>
            <p className="text-sm text-muted max-w-xs">
              Die Plattform für moderne, souveräne Software-Lösungen für die öffentliche Verwaltung in Deutschland.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-4">Ressourcen</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="#" className="hover:text-bund-blue dark:hover:text-bund-gold transition-colors">Dokumentation</a></li>
              <li><a href="#" className="hover:text-bund-blue dark:hover:text-bund-gold transition-colors">API Referenz</a></li>
              <li><a href="#" className="hover:text-bund-blue dark:hover:text-bund-gold transition-colors">Best Practices</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-4">Rechtliches</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="#" className="hover:text-bund-blue dark:hover:text-bund-gold transition-colors">Impressum</a></li>
              <li><a href="#" className="hover:text-bund-blue dark:hover:text-bund-gold transition-colors">Datenschutz</a></li>
              <li><a href="#" className="hover:text-bund-blue dark:hover:text-bund-gold transition-colors">Barrierefreiheit</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} Justin Neubert. Alle Rechte vorbehalten.
          </p>
          <div className="flex gap-4">
             {/* Simple social/link placeholders */}
          </div>
        </div>
      </div>
    </footer>
  );
}
