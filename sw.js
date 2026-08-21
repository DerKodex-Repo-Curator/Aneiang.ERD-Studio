/* ================================================================
   Aneiang ERD Studio · Service Worker
   策略：缓存优先 + 后台刷新（stale-while-revalidate）
   - 首次访问缓存应用壳（index.html / manifest / 图标等）
   - 后续同源 GET 优先读缓存，同时后台拉取更新缓存 → 离线可用、在线及时更新
   发布时若资源文件名变更，只需提升 CACHE 版本号强制刷新
   ================================================================ */
const CACHE = 'erd-studio-v2';
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }).then(clients => clients.forEach(c => c.postMessage({ type: 'sw:updated' }))))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  /* 页面导航：网络优先，离线回退缓存 —— 保证应用更新即时生效 */
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match('./') || caches.match('./index.html'))
        )
    );
    return;
  }

  /* 静态资源：缓存优先 + 后台刷新（stale-while-revalidate） */
  e.respondWith(
    caches.match(req).then(hit => {
      const update = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || update;
    })
  );
});
