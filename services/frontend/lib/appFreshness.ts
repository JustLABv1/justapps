import type { AppConfig } from '@/config/apps';

const UPDATE_GRACE_MS = 1000 * 60 * 60;

export type AppFreshnessKind = 'new' | 'updated' | 'reuse' | 'none';

export interface RelativeTimeMeta {
  label: string;
  isRecent: boolean;
  daysOld: number;
}

export interface AppFreshnessMeta {
  kind: AppFreshnessKind;
  badgeLabel: 'Neu' | 'Aktualisiert' | 'Nachnutzung' | null;
  badgeColor: 'accent' | 'success' | 'warning';
  createdRelative: RelativeTimeMeta | null;
  updatedRelative: RelativeTimeMeta | null;
}

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;

  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getRelativeTimeMeta(dateStr: string | undefined, now = Date.now()): RelativeTimeMeta | null {
  const date = parseDate(dateStr);
  if (!date) return null;

  const diffMs = Math.max(0, now - date.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'Heute', isRecent: true, daysOld: diffDays };
  if (diffDays === 1) return { label: 'Gestern', isRecent: true, daysOld: diffDays };
  if (diffDays < 7) return { label: `vor ${diffDays} Tagen`, isRecent: true, daysOld: diffDays };
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return { label: `vor ${weeks} Woche${weeks > 1 ? 'n' : ''}`, isRecent: false, daysOld: diffDays };
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return { label: `vor ${months} Monat${months > 1 ? 'en' : ''}`, isRecent: false, daysOld: diffDays };
  }

  const years = Math.floor(diffDays / 365);
  return { label: `vor ${years} Jahr${years > 1 ? 'en' : ''}`, isRecent: false, daysOld: diffDays };
}

export function getAppFreshness(
  app: Pick<AppConfig, 'createdAt' | 'updatedAt' | 'isReuse'>,
  now = Date.now(),
): AppFreshnessMeta {
  const createdRelative = getRelativeTimeMeta(app.createdAt, now);
  const updatedRelative = getRelativeTimeMeta(app.updatedAt, now);

  const createdAt = parseDate(app.createdAt);
  const updatedAt = parseDate(app.updatedAt);
  const wasUpdatedAfterCreate = Boolean(
    createdAt && updatedAt && updatedAt.getTime() - createdAt.getTime() > UPDATE_GRACE_MS,
  );

  if (app.isReuse) {
    return {
      kind: 'reuse',
      badgeLabel: 'Nachnutzung',
      badgeColor: 'warning',
      createdRelative,
      updatedRelative,
    };
  }

  if (updatedRelative?.isRecent && (wasUpdatedAfterCreate || !createdAt)) {
    return {
      kind: 'updated',
      badgeLabel: 'Aktualisiert',
      badgeColor: 'accent',
      createdRelative,
      updatedRelative,
    };
  }

  if (createdRelative?.isRecent) {
    return {
      kind: 'new',
      badgeLabel: 'Neu',
      badgeColor: 'success',
      createdRelative,
      updatedRelative,
    };
  }

  return {
    kind: 'none',
    badgeLabel: null,
    badgeColor: 'success',
    createdRelative,
    updatedRelative,
  };
}