export type AppStatusColor = 'default' | 'success' | 'accent' | 'warning';

export const DRAFT_STATUS = 'Entwurf';

type AppStatusMeta = {
  color: AppStatusColor;
  isDraft: boolean;
  label: string;
  sortOrder: number;
};

const STATUS_META: Record<string, AppStatusMeta> = {
  entwurf: { label: DRAFT_STATUS, color: 'default', isDraft: true, sortOrder: 0 },
  poc: { label: 'POC', color: 'default', isDraft: false, sortOrder: 1 },
  mvp: { label: 'MVP', color: 'default', isDraft: false, sortOrder: 2 },
  sandbox: { label: 'Sandbox', color: 'warning', isDraft: false, sortOrder: 3 },
  'in erprobung': { label: 'In Erprobung', color: 'accent', isDraft: false, sortOrder: 4 },
  incubating: { label: 'In Erprobung', color: 'accent', isDraft: false, sortOrder: 4 },
  'in inkubation': { label: 'In Erprobung', color: 'accent', isDraft: false, sortOrder: 4 },
  etabliert: { label: 'Etabliert', color: 'success', isDraft: false, sortOrder: 5 },
  graduated: { label: 'Etabliert', color: 'success', isDraft: false, sortOrder: 5 },
  produktiv: { label: 'Etabliert', color: 'success', isDraft: false, sortOrder: 5 },
};

function normalizeStatus(status?: string | null) {
  return status?.trim().toLowerCase() ?? '';
}

export function getAppStatusMeta(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (!normalized) {
    return null;
  }

  const meta = STATUS_META[normalized];
  if (meta) {
    return meta;
  }

  return {
    color: 'default' as const,
    isDraft: false,
    label: status!.trim(),
    sortOrder: 999,
  };
}

export function getAppStatusLabel(status?: string | null) {
  return getAppStatusMeta(status)?.label ?? null;
}

export function isDraftStatus(status?: string | null) {
  return getAppStatusMeta(status)?.isDraft ?? false;
}

export function sortAppStatuses(statuses: string[]) {
  return [...statuses].sort((left, right) => {
    const leftMeta = getAppStatusMeta(left);
    const rightMeta = getAppStatusMeta(right);

    const leftOrder = leftMeta?.sortOrder ?? 999;
    const rightOrder = rightMeta?.sortOrder ?? 999;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return (leftMeta?.label ?? left).localeCompare(rightMeta?.label ?? right, 'de');
  });
}