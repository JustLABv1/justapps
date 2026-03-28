import { NextRequest, NextResponse } from 'next/server';

interface CacheEntry {
  ok: boolean;
  status: number;
  latency: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60_000; // 60 seconds
const PROBE_TIMEOUT = 5_000; // 5 seconds

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 });
  }

  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ok: cached.ok, status: cached.status, latency: cached.latency });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    const latency = Date.now() - start;
    // Treat any non-5xx response as "up" — a 401/403 means the server is alive
    const ok = response.status < 500;
    const entry: CacheEntry = { ok, status: response.status, latency, expiresAt: Date.now() + CACHE_TTL };
    cache.set(url, entry);
    return NextResponse.json({ ok, status: response.status, latency });
  } catch (err) {
    const latency = Date.now() - start;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const status = isAbort ? 0 : -1;
    const entry: CacheEntry = { ok: false, status, latency, expiresAt: Date.now() + CACHE_TTL };
    cache.set(url, entry);
    return NextResponse.json({ ok: false, status, latency });
  } finally {
    clearTimeout(timeout);
  }
}
