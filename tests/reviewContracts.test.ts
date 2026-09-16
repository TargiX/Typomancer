import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const loadServiceWorker = (response: Response) => {
  const handlers = new Map<string, (event: any) => void>();
  let cacheWrites = 0;

  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: {
      location: { origin: 'https://typomancer.xyz' },
      clients: { claim: async () => undefined },
      skipWaiting: async () => undefined,
      addEventListener: (type: string, handler: (event: any) => void) => handlers.set(type, handler)
    },
    caches: {
      keys: async () => [],
      delete: async () => true,
      match: async () => undefined,
      open: async () => ({
        addAll: async () => undefined,
        put: async () => { cacheWrites += 1; }
      })
    },
    fetch: async () => response,
    console,
    Promise,
    Request,
    Response,
    URL
  });

  return {
    fetchHandler: handlers.get('fetch')!,
    getCacheWrites: () => cacheWrites
  };
};

const dispatchFetch = async (fetchHandler: (event: any) => void, request: Request | Record<string, unknown>) => {
  let responsePromise: Promise<Response> | null = null;
  const lifetimePromises: Promise<unknown>[] = [];
  fetchHandler({
    request,
    respondWith: (value: Promise<Response> | Response) => { responsePromise = Promise.resolve(value); },
    waitUntil: (value: Promise<unknown>) => { lifetimePromises.push(Promise.resolve(value)); }
  });
  if (responsePromise) await responsePromise;
  await Promise.all(lifetimePromises);
  return responsePromise;
};

test('service worker leaves authorized requests to the browser', async () => {
  const { fetchHandler } = loadServiceWorker(new Response('private'));
  const request = new Request('https://typomancer.xyz/private', {
    headers: { Authorization: 'Bearer secret' }
  });

  const response = await dispatchFetch(fetchHandler, request);
  assert.equal(response, null);
});

test('service worker never caches no-store navigation or asset responses', async () => {
  for (const mode of ['navigate', 'same-origin']) {
    const response = new Response('private', {
      headers: { 'Cache-Control': 'private, no-store' }
    });
    const { fetchHandler, getCacheWrites } = loadServiceWorker(response);
    await dispatchFetch(fetchHandler, {
      method: 'GET',
      mode,
      url: 'https://typomancer.xyz/private',
      headers: new Headers()
    });
    assert.equal(getCacheWrites(), 0, `${mode} response was cached`);
  }
});

test('system beacon declares complete reduced-motion rendering', () => {
  const component = readFileSync('components/SystemBeacon.tsx', 'utf8');
  const styles = readFileSync('index.html', 'utf8');

  assert.match(component, /animate-ping[^"\n]*motion-reduce:animate-none/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.scope-scroll,[\s\S]*?\.beacon-scan,[\s\S]*?\.beacon-flicker[\s\S]*?animation:\s*none/);
});
