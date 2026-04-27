const STORAGE_KEY = 'recently-viewed-apps';
const MAX_ITEMS = 10;
const CHANGE_EVENT = 'recently-viewed-apps:change';
export const emptyRecentlyViewed: RecentApp[] = [];

let cachedRecentlyViewedRaw: string | null = null;
let cachedRecentlyViewed: RecentApp[] = emptyRecentlyViewed;

export interface RecentApp {
  id: string;
  name: string;
  icon?: string;
  viewedAt: number;
}

export function getRecentlyViewed(): RecentApp[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '[]';
    if (raw === cachedRecentlyViewedRaw) {
      return cachedRecentlyViewed;
    }

    cachedRecentlyViewedRaw = raw;
    cachedRecentlyViewed = JSON.parse(raw) as RecentApp[];
    return cachedRecentlyViewed;
  } catch {
    cachedRecentlyViewedRaw = null;
    cachedRecentlyViewed = emptyRecentlyViewed;
    return cachedRecentlyViewed;
  }
}

function notifyRecentlyViewedChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToRecentlyViewed(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function addRecentlyViewed(app: { id: string; name: string; icon?: string }) {
  if (typeof window === 'undefined') return;
  try {
    const list = getRecentlyViewed().filter((a) => a.id !== app.id);
    list.unshift({ ...app, viewedAt: Date.now() });
    const nextList = list.slice(0, MAX_ITEMS);
    const nextRaw = JSON.stringify(nextList);
    localStorage.setItem(STORAGE_KEY, nextRaw);
    cachedRecentlyViewedRaw = nextRaw;
    cachedRecentlyViewed = nextList;
    notifyRecentlyViewedChange();
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function removeRecentlyViewed(appId: string) {
  if (typeof window === 'undefined') return;
  try {
    const list = getRecentlyViewed().filter((a) => a.id !== appId);
    const nextRaw = JSON.stringify(list);
    localStorage.setItem(STORAGE_KEY, nextRaw);
    cachedRecentlyViewedRaw = nextRaw;
    cachedRecentlyViewed = list;
    notifyRecentlyViewedChange();
  } catch { /* ignore */ }
}
