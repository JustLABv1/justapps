'use client';

import { fetchApi } from '@/lib/api';
import { Button, Input, Modal, Surface, Switch, toast } from '@heroui/react';
import { Archive, Download, Loader2, ShieldAlert, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

type BackupMode = 'safe' | 'full';
type RestoreMode = 'merge' | 'replace';

type SectionOption = {
	id: string;
	label: string;
	description: string;
	sensitive?: boolean;
};

type ImportStats = {
	created: number;
	updated: number;
	skipped: number;
};

type ImportResult = {
	message: string;
	restoreMode: RestoreMode;
	appliedSections: string[];
	warnings?: string[];
	stats: Record<string, ImportStats>;
};

type PendingExportAction = {
	mode: BackupMode;
	presetId: string;
	sections: string[];
};

const sectionOptions: SectionOption[] = [
	{ id: 'apps', label: 'Apps', description: 'App-Stammdaten, Inhalte und Metadaten.' },
	{ id: 'appGroups', label: 'Gruppen', description: 'Gruppen-Metadaten und Mitgliedschaften.' },
	{ id: 'appRelations', label: 'Relationen', description: 'Verwandte Apps und bidirektionale Verknüpfungen.' },
	{ id: 'users', label: 'Benutzer', description: 'Konten, Rollen und Sperrstatus.', sensitive: true },
	{ id: 'settings', label: 'Einstellungen', description: 'Branding, Detailfelder und Store-Konfiguration.' },
	{ id: 'repositoryProviders', label: 'Repository-Provider', description: 'Persistierte Provider-Einstellungen.' },
	{ id: 'repositoryAppLinks', label: 'Repository-Linkstatus', description: 'App-Verknüpfungen, Snapshots und Sync-Status.' },
	{ id: 'aiProviders', label: 'AI-Provider', description: 'AI-Provider-Einstellungen und verschlüsselte API-Keys.' },
	{ id: 'aiConversations', label: 'AI-Chats', description: 'Chat-Verläufe und zitierte Quellen.', sensitive: true },
	{ id: 'tokens', label: 'Tokens', description: 'API- und Zugriffstoken.', sensitive: true },
	{ id: 'favorites', label: 'Favoriten', description: 'Benutzerfavoriten.' },
	{ id: 'ratings', label: 'Ratings', description: 'Bewertungen und Kommentare.' },
	{ id: 'audit', label: 'Audit', description: 'Audit-Log und Operationen.', sensitive: true },
	{ id: 'assets', label: 'Uploads', description: 'Hochgeladene App-Icons, Logos, Favicons und Gruppen-Icons.' },
];

const sectionPresets = [
  {
    id: 'full-safe',
    title: 'Sicherer Voll-Backup',
		description: 'Exportiert alle aktuell angebundenen Datenbereiche als verschlüsselte Backup-Datei. Passwort-Hashes und Token-Secrets werden entfernt.',
    mode: 'safe' as const,
  },
  {
    id: 'full-fidelity',
    title: 'Voll-Backup mit sensiblen Daten',
		description: 'Enthält zusätzlich Passwort-Hashes und Token-Secrets und wird ebenfalls als verschlüsselte Backup-Datei exportiert.',
    mode: 'full' as const,
  },
  {
    id: 'apps-only',
		title: 'Apps inklusive Uploads exportieren',
		description: 'Kompatibler, verschlüsselter Abschnittsexport für Apps inklusive referenzierter Uploads, ohne Benutzer- oder Systemeinstellungen.',
    mode: 'safe' as const,
		sections: ['apps', 'assets'],
  },
];

const backupPassphraseMinLength = 12;
const allSectionIds = sectionOptions.map((section) => section.id);
const assetDependentSectionIds = ['apps', 'appGroups', 'settings'];

function normalizeSectionSelection(sections: string[]) {
	const uniqueSections = Array.from(new Set(sections));
	const requiresAssets = assetDependentSectionIds.some((sectionId) => uniqueSections.includes(sectionId));
	if (!requiresAssets) {
		return uniqueSections;
	}
	if (uniqueSections.includes('assets')) {
		return uniqueSections;
	}
	return [...uniqueSections, 'assets'];
}

function parseDownloadFilename(headerValue: string | null, fallback: string) {
	if (!headerValue) {
		return fallback;
	}
	const match = headerValue.match(/filename="?([^";]+)"?/i);
	return match?.[1] || fallback;
}

export default function BackupsPage() {
	const [downloadingId, setDownloadingId] = useState<string | null>(null);
	const [isFullMode, setIsFullMode] = useState(false);
	const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
	const [selectedSections, setSelectedSections] = useState<string[]>(allSectionIds);
	const [importing, setImporting] = useState(false);
	const [selectedFileName, setSelectedFileName] = useState<string>('');
	const [importResult, setImportResult] = useState<ImportResult | null>(null);
	const [exportPassphrase, setExportPassphrase] = useState('');
	const [exportPassphraseConfirm, setExportPassphraseConfirm] = useState('');
	const [importPassphrase, setImportPassphrase] = useState('');
	const [pendingExport, setPendingExport] = useState<PendingExportAction | null>(null);
	const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const allSectionsSelected = selectedSections.length === sectionOptions.length;
	const selectedSectionsParam = useMemo(() => selectedSections.join(','), [selectedSections]);
	const replaceBlocked = restoreMode === 'replace' && !allSectionsSelected;
	const exportPassphraseValid = exportPassphrase.length >= backupPassphraseMinLength;
	const exportPassphraseMatches = exportPassphrase === exportPassphraseConfirm;
	const exportReady = exportPassphraseValid && exportPassphraseMatches;
	const exportModalOpen = pendingExport !== null;
	const importModalOpen = pendingImportFile !== null;

	const closeExportModal = () => {
		if (downloadingId) {
			return;
		}
		setPendingExport(null);
		setExportPassphrase('');
		setExportPassphraseConfirm('');
	};

	const closeImportModal = () => {
		if (importing) {
			return;
		}
		setPendingImportFile(null);
		setImportPassphrase('');
	};

	const openExportModal = (mode: BackupMode, presetId: string, sections?: string[]) => {
		setPendingExport({ mode, presetId, sections: sections ?? allSectionIds });
		setExportPassphrase('');
		setExportPassphraseConfirm('');
	};

	const submitExport = async () => {
		if (!pendingExport) {
			return;
		}
		if (!exportReady) {
			toast.warning('Bitte geben Sie eine Backup-Passphrase mit mindestens 12 Zeichen ein und bestätigen Sie diese.');
			return;
		}

		setDownloadingId(pendingExport.presetId);
		try {
			const response = await fetchApi('/admin/backups/export', {
				method: 'POST',
				body: JSON.stringify({
					mode: pendingExport.mode,
					sections: pendingExport.sections,
					passphrase: exportPassphrase,
				}),
			});
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload.detail || payload.error || 'Backup konnte nicht erstellt werden.');
			}

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			const suffix = pendingExport.sections.length === 1 ? pendingExport.sections[0] : pendingExport.sections.length < sectionOptions.length ? 'selected' : 'instance';
			anchor.href = url;
			anchor.download = parseDownloadFilename(response.headers.get('Content-Disposition'), `justapps-backup-${suffix}-${pendingExport.mode}-${new Date().toISOString().split('T')[0]}.jabackup`);
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(url);
			toast.success('Verschlüsseltes Backup wurde heruntergeladen.');
			closeExportModal();
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : 'Backup konnte nicht erstellt werden.');
		} finally {
			setDownloadingId(null);
		}
	};

	const toggleSection = (sectionId: string) => {
		setSelectedSections((current) => normalizeSectionSelection(
			current.includes(sectionId)
				? current.filter((section) => section !== sectionId)
				: [...current, sectionId],
		));
	};

	const selectAllSections = () => {
		setSelectedSections(allSectionIds);
	};

	const clearSections = () => {
		setSelectedSections([]);
	};

	const handleAdvancedExport = () => {
		if (selectedSections.length === 0) {
			toast.warning('Mindestens ein Abschnitt muss ausgewählt sein.');
			return;
		}
		openExportModal(isFullMode ? 'full' : 'safe', 'advanced-export', selectedSections);
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) {
			return;
		}
		setSelectedFileName(file.name);
		if (selectedSections.length === 0) {
			toast.warning('Mindestens ein Abschnitt muss für den Import ausgewählt sein.');
			return;
		}
		if (replaceBlocked) {
			toast.warning('Replace-Import ist aktuell nur mit vollständiger Abschnittsauswahl möglich.');
			return;
		}
		setPendingImportFile(file);
		setImportPassphrase('');
	};

	const submitImport = async () => {
		if (!pendingImportFile) {
			return;
		}

		setImporting(true);
		try {
			const formData = new FormData();
			formData.append('file', pendingImportFile);
			formData.append('restoreMode', restoreMode);
			formData.append('sections', selectedSectionsParam);
			if (importPassphrase) {
				formData.append('passphrase', importPassphrase);
			}

			const response = await fetchApi('/admin/backups/import', {
				method: 'POST',
				body: formData,
			});
			const result = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(result?.detail || result?.error || 'Backup konnte nicht importiert werden.');
			}
			setImportResult(result as ImportResult);
			toast.success('Backup wurde importiert.');
			closeImportModal();
		} catch (error) {
			toast.danger(error instanceof Error ? error.message : 'Backup konnte nicht importiert werden.');
		} finally {
			setImporting(false);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-bold tracking-tight text-foreground">Backups</h1>
				<p className="max-w-3xl text-sm text-muted">
					Der Backup-Bereich exportiert jetzt verschlüsselte Sicherungsdateien mit klar markierten Datenabschnitten.
					 Exporte und Importe laufen über dieselbe Oberfläche, damit vollständige Sicherungen und selektive Wiederherstellungen nicht mehr über einzelne Verwaltungsseiten verteilt sind.
				</p>
			</div>

			<Surface className="border border-warning/25 bg-warning/5 p-5 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
						<ShieldAlert className="h-5 w-5" />
					</div>
					<div className="space-y-2 text-sm text-muted">
						<p className="font-semibold text-foreground">Stand dieser Implementierung</p>
						<p>
							Der Export deckt bereits Apps, Gruppen, Relationen, Benutzer, Einstellungen, Repository-Zustand,
							 Tokens, Favoriten, Ratings, Audit-Daten und hochgeladene Dateien ab.
							 Jede neue Sicherung wird mit einer Backup-Passphrase verschlüsselt; Merge-Importe und vollständige Replace-Restores bleiben verfügbar.
						</p>
						<p>
							 Der sichere Modus entfernt sensible Geheimnisse. Legacy-JSON-Backups können weiter importiert werden, werden dabei aber explizit gewarnt. Replace-Restores bleiben absichtlich auf Vollsicherungen beschränkt.
						</p>
					</div>
				</div>
			</Surface>

			<div className="grid gap-4 lg:grid-cols-3">
				{sectionPresets.map((preset) => {
					const isLoading = downloadingId === preset.id;
					return (
						<Surface key={preset.id} className="flex h-full flex-col gap-4 border border-border/60 p-6 shadow-sm">
							<div className="flex items-center gap-3">
								<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
									<Archive className="h-5 w-5" />
								</div>
								<div>
									<h2 className="text-base font-semibold text-foreground">{preset.title}</h2>
									<p className="text-xs uppercase tracking-[0.2em] text-muted">{preset.mode === 'safe' ? 'Empfohlen' : 'Sensitiv'}</p>
								</div>
							</div>
							<p className="flex-1 text-sm text-muted">{preset.description}</p>
							<Button
								className="gap-2 bg-accent text-white"
								onPress={() => openExportModal(preset.mode, preset.id, preset.sections)}
								isDisabled={Boolean(downloadingId)}
							>
								{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
								Export herunterladen
							</Button>
						</Surface>
					);
				})}
			</div>

			<Surface className="border border-border/60 p-6 shadow-sm">
				<div className="flex flex-col gap-6">
					<div className="flex flex-col gap-2">
						<h2 className="text-lg font-semibold text-foreground">Selektiver Export und Import</h2>
						<p className="max-w-3xl text-sm text-muted">
							Wählen Sie gezielt Abschnitte aus, exportieren Sie nur den benötigten Scope oder spielen Sie eine bestehende Sicherung im Merge- oder Replace-Modus zurück.
						</p>
					</div>

					<div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
						<div className="space-y-4">
							<div className="flex flex-wrap items-center gap-3">
								<Button size="sm" variant="secondary" onPress={selectAllSections}>Alle auswählen</Button>
								<Button size="sm" variant="secondary" onPress={clearSections}>Auswahl leeren</Button>
								<p className="text-xs uppercase tracking-[0.2em] text-muted">
									{selectedSections.length} von {sectionOptions.length} Abschnitten ausgewählt
								</p>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								{sectionOptions.map((section) => {
									const isSelected = selectedSections.includes(section.id);
									return (
										<label
											key={section.id}
											className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
												isSelected ? 'border-accent bg-accent/5' : 'border-border/60 bg-surface-secondary/40 hover:bg-surface-secondary'
											}`}
										>
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleSection(section.id)}
												className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
											/>
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="text-sm font-semibold text-foreground">{section.label}</span>
													{section.sensitive ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-warning">Sensitiv</span> : null}
												</div>
												<p className="text-sm text-muted">{section.description}</p>
											</div>
										</label>
									);
								})}
							</div>
						</div>

						<div className="space-y-4 rounded-3xl border border-border/60 bg-surface-secondary/30 p-5">
							<div className="space-y-2">
								<p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Exportmodus</p>
								<Switch isSelected={isFullMode} onChange={setIsFullMode}>
									<Switch.Control><Switch.Thumb /></Switch.Control>
								</Switch>
								<p className="text-sm text-muted">
									{isFullMode ? 'Vollständiger Modus mit sensiblen Secrets.' : 'Sicherer Modus ohne Passwort-Hashes und Token-Secrets.'}
								</p>
							</div>

							<div className="space-y-2">
								<p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Restoremodus</p>
								<div className="grid grid-cols-2 gap-2">
									<Button
										variant={restoreMode === 'merge' ? 'secondary' : 'ghost'}
										onPress={() => setRestoreMode('merge')}
									>
										Merge
									</Button>
									<Button
										variant={restoreMode === 'replace' ? 'danger' : 'ghost'}
										onPress={() => setRestoreMode('replace')}
									>
										Replace
									</Button>
								</div>
								<p className="text-sm text-muted">
									{restoreMode === 'merge'
										? 'Merge aktualisiert vorhandene Datensätze und ergänzt fehlende Einträge.'
										: 'Replace löscht die aktuelle Instanz und stellt den Backup-Stand vollständig wieder her.'}
								</p>
								{replaceBlocked ? (
									<p className="text-sm font-medium text-warning">
										Replace ist nur mit vollständiger Abschnittsauswahl verfügbar.
									</p>
								) : null}
							</div>

							<div className="flex flex-col gap-3">
								<Button className="gap-2 bg-accent text-white" onPress={handleAdvancedExport} isDisabled={Boolean(downloadingId) || selectedSections.length === 0}>
									{downloadingId === 'advanced-export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
									Auswahl exportieren
								</Button>
								<input ref={fileInputRef} type="file" accept="application/json,.json,.jabackup" className="hidden" onChange={handleImportFile} />
								<Button variant="secondary" className="gap-2" onPress={handleImportClick} isDisabled={importing || selectedSections.length === 0 || replaceBlocked}>
									{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
									Backup importieren
								</Button>
								<p className="text-sm text-muted">
									{selectedFileName ? `Letzte Datei: ${selectedFileName}` : 'Die Passphrase wird nach dem Klick und der Dateiauswahl in einem Modal abgefragt.'}
								</p>
							</div>
						</div>
					</div>
				</div>
			</Surface>

			{importResult ? (
				<Surface className="border border-border/60 p-6 shadow-sm">
					<div className="space-y-4">
						<div>
							<h2 className="text-lg font-semibold text-foreground">Letztes Import-Ergebnis</h2>
							<p className="text-sm text-muted">{importResult.message} · Modus: {importResult.restoreMode}</p>
						</div>
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{Object.entries(importResult.stats).map(([section, stats]) => (
								<div key={section} className="rounded-2xl border border-border/60 bg-surface-secondary/40 p-4">
									<p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">{section}</p>
									<div className="mt-3 grid grid-cols-3 gap-2 text-sm">
										<div>
											<p className="font-semibold text-foreground">{stats.created}</p>
											<p className="text-muted">neu</p>
										</div>
										<div>
											<p className="font-semibold text-foreground">{stats.updated}</p>
											<p className="text-muted">aktualisiert</p>
										</div>
										<div>
											<p className="font-semibold text-foreground">{stats.skipped}</p>
											<p className="text-muted">übersprungen</p>
										</div>
									</div>
								</div>
							))}
						</div>
						{importResult.warnings && importResult.warnings.length > 0 ? (
							<div className="rounded-2xl border border-warning/25 bg-warning/5 p-4 text-sm text-muted">
								<p className="font-semibold text-foreground">Warnungen</p>
								<ul className="mt-3 space-y-2">
									{importResult.warnings.map((warning) => (
										<li key={warning}>{warning}</li>
									))}
								</ul>
							</div>
						) : null}
					</div>
				</Surface>
			) : null}

			<Modal>
				<Modal.Backdrop isOpen={exportModalOpen} onOpenChange={(open) => { if (!open) closeExportModal(); }}>
					<Modal.Container>
						<Modal.Dialog className="sm:max-w-md">
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Icon className="bg-accent/10 text-accent">
									<Download className="h-5 w-5" />
								</Modal.Icon>
								<Modal.Heading>Backup verschlüsseln</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<div className="space-y-5">
									<p className="text-sm text-muted">
										Die ausgewählte Sicherung wird erst nach Eingabe einer Passphrase exportiert. Ohne diese Passphrase kann das Backup später nicht wiederhergestellt werden.
									</p>
									{pendingExport ? (
										<p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
											{pendingExport.sections.length} Abschnitt{pendingExport.sections.length !== 1 ? 'e' : ''} · {pendingExport.mode === 'safe' ? 'Sicherer Modus' : 'Vollmodus'}
										</p>
									) : null}
									<div className="flex flex-col gap-4">
										<div className="space-y-2">
											<p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Passphrase</p>
											<Input
												aria-label="Backup-Passphrase"
												autoComplete="new-password"
												className="w-full"
												onChange={(event) => setExportPassphrase(event.target.value)}
												placeholder="Mindestens 12 Zeichen"
												type="password"
												value={exportPassphrase}
												variant="secondary"
											/>
										</div>
										<div className="space-y-2">
											<p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Passphrase bestätigen</p>
											<Input
												aria-label="Backup-Passphrase bestätigen"
												autoComplete="new-password"
												className="w-full"
												onChange={(event) => setExportPassphraseConfirm(event.target.value)}
												placeholder="Passphrase erneut eingeben"
												type="password"
												value={exportPassphraseConfirm}
												variant="secondary"
											/>
										</div>
									</div>
									<p className={`text-sm ${exportReady ? 'text-success' : 'text-muted'}`}>
										{!exportPassphrase
											? 'Geben Sie eine Passphrase ein, um den Export zu starten.'
											: !exportPassphraseValid
												? 'Die Passphrase muss mindestens 12 Zeichen lang sein.'
												: !exportPassphraseMatches
													? 'Die Bestätigung stimmt noch nicht mit der Passphrase überein.'
													: 'Passphrase bestätigt. Der Export kann jetzt gestartet werden.'}
									</p>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<div className="flex w-full justify-end gap-3">
									<Button variant="secondary" onPress={closeExportModal} isDisabled={Boolean(downloadingId)}>
										Abbrechen
									</Button>
									<Button className="bg-accent text-white" onPress={() => void submitExport()} isDisabled={!exportReady || Boolean(downloadingId)}>
										{downloadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
										Export herunterladen
									</Button>
								</div>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>

			<Modal>
				<Modal.Backdrop isOpen={importModalOpen} onOpenChange={(open) => { if (!open) closeImportModal(); }}>
					<Modal.Container>
						<Modal.Dialog className="sm:max-w-md">
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Icon className="bg-warning/10 text-warning">
									<Upload className="h-5 w-5" />
								</Modal.Icon>
								<Modal.Heading>Backup importieren</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<div className="space-y-5">
									<p className="text-sm text-muted">
										{pendingImportFile ? `Datei: ${pendingImportFile.name}` : 'Nach der Dateiauswahl kann der Import hier gestartet werden.'}
									</p>
									<div className="space-y-2">
										<p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Passphrase</p>
										<Input
											aria-label="Import-Passphrase"
											autoComplete="current-password"
											className="w-full"
											onChange={(event) => setImportPassphrase(event.target.value)}
											placeholder="Nur für verschlüsselte Backups erforderlich"
											type="password"
											value={importPassphrase}
											variant="secondary"
										/>
									</div>
									<p className="text-sm text-muted">
										Für `.jabackup`-Dateien ist die Passphrase erforderlich. Legacy-JSON-Backups können ohne Passphrase importiert werden und erzeugen einen Warnhinweis.
									</p>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<div className="flex w-full justify-end gap-3">
									<Button variant="secondary" onPress={closeImportModal} isDisabled={importing}>
										Abbrechen
									</Button>
									<Button variant="secondary" className="gap-2" onPress={() => void submitImport()} isDisabled={importing || !pendingImportFile}>
										{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
										Backup importieren
									</Button>
								</div>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</div>
	);
}