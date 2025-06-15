// service-worker.js

// Define un nombre y una versión para la caché
const CACHE_NAME = 'yanz-smart-wood-cache-v1';
// Lista de archivos iniciales para guardar en caché
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
  // Puedes añadir aquí tus archivos CSS y JS principales si quieres
  // '/css/style.css',
  // '/js/main.js',
  // Y los logos para la PWA
  // '/assets/images/logo_192.png',
  // '/assets/images/logo_512.png'
];

// Evento 'install': Se dispara cuando el service worker se instala.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalado');
  // Espera a que la promesa de abrir la caché y añadir los archivos se complete.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierta. Guardando archivos iniciales...');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'fetch': Se dispara cada vez que la página pide un recurso (una página, una imagen, etc.)
self.addEventListener('fetch', event => {
  // Responde a la petición
  event.respondWith(
    // Busca el recurso en la caché primero
    caches.match(event.request)
      .then(response => {
        // Si el recurso está en la caché, devuélvelo desde ahí
        if (response) {
          return response;
        }
        // Si no está en la caché, ve a la red a buscarlo
        return fetch(event.request);
      }
    )
  );
});
