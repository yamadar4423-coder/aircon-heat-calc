/* 現場エアコン熱量メーター — オフライン用サービスワーカー
   index.html を変更したら VERSION を上げること（古いキャッシュが破棄され、更新が届きます）。 */
const VERSION = "v2";
const SHELL = "shell-" + VERSION;
const FONTS = "fonts-" + VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Google Fonts はネットワーク優先＋キャッシュ更新（初回以降はオフラインでも本来の書体で出ます） */
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then((c) =>
        fetch(req).then((res) => {
          if (res.ok) c.put(req, res.clone());
          return res;
        }).catch(() => c.match(req))
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;

  /* ページ本体：ネットワーク優先（更新をすぐ反映）、圏外ならキャッシュ */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  /* その他の同一オリジン資産：キャッシュ優先 */
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
