// sw.js - Service Worker بسيط للتخزين المؤقت

const CACHE_NAME = 'todo-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  // أيقونات - تأكد أنها موجودة في المسار icons/
  './icons/icon-192.png',
  './icons/icon-512.png',
  // أصوات خارجية: إذا كنت تريد العمل أوفلاين مع الأصوات، قم بوضع ملفات صوت محلية وإضافتها هنا
  // './sounds/button-3.mp3',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(()=> {
          // في حال عدم وجود اتصال، ممكن إرجاع صفحة offline افتراضية لو عندك
          return caches.match('./');
      });
    })
  );
});
