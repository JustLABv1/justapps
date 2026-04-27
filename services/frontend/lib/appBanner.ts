import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import type React from 'react';

export type AppBannerType = 'info' | 'warning' | 'danger' | 'custom';

export interface AppBannerMeta {
  label: string;
  Icon: React.ElementType;
  /** Tailwind background class (preset only) */
  bg: string;
  /** Tailwind border class (preset only) */
  border: string;
  /** Tailwind text class (preset only) */
  text: string;
  /** Inline style for custom color banners; undefined for presets */
  customStyle?: React.CSSProperties;
}

const PRESET: Record<Exclude<AppBannerType, 'custom'>, Omit<AppBannerMeta, 'label'>> = {
  info: {
    Icon: Info,
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
  },
  warning: {
    Icon: AlertTriangle,
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning',
  },
  danger: {
    Icon: ShieldAlert,
    bg: 'bg-danger/10',
    border: 'border-danger/30',
    text: 'text-danger',
  },
};

const LABELS: Record<AppBannerType, string> = {
  info: 'Hinweis',
  warning: 'Warnung',
  danger: 'Kritisch',
  custom: 'Information',
};

/**
 * Returns display metadata for an app banner.
 * For 'custom' type, pass the hex color string (e.g. '#3b82f6').
 */
export function getAppBannerMeta(
  type: AppBannerType,
  customColor?: string,
): AppBannerMeta {
  const label = LABELS[type];

  if (type === 'custom') {
    const color = customColor || '#6366f1';
    return {
      label,
      Icon: Info,
      bg: '',
      border: '',
      text: '',
      customStyle: {
        backgroundColor: `${color}1a`, // ~10 % opacity
        borderColor: `${color}4d`,     // ~30 % opacity
        color,
      },
    };
  }

  return { label, ...PRESET[type] };
}
