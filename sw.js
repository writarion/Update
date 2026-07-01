/* Meetwoyou Service Worker v10 — fast first paint, offline-first reads */
const V = 'mw-v10';
const SHELL = ['./','./index.html','./dashboard.html','./messenger.html','./admin.html','./mw-core.js','./mw-final.js','./mw-upgrades.js','./favicon.svg','./favicon.ico','./favicon-16x16.png','./favicon-32x32.png','./apple-touch-icon.png','./web-app-manifest-192x192.png','./web-app-manifest-512x512.png','./manifest.json','./site.webmanifest'];

self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL).catch(()=>{})));
});
self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==V).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET') return;
  const url = new URL(req.url);

  // Firestore / Auth — network only (live data)
  if(/firestore\.googleapis|identitytoolkit|firebaseinstallations|googleapis\.com\/identitytoolkit/.test(url.host+url.pathname)) return;

  // HTML — network first, fall back to cache (offline)
  if(req.mode === 'navigate' || req.destination==='document'){
    e.respondWith(fetch(req).then(r=>{ const cp=r.clone(); caches.open(V).then(c=>c.put(req,cp)); return r; }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
    return;
  }
  // Images / media (cloudinary, gstatic) — cache-first, stream-while-revalidate
  if(/cloudinary|res\.cloudinary|gstatic|fonts\.gstatic|fonts\.googleapis|cdnjs|chart\.js/.test(url.host+url.pathname) || ['image','font','style','script'].includes(req.destination)){
    e.respondWith(caches.match(req).then(c=>{
      const net = fetch(req).then(r=>{ if(r && r.status===200){ const cp=r.clone(); caches.open(V).then(cc=>cc.put(req,cp)); } return r; }).catch(()=>c);
      return c || net;
    }));
    return;
  }
  // Default — network, fallback cache
  e.respondWith(fetch(req).catch(()=>caches.match(req)));
});

self.addEventListener('message', e=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });
