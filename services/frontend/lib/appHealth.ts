export const appHealthIssueLabels: Record<string, string> = {
  'link-probe-down': 'Live-Link nicht erreichbar',
  'link-probe-partial': 'Live-Links teilweise fehlerhaft',
  'repository-sync-error': 'Repository-Sync fehlgeschlagen',
  'repository-sync-pending': 'Sync wartet auf Freigabe',
  'no-owner': 'Keine verantwortliche Person',
  'stale-catalog-entry': 'Seit über 90 Tagen unverändert',
  'missing-documentation': 'Keine Dokumentation hinterlegt',
};

export const appHealthIssueDescriptions: Record<string, string> = {
  'link-probe-down': 'Der Live-Link antwortet nicht. Prüfen Sie URL und Verfügbarkeit der App.',
  'link-probe-partial': 'Mindestens einer der hinterlegten Links ist nicht erreichbar.',
  'repository-sync-error': 'Die letzte Repository-Synchronisierung ist fehlgeschlagen. Prüfen Sie Zugang und Sync-Einstellungen.',
  'repository-sync-pending': 'Die Synchronisierung wartet auf eine Freigabe.',
  'no-owner': 'Weisen Sie der App eine verantwortliche Person zu.',
  'stale-catalog-entry': 'Die App wurde länger als 90 Tage nicht im Katalog gepflegt.',
  'missing-documentation': 'Hinterlegen Sie Markdown-Inhalte oder eine Dokumentations-URL.',
};

export function getAppHealthIssueLabel(issue: string) {
  return appHealthIssueLabels[issue] || issue;
}

export function getAppHealthIssueDescription(issue: string) {
  return appHealthIssueDescriptions[issue] || 'Für diesen Hinweis sind weitere Informationen verfügbar.';
}

export function getAppHealthIssueColor(issue: string): 'warning' | 'danger' {
  return issue.includes('down') || issue.includes('error') ? 'danger' : 'warning';
}
