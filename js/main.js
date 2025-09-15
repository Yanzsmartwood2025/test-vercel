/**
 * =================================================================
 * YAN'Z SMART WOOD - ENGINE v3.0 (con Firestore)
 * =================================================================
 * Este script centralizado gestiona:
 * 1. Inicialización y configuración de Firebase.
 * 2. Autenticación de usuarios (Google).
 * 3. Carrito de compras persistente en Firestore (individual por usuario).
 * 4. Lógica de la interfaz de usuario (UI) para toda la página.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE ---

    // IMPORTANTE: Reemplaza este objeto con la configuración de tu propio proyecto de Firebase.
    const firebaseConfig = {
        apiKey: "AIzaSyC3ENgMXZWAHu7r8l-0z1Iva8CbML_Z26o",
        authDomain: "yan-z-smart-wood.firebaseapp.com",
        projectId: "yan-z-smart-wood",
        storageBucket: "yan-z-smart-wood.appspot.com",
        messagingSenderId: "369287615235",
        appId: "1:369287615235:web:654e1e6fb48b4f634f8f36"
    };

    let app, auth, db;
    let currentUser = null;
    let cartUnsubscribe = null; // Función para detener el listener de Firestore

    try {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("Firebase Engine v3.0 Initialized Successfully.");
    } catch (error) {
        console.error("Fatal Error: Could not initialize Firebase.", error);
        // Si Firebase falla, se muestra un mensaje al usuario.
        document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Error de Conexión</h1><p>No se pudo iniciar la aplicación. Por favor, revisa tu conexión a internet e inténtalo de nuevo más tarde.</p></div>';
        return;
    }

    // --- 2. LÓGICA DEL CARRITO DE COMPRAS (CON FIRESTORE) ---

    let localCart = []; // Carrito local para usuarios no registrados

    // Carga el carrito local desde localStorage (para usuarios invitados)
    const loadLocalCart = () => {
        const storedCart = localStorage.getItem('yanzGuestCart');
        localCart = storedCart ? JSON.parse(storedCart) : [];
        updateCartUI();
    };

    // Guarda el carrito local en localStorage
    const saveLocalCart = () => {
        localStorage.setItem('yanzGuestCart', JSON.stringify(localCart));
        updateCartUI();
    };

    // Función principal para obtener el carrito actual (ya sea de Firestore o local)
    const getCart = () => {
        return currentUser ? window.firestoreCart || [] : localCart;
    };

    // Guarda el carrito en Firestore para el usuario actual
    const saveCartToFirestore = async (cartData) => {
        if (!currentUser) return;
        try {
            const cartRef = db.collection('userCarts').doc(currentUser.uid);
            await cartRef.set({ items: cartData });
        } catch (error) {
            console.error("Error saving cart to Firestore:", error);
        }
    };

    // Función unificada para añadir/actualizar un item en el carrito
    const updateCartItem = (item, quantityChange) => {
        let cart = getCart();
        const existingItemIndex = cart.findIndex(cartItem => cartItem.id === item.id);

        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += quantityChange;
            if (cart[existingItemIndex].quantity <= 0) {
                cart.splice(existingItemIndex, 1); // Elimina si la cantidad es 0 o menos
            }
        } else if (quantityChange > 0) {
            cart.push({ ...item, quantity: quantityChange });
        }

        if (currentUser) {
            saveCartToFirestore(cart);
        } else {
            localCart = cart;
            saveLocalCart();
        }
    };

    // Funciones que se expondrán globalmente para los botones
    window.addItemToCart = (item) => updateCartItem(item, (item.quantity || 1));
    window.increaseQuantity = (itemId) => {
        const item = getCart().find(i => i.id === itemId);
        if (item) updateCartItem(item, 1);
    };
    window.decreaseQuantity = (itemId) => {
        const item = getCart().find(i => i.id === itemId);
        if (item) updateCartItem(item, -1);
    };
    window.removeItemFromCart = (itemId) => {
         const item = getCart().find(i => i.id === itemId);
        if(item) updateCartItem(item, -item.quantity);
    };


    // Actualiza el ícono del carrito en el header
    const updateCartUI = () => {
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

        const cartCounter = document.getElementById('cart-counter');
        const cartIconWrapper = document.getElementById('cart-icon-wrapper');

        if (cartCounter) {
            cartCounter.textContent = totalItems;
            cartCounter.classList.toggle('hidden', totalItems === 0);
        }
        if (cartIconWrapper) {
            cartIconWrapper.classList.toggle('has-items', totalItems > 0);
        }
    };

    // --- 3. LÓGICA DE AUTENTICACIÓN ---

    const authContainer = document.getElementById('auth-container');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModalButton = document.getElementById('close-auth-modal-button');
    const googleLoginButtonModal = document.getElementById('google-login-button-modal');

    const signInWithGoogle = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        auth.signInWithPopup(provider).catch((error) => {
            console.error("Error during signInWithPopup:", error);
        });
    };

    const signOutUser = () => {
        auth.signOut().catch((error) => {
            console.error("Error signing out:", error);
        });
    };

    // Observador del estado de autenticación: el corazón del sistema
    auth.onAuthStateChanged(async (user) => {
        // Si hay un listener de carrito activo, lo detenemos primero para evitar conflictos.
        if (cartUnsubscribe) {
            cartUnsubscribe();
            cartUnsubscribe = null;
        }

        currentUser = user;

        if (user) {
            // --- USUARIO LOGUEADO ---
            renderAuthUI(user);

            const cartRef = db.collection('userCarts').doc(user.uid);

            // Fusionar carrito local con el de Firestore si hay algo en el local
            if (localCart.length > 0) {
                const firestoreDoc = await cartRef.get();
                const firestoreItems = firestoreDoc.exists ? firestoreDoc.data().items : [];

                localCart.forEach(localItem => {
                    const existingItem = firestoreItems.find(fsItem => fsItem.id === localItem.id);
                    if (existingItem) {
                        existingItem.quantity += localItem.quantity;
                    } else {
                        firestoreItems.push(localItem);
                    }
                });

                await cartRef.set({ items: firestoreItems });
                localCart = []; // Limpiar carrito local
                localStorage.removeItem('yanzGuestCart');
            }

            // Escuchamos cambios en el carrito de Firestore en tiempo real
            cartUnsubscribe = cartRef.onSnapshot((doc) => {
                window.firestoreCart = doc.exists ? doc.data().items : [];
                updateCartUI();
                if(!cartModal.classList.contains('hidden')) renderCartModal();
            }, (error) => {
                console.error("Error with cart snapshot:", error);
            });

            authModal.classList.add('hidden');

        } else {
            // --- USUARIO NO LOGUEADO ---
            window.firestoreCart = [];
            renderAuthUI(null);
            loadLocalCart(); // Carga el carrito de invitado
        }
    });

    const renderAuthUI = (user) => {
        if (!authContainer) return;
        if (user) {
            const userImage = user.photoURL ? `<img src="${user.photoURL}" alt="Foto de ${user.displayName}" class="w-full h-full object-cover">` : `<span class="text-white font-bold text-xl">${user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</span>`;
            authContainer.innerHTML = `<div class="relative"><button id="user-menu-button" title="Mi Cuenta" class="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm overflow-hidden border-2 border-gray-500 hover:border-gray-400 bg-gray-700">${userImage}</button><div id="user-menu-dropdown" class="hidden absolute top-full right-0 mt-2 w-56 bg-[var(--yanz-header-bg)] border border-gray-700 rounded-lg shadow-xl z-50"><div class="px-4 py-3 border-b border-gray-700"><p class="text-sm font-semibold text-white truncate">${user.displayName || 'Usuario'}</p><p class="text-xs text-gray-400 truncate">${user.email || 'Sin email'}</p></div><div class="py-1"><a href="#" id="logout-button-menu" class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"><svg class="w-4 h-4 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>Cerrar Sesión</a></div></div></div>`;
            const userMenuButton = document.getElementById('user-menu-button'); const userMenuDropdown = document.getElementById('user-menu-dropdown'); const logoutButtonMenu = document.getElementById('logout-button-menu');
            userMenuButton.addEventListener('click', (event) => { event.stopPropagation(); userMenuDropdown.classList.toggle('hidden'); });
            logoutButtonMenu.addEventListener('click', (e) => { e.preventDefault(); userMenuDropdown.classList.add('hidden'); signOutUser(); });
            window.addEventListener('click', (event) => { if (userMenuDropdown && !userMenuDropdown.classList.contains('hidden') && !userMenuButton.contains(event.target) && !userMenuDropdown.contains(event.target)) { userMenuDropdown.classList.add('hidden'); } });
        } else {
            authContainer.innerHTML = `<button id="open-auth-modal-button" title="Acceder o Registrarse" class="w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm overflow-hidden"><video autoplay loop muted playsinline class="w-full h-full object-cover" onerror="this.style.display='none'; this.parentElement.innerHTML = '<span class=\\'font-sans text-gray-800 text-lg font-bold\\'>G</span>';"><source src="assets/videos/login-icon.mp4" type="video/mp4"></video></button>`;
            document.getElementById('open-auth-modal-button').addEventListener('click', () => authModal.classList.remove('hidden'));
        }
    };

    googleLoginButtonModal.addEventListener('click', signInWithGoogle);
    closeAuthModalButton.addEventListener('click', () => authModal.classList.add('hidden'));
    authModal.addEventListener('click', (event) => {
        if (event.target === authModal) { authModal.classList.add('hidden'); }
    });

    // --- 4. LÓGICA DE UI GENERAL (MENÚS, TEMA, MODAL DEL CARRITO, ETC.) ---

    const cartModal = document.getElementById('cart-modal');
    const openCartButton = document.getElementById('open-cart-button');

    const renderCartModal = () => {
        const cart = getCart();
        const actionButtonHtml = cart.length > 0 ? `<a href="caja.html" class="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-base font-semibold text-white bg-green-500 rounded-lg shadow-sm hover:bg-green-600 transition-all"><span>Ir a la Caja</span></a>` : '<a href="#productos" onclick="closeCartModal()" class="w-full block text-center bg-[var(--yanz-primary)] text-white font-bold py-3 px-5 rounded-lg">Explorar Productos</a>';
        const cartItemsHtml = cart.length === 0 ? `<p class="text-gray-400 py-8 text-center">Tu carrito está vacío.</p>` : cart.map(item => `<div class="flex justify-between items-center py-3"><span class="text-gray-300 pr-2 flex-grow">${item.name}</span><div class="flex items-center gap-2 text-white"><button onclick="decreaseQuantity('${item.id}')" class="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors">-</button><span class="w-8 text-center">${item.quantity}</span><button onclick="increaseQuantity('${item.id}')" class="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors">+</button><button onclick="removeItemFromCart('${item.id}')" class="ml-2 text-red-400 hover:text-red-300 transition-colors" aria-label="Eliminar item"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div>`).join("");
        cartModal.innerHTML=`<div class="w-full max-w-md bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 flex flex-col modal-enter"><div class="text-center mb-6"><video autoplay loop muted playsinline class="w-24 h-24 mx-auto mb-2 rounded-full border-4 border-[var(--yanz-primary)] shadow-lg"><source src="assets/videos/video-carrito.mp4" type="video/mp4"></video><h2 class="text-2xl font-bold text-white">Tu Carrito de Ideas</h2></div><div class="border-t border-gray-700 pt-4 flex-grow overflow-y-auto" style="max-height: 40vh;"><div id="cart-items" class="divide-y divide-gray-700 text-left">${cartItemsHtml}</div></div><div class="mt-auto pt-4 space-y-3">${actionButtonHtml}<button class="mt-2 text-sm text-gray-400 hover:text-white w-full" onclick="closeCartModal()">Cerrar</button></div></div>`;
    };

    window.closeCartModal = () => cartModal.classList.add('hidden');
    openCartButton.addEventListener('click', () => { renderCartModal(); cartModal.classList.remove('hidden'); });

    // Lógica del tema claro/oscuro
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    const applyTheme = (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        sunIcon.classList.toggle('hidden', theme !== 'dark');
        moonIcon.classList.toggle('hidden', theme === 'dark');
    };
    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // Carga de contenido dinámico (productos, servicios, etc.)
    const createCategoryCard = (category) => {
        const cardLink = document.createElement('a');
        cardLink.href = category.link;
        cardLink.className = "block bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-[var(--yanz-border)] shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-2";
        cardLink.innerHTML = `<div class="overflow-hidden"><video autoplay loop muted playsinline class="w-full h-48 object-cover"><source src="${category.video}" type="video/mp4"></video></div><div class="p-6 flex flex-col flex-grow"><div class="flex-grow"><h3 class="text-xl font-bold mb-2">${category.title}</h3><p class="text-sm text-[var(--yanz-text-alt)]">${category.description}</p></div><div class="mt-6 w-full text-center bg-[var(--yanz-primary)] text-white text-sm font-semibold py-2 px-4 rounded-full group-hover:bg-[var(--yanz-secondary)] transition-colors">Explorar Categoría</div></div>`;
        return cardLink;
    };
    const productGrid = document.getElementById('product-grid');
    const serviceGrid = document.getElementById('service-grid');
    const categories = [ { title: 'Cocinas de Vanguardia', video: 'assets/videos/cocinas.mp4', description: 'El corazón de tu hogar, rediseñado con funcionalidad y un estilo que enamora.', link: 'cocinas.html', type: 'product' }, { title: 'Clósets', video: 'assets/videos/closets.mp4', description: 'Transformamos el orden en un arte, creando soluciones de almacenamiento que se adaptan a tu vida.', link: 'closets.html', type: 'product' }, { title: 'Puertas Modernas', video: 'assets/videos/puertas.mp4', description: 'La primera impresión es inolvidable. Crea una bienvenida espectacular con nuestros diseños.', link: 'puertas.html', type: 'product' }, { title: 'Pisos de Madera Sintética', video: 'assets/videos/pisos.mp4', description: 'La calidez de la madera con una resistencia y durabilidad que superan la prueba del tiempo.', link: 'pisos.html', type: 'product' }, { title: 'Muebles de Baño', video: 'assets/videos/banos.mp4', description: 'Convierte tu baño en un santuario de relajación y elegancia con nuestros muebles a medida.', link: 'banos.html', type: 'product' }, { title: 'Gypsum y Luz', video: 'assets/videos/gypsum.mp4', description: 'Esculpe tus techos y paredes con luz, creando ambientes únicos y atmósferas envolventes.', link: 'gypsum.html', type: 'product' }, { title: 'Accesorios y Organizadores', video: 'assets/videos/accesorios.mp4', description: 'Los detalles marcan la diferencia. Optimiza cada rincón con nuestras soluciones inteligentes.', link: 'accesorios.html', type: 'product' }, { title: 'Diseño con IA "Aria"', video: 'assets/videos/diseno_ia.mp4', description: '¿No tienes claro tu diseño? Deja que nuestra Inteligencia Artificial visualice tu espacio ideal.', link: 'aria.html', type: 'product' }, { title: 'Renovación y Cuidado del Hogar', video: 'assets/videos/servicio_renovacion.mp4', description: 'Devolvemos la vida y el brillo a tus espacios. Un servicio integral para que luzcan como nuevos.', link: '#contacto', type: 'service' }, { title: 'Herrajes y Ferretería Profesional', video: 'assets/videos/ferreteria.mp4', description: 'La base de un gran proyecto. Encuentra la más alta calidad en materiales para tus creaciones.', link: 'ferreteria.html', type: 'service' }, { title: 'Consultoría e Integración de IA', video: 'assets/videos/servicio_ia.mp4', description: 'Lleva tu negocio al siguiente nivel. Implementamos asistentes de IA para potenciar tus ventas.', link: '#contacto', type: 'service' } ];
    categories.forEach(cat => {
        const card = createCategoryCard(cat);
        if (cat.type === 'product' && productGrid) productGrid.appendChild(card);
        if (cat.type === 'service' && serviceGrid) serviceGrid.appendChild(card);
    });

    // Menú móvil
    const menuButton = document.getElementById('menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    menuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    mobileNavLinks.forEach(link => { link.addEventListener('click', () => mobileMenu.classList.add('hidden')) });

    // Lógica de carga inicial (preloader, etc.)
    const savedTheme = localStorage.getItem('theme') || 'dark'; applyTheme(savedTheme);
    const paymentLogosContainer = document.getElementById('payment-logos');
    if(paymentLogosContainer) { const paymentMethods = [ { name: 'PeiGo', image: 'assets/images/pago-peigo.png' }, { name: 'Mastercard', image: 'assets/images/pago-mastercard.png' }, { name: 'Visa', image: 'assets/images/pago-visa.png' }, { name: 'American Express', image: 'assets/images/pago-american-express.png' }, { name: 'Discover', image: 'assets/images/pago-discover.png' }, { name: 'JCB', image: 'assets/images/pago-jcb.png' }, { name: 'Diners Club', image: 'assets/images/pago-diners-club.png' }, { name: 'PayPal', image: 'assets/images/pago-paypal.png' }, { name: 'Binance Pay', image: 'assets/images/pago-binance-pay.png' }, { name: 'Banco Guayaquil', image: 'assets/images/pago-banco-guayaquil.png' }, { name: 'Banco Pichincha', image: 'assets/images/pago-banco-pichincha.png' }, { name: 'DeUna', image: 'assets/images/pago-deuna.png' } ]; paymentMethods.forEach(m => { paymentLogosContainer.innerHTML += `<img src="${m.image}" alt="${m.name}" title="${m.name}" class="h-8 bg-white rounded-md p-1">`; }); }
    document.getElementById('year').textContent = new Date().getFullYear();

    const preloader = document.getElementById('preloader');
    const pageContent = document.getElementById('page-content');
    const introVideo = document.getElementById('intro-video');
    let appStarted = false;
    function startApp() {
        if (appStarted) return;
        appStarted = true;
        if (preloader) preloader.classList.add('hidden');
        if (pageContent) pageContent.classList.add('loaded');
    }
    if (introVideo) {
        introVideo.addEventListener('ended', startApp);
        introVideo.addEventListener('error', startApp);
        setTimeout(startApp, 5000);
    } else {
        startApp();
    }

    // --- 5. HERO SLIDESHOW ---
    const slideshow = document.getElementById('hero-slideshow');
    if (slideshow) {
        const slides = Array.from(slideshow.querySelectorAll('.hero-slide'));

        if (slides.length > 0) {
            // Sort slides based on the number in the src attribute to guarantee order
            slides.sort((a, b) => {
                const getNum = (src) => parseInt(src.match(/Presentacion-(\d+)\.jpeg/)?.[1] || 0, 10);
                return getNum(a.src) - getNum(b.src);
            });

            // Re-order the slides in the DOM itself to be certain
            slides.forEach(slide => slideshow.appendChild(slide));

            let currentSlide = 0;

            // Start with a clean slate, setting only the first slide as active
            slides.forEach((slide, index) => {
                slide.classList.toggle('active', index === currentSlide);
            });

            setInterval(() => {
                slides[currentSlide].classList.remove('active');
                currentSlide = (currentSlide + 1) % slides.length;
                slides[currentSlide].classList.add('active');
            }, 4000);
        }
    }
});
