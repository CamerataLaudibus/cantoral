/* Cantoral Laudibus — copia guardada para abrir sin conexión.
   Siempre busca primero la versión nueva en internet; usa la copia sólo si no hay señal. */
const COPIA = "cantoral-v1";
const BASICOS = ["./", "./manifest.webmanifest", "./icono-192.png", "./favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(COPIA).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== COPIA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Internet primero (con un límite de espera, por si la señal es mala); si falla, la copia guardada
function primeroInternet(req, espera) {
  return new Promise(resolve => {
    let listo = false;
    const deCopia = () => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("./") : undefined));
    const t = setTimeout(() => deCopia().then(r => { if (r && !listo) { listo = true; resolve(r); } }), espera);
    fetch(req).then(r => {
      if (r && r.ok) { const copia = r.clone(); caches.open(COPIA).then(c => c.put(req, copia)); }
      if (!listo) { listo = true; clearTimeout(t); resolve(r); }
    }).catch(() => deCopia().then(r => { if (!listo) { listo = true; clearTimeout(t); resolve(r || Response.error()); } }));
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Las tipografías de Google: copia guardada y se renueva en segundo plano
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(COPIA).then(c => c.match(req).then(g => {
      const red = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(() => g);
      return g || red;
    })));
    return;
  }
  // Los cantos (Google Drive) los maneja la propia página; aquí no se tocan
  if (url.origin !== location.origin) return;
  e.respondWith(primeroInternet(req, 4000));
});
