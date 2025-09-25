# YAN'Z SMART WOOD - Sitio Web Oficial

Este repositorio contiene el código fuente del sitio web oficial de YAN'Z SMART WOOD, una empresa especializada en diseño y fabricación de muebles a medida, servicios de ferretería, y soluciones digitales como la creación de páginas web y la consultoría en IA.

## Descripción del Proyecto

El sitio web es una aplicación web estática pero dinámica, construida con tecnologías modernas para ofrecer una experiencia de usuario fluida e interactiva. El objetivo principal es mostrar el portafolio de productos y servicios de la empresa, facilitar el contacto con los clientes y proporcionar una plataforma para la cotización y compra de productos de ferretería.

## Tecnologías Utilizadas

-   **Frontend**:
    -   **HTML5**: Para la estructura semántica del contenido.
    -   **Tailwind CSS**: Para un diseño de interfaz de usuario rápido y responsivo.
    -   **CSS3 Personalizado**: (`css/style.css`) para estilos específicos y animaciones complejas.
    -   **JavaScript (ES6+)**: Para la lógica de la aplicación, interactividad, y manipulación del DOM.
-   **Backend (Servicios)**:
    -   **Firebase**: Utilizado para varios servicios en la nube:
        -   **Firebase Authentication**: Para la gestión de inicio de sesión de usuarios (Google, Facebook, Apple).
        -   **Firestore**: Como base de datos NoSQL para almacenar el catálogo de productos de ferretería, categorías, y carritos de compra de los usuarios.
-   **Tipografías**:
    -   **Google Fonts**: `Poppins` para el texto general y `Roboto Slab` para los encabezados.

## Características Principales

-   **Diseño Responsivo**: La interfaz se adapta a cualquier tamaño de pantalla, desde dispositivos móviles hasta ordenadores de escritorio.
-   **Modo Oscuro/Claro**: Los usuarios pueden cambiar entre un tema claro y oscuro para una mejor experiencia visual.
-   **Autenticación de Usuarios**: Sistema de inicio de sesión seguro a través de Firebase, con avatares y anillos de perfil premium según el proveedor (Google, Facebook, Apple).
-   **Catálogo de Productos y Servicios Dinámico**: Las secciones de productos y servicios en la página principal se generan dinámicamente desde el código JavaScript.
-   **Carrito de Compras Persistente**:
    -   Para **usuarios no registrados**, el carrito se guarda en el `localStorage` del navegador.
    -   Para **usuarios registrados**, el carrito se sincroniza y guarda en Firestore, permitiendo una experiencia consistente entre dispositivos.
-   **Overlays de Video Interactivos**: La sección "Un Checkout Inteligente" cuenta con overlays animados sobre un video, mostrando un carrusel de iconos y un perfil de usuario dinámico.
-   **Carga Diferida (Lazy Loading)**: Las imágenes y videos se cargan de forma diferida a medida que el usuario se desplaza, optimizando el rendimiento inicial de la página.

## Estructura de Archivos

```
/
├── css/
│   └── style.css           # Hoja de estilos personalizada para animaciones y diseños complejos.
├── js/
│   └── main.js             # El motor principal de la aplicación. Gestiona la lógica del carrito, autenticación, renderizado de UI, y más.
├── assets/
│   ├── images/             # Contiene todas las imágenes, organizadas por categorías.
│   └── videos/             # Contiene los videos utilizados en el sitio.
├── [carpetas de productos]/  # (ej. cocinas/, closets/, etc.) Subsecciones de la página.
├── firebase-init.js      # Script de inicialización de Firebase.
├── index.html            # La página principal de la aplicación.
└── README.md             # Este archivo.
```

## Funcionalidad de los Componentes Clave

-   **`js/main.js`**: Este es el cerebro de la aplicación.
    -   **Gestión del Carrito**: Maneja la lógica para añadir, aumentar, y disminuir productos en el carrito, tanto para usuarios invitados como registrados.
    -   **Autenticación**: Gestiona el estado de la sesión del usuario, actualizando la UI en consecuencia.
    -   **Renderizado de UI**: Dibuja dinámicamente componentes como el catálogo de productos, el carrito de compras, y los modales.
    -   **Lógica de Overlays**: Controla el posicionamiento y el contenido de los overlays del monitor y el iPad en la sección de "Caja".
-   **`css/style.css`**:
    -   Define las variables de color para los temas claro y oscuro.
    -   Contiene los estilos para los anillos de avatar premium, las animaciones de los modales, y los diseños de los overlays de video.
-   **`index.html`**:
    -   Es el punto de entrada principal. Carga todas las dependencias necesarias (Tailwind, Firebase, CSS, y JS).
    -   Define la estructura HTML base sobre la cual JavaScript construye los componentes dinámicos.

---

Este proyecto es un ejemplo de cómo combinar tecnologías web estáticas con servicios en la nube para crear una experiencia de usuario rica y funcional. Para cualquier consulta, no dude en contactar a YAN'Z SMART WOOD.