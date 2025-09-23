# YAN'Z SMART WOOD

## Descripción General

Este es el repositorio del sitio web oficial de **YAN'Z SMART WOOD**, una empresa con sede en Quito, Ecuador, que se especializa en el diseño y fabricación de muebles a medida, venta de materiales de ferretería y el desarrollo de soluciones digitales como páginas web.

El sitio web está diseñado para ser una vitrina de los productos y servicios de la empresa, así como una plataforma interactiva para los clientes, que incluye un cotizador virtual, testimonios y una zona de juegos.

## Tecnologías Utilizadas

*   **HTML5:** Para la estructura y el contenido de las páginas.
*   **CSS3:** Para los estilos personalizados y el diseño visual.
*   **TailwindCSS:** Un framework de CSS para un desarrollo rápido y responsivo.
*   **JavaScript:** Para la interactividad, la lógica del carrito de compras, los juegos y la comunicación con Firebase.
*   **Firebase:** Utilizado para la autenticación de usuarios y la base de datos de la pizarra de experiencias.
*   **Swiper.js:** Para las galerías de imágenes y sliders.

## Estructura del Proyecto

El repositorio está organizado de la siguiente manera para mantener el código limpio y escalable:

```
/
├── index.html                # Página de inicio principal.
├── info/                     # Contiene páginas informativas.
│   ├── como-trabajamos.html
│   ├── privacidad.html
│   └── terminos.html
├── css/
│   └── style.css             # Hoja de estilos principal.
├── js/
│   └── main.js               # Lógica principal de JavaScript (menú, carrito, etc.).
├── assets/
│   ├── images/               # Contiene todas las imágenes, organizadas por categoría.
│   └── videos/               # Contiene todos los videos de fondo y de productos.
├── [carpetas_de_productos]/  # Cada producto principal tiene su propia carpeta.
│   ├── cocinas/
│   ├── closets/
│   ├── puertas/
│   └── ... (etc.)
│       └── index.html        # Página detallada de la categoría.
├── [carpetas_de_servicios]/  # Cada servicio principal tiene su propia carpeta.
│   ├── renovacion/
│   └── ia-consulting/
│       └── index.html        # Página detallada del servicio.
├── caja/
│   └── index.html            # Página de checkout con el asistente virtual Aria.
├── juegos/
│   ├── index.html            # Hub principal de la zona de juegos.
│   └── construye-tu-casa/    # Ejemplo de un juego individual.
│       └── index.html
└── ... (otros archivos de configuración como manifest.json, service-worker.js)
```

### Descripción de Carpetas Clave

*   **`/` (raíz):** Contiene la página de inicio (`index.html`) y los archivos de configuración principales.
*   **`/info`:** Almacena páginas estáticas con información legal y de la empresa, como la política de privacidad y los términos de servicio.
*   **`/assets`:** Contiene todos los recursos estáticos como imágenes y videos, organizados en subcarpetas.
*   **`/css` y `/js`:** Contienen los archivos globales de estilos y scripts.
*   **Carpetas de Categorías (e.g., `/cocinas`, `/closets`):** Cada una representa una sección principal de productos o servicios y contiene su propia página `index.html` y, en algunos casos, assets específicos. Esto permite que cada sección sea modular.

## Características Principales

*   **Catálogo de Productos y Servicios:** Secciones dinámicas en la página de inicio que muestran las diferentes ofertas de la empresa.
*   **Páginas de Detalle:** Cada producto o servicio tiene su propia página con una galería de imágenes, descripción detallada y materiales.
*   **Carrito de Cotización:** Los usuarios pueden añadir productos a un carrito para solicitar una cotización.
*   **Asistente de Checkout (Aria):** Una interfaz de chat en la página `/caja` que guía al usuario para finalizar su pedido.
*   **Pizarra de Experiencias:** Una sección donde los clientes pueden dejar sus testimonios.
*   **Zona de Juegos:** Un hub de minijuegos para recompensar la fidelidad de los clientes.
*   **Autenticación de Usuarios:** Integración con Firebase para el inicio de sesión con Google, Facebook y Apple.
*   **Tema Oscuro/Claro:** El sitio tiene un selector de tema para mejorar la experiencia del usuario.

## Cómo Ver el Sitio Localmente

1.  Clona este repositorio en tu máquina local.
2.  Abre el archivo `index.html` en tu navegador web.

No se requiere un servidor local para la mayoría de las funcionalidades, pero algunas características que dependen de Firebase (como la autenticación) pueden no funcionar correctamente si se abren directamente desde el sistema de archivos (`file:///...`).
