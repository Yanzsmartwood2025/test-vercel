/**
 * YAN'Z SMART WOOD - ENGINE v2.0
 * Este script central gestiona la inicialización de Firebase, la autenticación de usuarios
 * y la lógica del carrito de compras para todo el sitio web.
 * Utiliza la SDK de Firebase v9+ (modular).
 */

// Espera a que el contenido del DOM esté completamente cargado para ejecutar el script.
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE ---
    // IMPORTANTE: Reemplaza este objeto con la configuración de tu propio proyecto de Firebase.
    // Puedes encontrarla en la consola de Firebase > Configuración del proyecto.
    const firebaseConfig = {
        apiKey: "TU_API_KEY",
        authDomain: "TU_AUTH_DOMAIN",
        projectId: "TU_PROJECT_ID",
        storageBucket: "TU_STORAGE_BUCKET",
        messagingSenderId: "TU_MESSAGING_SENDER_ID",
        appId: "TU_APP_ID"
    };

    // Declaramos las variables de Firebase en un alcance más amplio.
    let app, auth, firestore;

    try {
        // Inicializamos la app de Firebase.
        app = firebase.initializeApp(firebaseConfig);
        // Obtenemos las instancias de los servicios de Autenticación y Firestore.
        auth = firebase.auth();
        firestore = firebase.firestore();
        console.log("Firebase Engine Initialized Successfully.");
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        // Si Firebase no se inicia, no podemos continuar.
        return;
    }

    // --- LÓGICA DEL CARRITO DE COMPRAS ---

    // El carrito se guarda como un array de objetos en el localStorage del navegador.
    let cart = [];

    const loadCartFromStorage = () => {
        const storedCart = localStorage.getItem('yanzCart');
        if (storedCart) {
            cart = JSON.parse(storedCart);
        }
        updateCartUI();
    };

    const saveCartToStorage = () => {
        localStorage.setItem('yanzCart', JSON.stringify(cart));
    };

    /**
     * Añade un item al carrito de compras.
     * Si el item ya existe, incrementa su cantidad.
     * @param {object} item - El objeto del producto a añadir.
     * Ejemplo de item: { id: 'cocina-01', name: 'Cocina de Lujo', quantity: 1, type: 'quote' }
     */
    const addToCart = (item) => {
        if (!item || !item.id || !item.name) {
            console.error("Intentando añadir un item inválido al carrito.", item);
            return;
        }

        const existingItem = cart.find(cartItem => cartItem.id === item.id);

        if (existingItem) {
            // Si el item ya está en el carrito, solo aumenta la cantidad.
            existingItem.quantity += item.quantity || 1;
        } else {
            // Si es un item nuevo, lo añade al carrito.
            cart.push({ ...item, quantity: item.quantity || 1 });
        }

        saveCartToStorage();
        updateCartUI();
        
        // Muestra una notificación o feedback al usuario (opcional pero recomendado)
        alert(`'${item.name}' ha sido añadido a tu lista de cotización.`);
        console.log("Cart updated:", cart);
    };

    // Hacemos la función `addToCart` accesible globalmente para poder llamarla desde los `onclick` en el HTML.
    window.addToCart = addToCart;

    /**
     * Actualiza la interfaz de usuario del carrito (ícono y contador).
     */
    const updateCartUI = () => {
        const cartIconWrapper = document.getElementById('cart-icon-wrapper');
        const cartCounter = document.getElementById('cart-counter');
        
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

        if (cartCounter) {
            if (totalItems > 0) {
                cartCounter.textContent = totalItems;
                cartCounter.classList.remove('hidden');
            } else {
                cartCounter.classList.add('hidden');
            }
        }

        if (cartIconWrapper) {
            cartIconWrapper.classList.toggle('has-items', cart.length > 0);
        }
        
        // Disparamos un evento personalizado para que otras partes de la web (como el modal) sepan que el carrito se actualizó.
        document.dispatchEvent(new CustomEvent('cartUpdated'));
    };
    
    // Hacemos `updateCartUI` global para que pueda ser llamado desde el index.
    window.updateCartIcon = updateCartUI;
    
    // Hacemos el carrito actual accesible globalmente para que el modal lo pueda leer.
    window.currentCart = cart;


    // --- LÓGICA DE AUTENTICACIÓN ---
    
    const authContainer = document.getElementById('auth-container');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModalButton = document.getElementById('close-auth-modal-button');
    const googleLoginButtonModal = document.getElementById('google-login-button-modal');

    /**
     * Renderiza la UI de autenticación en el header dependiendo del estado del usuario.
     * @param {object|null} user - El objeto de usuario de Firebase, o null si no está logueado.
     */
    const renderAuthUI = (user) => {
        if (!authContainer) return;

        if (user) {
            // Usuario está logueado
            authContainer.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${user.photoURL}" alt="Foto de ${user.displayName}" class="w-8 h-8 rounded-full border-2 border-gray-500">
                    <button id="logout-button" class="text-sm font-semibold text-gray-300 hover:text-[var(--yanz-primary)] transition-colors">Salir</button>
                </div>
            `;
            document.getElementById('logout-button').addEventListener('click', signOutUser);
        } else {
            // Usuario no está logueado
            authContainer.innerHTML = `
                <button id="login-button" class="text-sm font-semibold text-gray-300 hover:text-[var(--yanz-primary)] transition-colors">Acceder</button>
            `;
            document.getElementById('login-button').addEventListener('click', () => {
                authModal.classList.remove('hidden');
            });
        }
    };

    // Función para iniciar sesión con Google
    const signInWithGoogle = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                console.log("Signed in successfully:", result.user.displayName);
                authModal.classList.add('hidden'); // Cierra el modal al loguearse
            })
            .catch((error) => {
                console.error("Error signing in with Google:", error);
                alert("Hubo un error al iniciar sesión. Por favor, intenta de nuevo.");
            });
    };

    // Función para cerrar sesión
    const signOutUser = () => {
        auth.signOut().then(() => {
            console.log("Signed out successfully.");
        }).catch((error) => {
            console.error("Error signing out:", error);
        });
    };

    // Listeners para el modal de autenticación
    closeAuthModalButton?.addEventListener('click', () => authModal.classList.add('hidden'));
    googleLoginButtonModal?.addEventListener('click', signInWithGoogle);


    // --- INICIALIZACIÓN DEL MOTOR ---

    // Observador del estado de autenticación. Se dispara al cargar la página y cada vez que el usuario inicia o cierra sesión.
    auth.onAuthStateChanged((user) => {
        renderAuthUI(user);
        // Disparamos un evento para que otras partes de la web sepan que la autenticación está lista.
        document.dispatchEvent(new CustomEvent('authReady'));
    });

    // Carga el carrito desde localStorage cuando la página se carga por primera vez.
    loadCartFromStorage();
});
