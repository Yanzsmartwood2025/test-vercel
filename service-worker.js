// service-worker.js (Versión segura)

// Este service worker permite que la aplicación sea instalable,
// pero no interfiere con las peticiones de red para evitar que se trabe.

self.addEventListener('install', event => {
  console.log('Service Worker: Instalado y listo.');
  // Con esta versión, no guardamos nada en caché durante la instalación
  // para asegurar que siempre se cargue la versión más reciente de la red.
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activado.');
});

// Hemos eliminado por completo el evento 'fetch' para garantizar
// que el service worker no bloquee ninguna carga de archivos.
