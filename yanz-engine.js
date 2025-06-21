// =================================================================
// =========== YAN'Z SMART WOOD - MOTOR CENTRAL ====================
// =================================================================
// Este archivo controla la autenticación y el estado del carrito
// para TODO el sitio web.

// --- INICIALIZACIÓN DE FIREBASE (SE HACE UNA SOLA VEZ AQUÍ) ---
const firebaseConfig = {
    apiKey: "AIzaSyC3ENgMXZWAHu7r8l-0z1Iva8CbML_Z26o",
    authDomain: "yan-z-smart-wood.firebaseapp.com",
    projectId: "yan-z-smart-wood",
    storageBucket: "yan-z-smart-wood.appspot.com",
    messagingSenderId: "369287615235",
    appId: "1:369287615235:web:654e1e6fb48b4f634f8f36"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const appId = 'yanz-smart-wood-app';
const GUEST_CART_KEY = `yanz_guest_cart_${appId}`;

// --- ESTADO GLOBAL DEL CARRITO (VIVE AQUÍ) ---
let currentCart = [];
let currentUserId = null;
let cartListener = null;

// --- FUNCIONES PARA MANIPULAR EL ESTADO DEL CARRITO ---
// Estas funciones ahora son globales para cualquier página que use este motor.
window.handleCartUpdate = (productId, change, allProducts) => {
    let itemIndex = currentCart.findIndex(item => item.id === productId);

    if (itemIndex > -1) {
        currentCart[itemIndex].quantity += change;
        if (currentCart[itemIndex].quantity <= 0) {
            currentCart.splice(itemIndex, 1);
        }
    } else if (change > 0) {
        // Busca el producto en la lista de todos los productos del sitio
        const productToAdd = allProducts.flatMap(cat => cat.products).find(p => p.id === productId);
        if (productToAdd) {
            currentCart.push({
                id: productToAdd.id,
                name: productToAdd.name,
                type: productToAdd.type,
                price: productToAdd.price,
                image: productToAdd.image,
                quantity: change
            });
        }
    }
    saveCurrentCart(); // Guarda y actualiza la UI
};


// --- RENDERIZADO Y LÓGICA DE UI COMPARTIDA ---
const renderLoggedInUI = (user) => {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;
    const userImage = user.photoURL ? `<img src="${user.photoURL}" alt="${user.displayName}" class="w-full h-full object-cover">` : `<span class="text-white font-bold text-xl">${user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</span>`;
    authContainer.innerHTML = `<div class="relative"><button id="user-menu-button" title="Mi Cuenta" class="w-9 h-9 rounded-full flex items-center justify-center bg-gray-700 overflow-hidden border-2 border-gray-500 hover:border-gray-400">${userImage}</button><div id="user-menu-dropdown" class="hidden absolute top-full right-0 mt-2 w-56 bg-[var(--yanz-header-bg)] rounded-lg shadow-xl z-50"><div class="px-4 py-3 border-b border-gray-700"><p class="text-sm font-semibold text-white truncate">${user.displayName}</p><p class="text-xs text-gray-400 truncate">${user.email}</p></div><div class="py-1"><a href="#" id="logout-button-menu" class="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cerrar Sesión</a></div></div></div>`;
    document.getElementById('logout-button-menu').addEventListener('click', (e) => { e.preventDefault(); logout(); });
    document.getElementById('user-menu-button').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('user-menu-dropdown').classList.toggle('hidden'); });
};

const renderGuestUI = () => {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;
    authContainer.innerHTML = `<button id="open-auth-modal-button" title="Acceder" class="w-9 h-9 rounded-full flex items-center justify-center"><video autoplay loop muted playsinline class="w-full h-full object-cover"><source src="/assets/videos/login-icon.mp4" type="video/mp4"></video></button>`;
    document.getElementById('open-auth-modal-button').addEventListener('click', () => document.getElementById('auth-modal')?.classList.remove('hidden'));
};

const loginWithGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(() => document.getElementById('auth-modal')?.classList.add('hidden')).catch(err => console.error(err));
};
const logout = () => auth.signOut();

const updateCartIcon = () => {
    const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCounter = document.getElementById('cart-counter');
    const cartIconWrapper = document.getElementById('cart-icon-wrapper');
    if (cartCounter && cartIconWrapper) {
        cartCounter.textContent = totalItems;
        cartIconWrapper.classList.toggle('has-items', totalItems > 0);
        cartCounter.classList.toggle('hidden', totalItems === 0);
    }
};

const saveCurrentCart = () => {
    if (currentUserId) {
        const cartRef = db.collection('artifacts').doc(appId).collection('carts').doc(currentUserId);
        cartRef.set({ items: currentCart }).catch(e => console.error("Error Firestore:", e));
    } else {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(currentCart));
    }
    // Dispara un evento personalizado para que las páginas sepan que el carrito cambió
    document.dispatchEvent(new CustomEvent('cartUpdated'));
};


// --- PUNTO DE ENTRADA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    if(authContainer) {
        authContainer.innerHTML = `<div class="w-9 h-9 rounded-full bg-gray-700 animate-pulse"></div>`;
    }

    auth.onAuthStateChanged(async (user) => {
        if (cartListener) cartListener(); // Detiene el listener anterior

        if (user) {
            currentUserId = user.uid;
            renderLoggedInUI(user);
            const cartRef = db.collection('artifacts').doc(appId).collection('carts').doc(user.uid);
            try {
                const guestCart = JSON.parse(localStorage.getItem(GUEST_CART_KEY)) || [];
                const doc = await cartRef.get();
                const firestoreCart = doc.exists ? doc.data().items : [];
                let finalCart = [...firestoreCart];
                if (guestCart.length > 0) {
                    guestCart.forEach(guestItem => {
                        const existingItem = finalCart.find(item => item.id === guestItem.id);
                        if (existingItem) existingItem.quantity += guestItem.quantity;
                        else finalCart.push(guestItem);
                    });
                    localStorage.removeItem(GUEST_CART_KEY);
                }
                currentCart = finalCart;
                await cartRef.set({ items: currentCart });
                cartListener = cartRef.onSnapshot(snapshot => {
                    currentCart = snapshot.exists ? snapshot.data().items : [];
                    document.dispatchEvent(new CustomEvent('cartUpdated')); // Notifica a la página
                });
            } catch (error) {
                console.error("Error syncing cart:", error);
                currentCart = [];
                document.dispatchEvent(new CustomEvent('cartUpdated'));
            }
        } else {
            currentUserId = null;
            renderGuestUI();
            currentCart = JSON.parse(localStorage.getItem(GUEST_CART_KEY)) || [];
            document.dispatchEvent(new CustomEvent('cartUpdated'));
        }
        
        // El evento final que le dice a la página "¡Ya terminé de cargar el carrito, ahora puedes dibujar tus cosas!"
        document.dispatchEvent(new CustomEvent('authReady'));
    });

    // Asigna eventos a los elementos del modal de autenticación si existen
    const authModal = document.getElementById('auth-modal');
    document.getElementById('google-login-button-modal')?.addEventListener('click', loginWithGoogle);
    document.getElementById('close-auth-modal-button')?.addEventListener('click', () => authModal?.classList.add('hidden'));
    authModal?.addEventListener('click', (e) => { if (e.target === authModal) authModal.classList.add('hidden'); });

    // Eventos de UI globales
    window.addEventListener('click', (event) => {
        const dropdown = document.getElementById('user-menu-dropdown');
        const button = document.getElementById('user-menu-button');
        if (dropdown && !dropdown.classList.contains('hidden') && !button?.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    });
});
