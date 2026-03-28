const STORAGE_KEY = 'recently-viewed-apps';
const MAX_ITEMS = 10;

export interface RecentApp {
  id: string;
  name: string;
  icon?: string;
  viewedAt: number;
}

export function getRecentlyViewed(): RecentApp[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addRecentlyViewed(app: { id: string; name: string; icon?: string }) {
  if (typeof window === 'undefined') return;
  try {
    const list = getRecentlyViewed().filter((a) => a.id !== app.id);
    list.unshift({ ...app, viewedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function removeRecentlyViewed(appId: string) {
  if (typeof window === 'undefined') return;
  try {
    const list = getRecentlyViewed().filter((a) => a.id !== appId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}
