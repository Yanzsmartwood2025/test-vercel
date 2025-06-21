/**
 * =================================================================
 * YAN'Z SMART WOOD - ENGINE v4.0 (yanz-engine-v4.js)
 * -----------------------------------------------------------------
 * Este motor centraliza toda la lógica de la aplicación:
 * - Conexión y servicios de Firebase (Auth, Firestore).
 * - Carga dinámica de productos desde Firestore.
 * - Gestión global del carrito de compras (invitado y logueado).
 * - Lógica de autenticación de usuarios.
 * - Renderizado de componentes UI (acordeón, modales, etc.).
 * - Asistente de voz 'Aria'.
 *
 * Incluir este script en TODAS las páginas del sitio.
 * =================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyC3ENgMXZWAHu7r8l-0z1Iva8CbML_Z26o",
        authDomain: "yan-z-smart-wood.firebaseapp.com",
        projectId: "yan-z-smart-wood",
        storageBucket: "yan-z-smart-wood.appspot.com",
        messagingSenderId: "369287615235",
        appId: "1:369287615235:web:654e1e6fb48b4f634f8f36"
    };

    let app, auth, db, currentUser = null,
        cartUnsubscribe = null;
    
    // Almacenará los productos cargados desde Firestore para no pedirlos de nuevo.
    let ferreteriaCatalog = null; 

    try {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("Motor YANZ v4.0 Inicializado.");
    } catch (error) {
        console.error("Error Fatal: No se pudo inicializar Firebase.", error);
        document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Error de Conexión</h1><p>No se pudo iniciar la aplicación. Por favor, revisa tu conexión a internet e inténtalo de nuevo más tarde.</p></div>';
        return;
    }

    // --- 2. GESTIÓN DEL CARRITO DE COMPRAS (GLOBAL) ---
    // Esta sección no cambia, sigue siendo robusta y funcional.
    let localCart = [];
    const loadLocalCart = () => { localCart = JSON.parse(localStorage.getItem('yanzGuestCart') || '[]'); updateCartUI(); };
    const saveLocalCart = () => { localStorage.setItem('yanzGuestCart', JSON.stringify(localCart)); updateCartUI(); };
    const getCart = () => currentUser ? (window.firestoreCart || []) : localCart;
    const saveCartToFirestore = async (cartData) => { if (!currentUser) return; try { await db.collection('userCarts').doc(currentUser.uid).set({ items: cartData }); } catch (error) { console.error("Error guardando el carrito en Firestore:", error); }};
    const updateCartItem = (item, quantityChange) => {
        let cart = getCart();
        const existingItemIndex = cart.findIndex(cartItem => cartItem.id === item.id);
        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += quantityChange;
            if (cart[existingItemIndex].quantity <= 0) {
                cart.splice(existingItemIndex, 1);
            }
        } else if (quantityChange > 0) {
            cart.push({ ...item, quantity: quantityChange });
        }
        if (currentUser) { saveCartToFirestore(cart); } else { localCart = cart; saveLocalCart(); }
    };
    
    window.addItemToCart = (item) => updateCartItem(item, (item.quantity || 1));
    window.increaseQuantity = (itemId) => { const item = findProductById(itemId); if (item) updateCartItem(item, 1); };
    window.decreaseQuantity = (itemId) => { const item = findProductById(itemId); if (item) updateCartItem(item, -1); };

    const updateCartUI = () => {
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        const cartCounter = document.getElementById('cart-counter');
        const cartIconWrapper = document.getElementById('cart-icon-wrapper');
        if (cartCounter) { cartCounter.textContent = totalItems; cartCounter.classList.toggle('hidden', totalItems === 0); }
        if (cartIconWrapper) { cartIconWrapper.classList.toggle('has-items', totalItems > 0); }
        if (typeof renderFerreteriaUI === 'function') renderFerreteriaUI();
        if (typeof renderCajaUI === 'function') renderCajaUI(cart);
    };

    // --- 3. GESTIÓN DE AUTENTICACIÓN (GLOBAL) ---
    // Sin cambios en esta sección.
    auth.onAuthStateChanged(async (user) => {
        if (cartUnsubscribe) { cartUnsubscribe(); cartUnsubscribe = null; }
        currentUser = user;
        if (user) {
            renderAuthUI(user);
            const cartRef = db.collection('userCarts').doc(user.uid);
            const guestCart = JSON.parse(localStorage.getItem('yanzGuestCart') || '[]');
            if (guestCart.length > 0) {
                const firestoreDoc = await cartRef.get();
                const firestoreItems = firestoreDoc.exists ? firestoreDoc.data().items : [];
                guestCart.forEach(localItem => {
                    const existingItem = firestoreItems.find(fsItem => fsItem.id === localItem.id);
                    if (existingItem) { existingItem.quantity += localItem.quantity; } else { firestoreItems.push(localItem); }
                });
                await cartRef.set({ items: firestoreItems });
                localStorage.removeItem('yanzGuestCart');
            }
            cartUnsubscribe = cartRef.onSnapshot((doc) => {
                window.firestoreCart = doc.exists ? doc.data().items : [];
                updateCartUI();
                const cartModalEl = document.getElementById('cart-modal');
                if (cartModalEl && !cartModalEl.classList.contains('hidden')) renderCartModal();
            }, (error) => console.error("Error de Snapshot:", error));
            const authModal = document.getElementById('auth-modal');
            if(authModal) authModal.classList.add('hidden');
        } else {
            window.firestoreCart = [];
            renderAuthUI(null);
            loadLocalCart();
        }
    });

    // --- 4. LÓGICA DE CARGA Y RENDERIZADO DE PRODUCTOS (FERRETERÍA) ---
    
    /**
     * Busca un producto por su ID en el catálogo cargado.
     * @param {string} productId - El ID del producto a buscar.
     * @returns {object|null} El objeto del producto o null si no se encuentra.
     */
    const findProductById = (productId) => {
        if (!ferreteriaCatalog) return null;
        for (const category of ferreteriaCatalog) {
            const found = category.products.find(p => p.id === productId);
            if (found) return found;
        }
        return null;
    };

    /**
     * Carga las categorías y productos desde Firestore.
     * Los almacena en la variable global 'ferreteriaCatalog'.
     */
    async function loadFerreteriaCatalog() {
        if (ferreteriaCatalog) return ferreteriaCatalog; // No volver a cargar si ya los tenemos

        try {
            const categoriesSnapshot = await db.collection('categoriasFerreteria').orderBy('order').get();
            const categoriesPromises = categoriesSnapshot.docs.map(async (categoryDoc) => {
                const categoryData = categoryDoc.data();
                const productsSnapshot = await db.collection('categoriasFerreteria').doc(categoryDoc.id).collection('products').get();
                const products = productsSnapshot.docs.map(doc => doc.data());
                return {
                    id: categoryDoc.id,
                    title: categoryData.title,
                    products: products
                };
            });
            
            ferreteriaCatalog = await Promise.all(categoriesPromises);
            console.log("Catálogo de ferretería cargado desde Firestore.");
            return ferreteriaCatalog;

        } catch (error) {
            console.error("Error al cargar productos desde Firestore:", error);
            // Retorna un array vacío para no romper la UI.
            return []; 
        }
    }

    /**
     * Construye el HTML del acordeón de productos.
     * @param {Array} categorias - El array de categorías y productos.
     */
    function buildAccordion(categorias) {
        const acordeonContainer = document.getElementById("ferreteria-acordeon");
        if (!acordeonContainer) return;

        if (!categorias || categorias.length === 0) {
            acordeonContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">No se pudieron cargar los productos en este momento. Por favor, intenta recargar la página.</p>';
            return;
        }

        acordeonContainer.innerHTML = ""; // Limpia el "Cargando..."
        categorias.forEach((category, index) => {
            const categoryDiv = document.createElement("div");
            categoryDiv.className = "bg-[var(--yanz-bg-alt)] rounded-lg overflow-hidden border border-[var(--yanz-border)]";
            const button = document.createElement("button");
            button.className = "acordeon-boton w-full flex justify-between items-center p-4 text-left";
            button.innerHTML = `<span class="text-lg font-bold">${category.title}</span><div class="bg-[var(--yanz-primary)] text-white text-sm font-semibold py-1 px-4 rounded-full">Ver Productos</div>`;
            button.dataset.categoryIndex = index;

            const panel = document.createElement("div");
            panel.className = "panel-productos grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4";

            if (category.products.length > 0) {
                category.products.forEach(product => {
                    const productDiv = document.createElement("div");
                    productDiv.className = "product-card bg-[var(--yanz-bg)] rounded-lg p-4 text-center shadow-md flex flex-col";
                    productDiv.dataset.productId = product.id;
                    productDiv.innerHTML = `
                        <img src="${product.image}" alt="${product.name}" class="w-full h-32 object-cover rounded-md mb-4" onerror="this.onerror=null;this.src='https://placehold.co/400x300/e2e8f0/2d3748?text=Imagen+no+disponible';">
                        <h4 class="font-semibold mb-2 flex-grow">${product.name}</h4>
                        ${product.price ? `<p class="font-bold text-lg text-[var(--yanz-primary)] mb-4">$${product.price.toFixed(2)}</p>` : ''}
                        <div class="action-container mt-auto"></div>
                    `;
                    panel.appendChild(productDiv);
                });
            } else {
                panel.innerHTML = '<p class="text-[var(--yanz-text-alt)] col-span-full text-center py-4">Productos próximamente...</p>';
            }
            categoryDiv.appendChild(button);
            categoryDiv.appendChild(panel);
            acordeonContainer.appendChild(categoryDiv);
        });
        renderFerreteriaUI();
    }

    /**
     * Actualiza los botones de "Agregar/Quitar" en cada tarjeta de producto.
     */
    function renderFerreteriaUI() {
        const acordeonContainer = document.getElementById("ferreteria-acordeon");
        if (!acordeonContainer) return;

        acordeonContainer.querySelectorAll('.product-card').forEach(card => {
            const productId = card.dataset.productId;
            const actionContainer = card.querySelector('.action-container');
            const product = findProductById(productId);

            if (!product || !actionContainer) return;

            const cartItem = getCart().find(item => item.id === productId);
            let buttonHtml;

            if (cartItem) {
                buttonHtml = `<div class="quantity-selector"><button class="quantity-btn minus-btn" data-product-id="${product.id}">-</button><span class="quantity-display">${cartItem.quantity}</span><button class="quantity-btn plus-btn" data-product-id="${product.id}">+</button></div>`;
            } else {
                buttonHtml = `<button class="add-to-cart-btn w-full bg-[var(--yanz-primary)] hover:bg-[var(--yanz-secondary)] text-white font-bold py-2 px-4 rounded-full transition-colors" data-product-id="${product.id}">${product.type === 'sale' ? 'Agregar a Coti' : 'Agregar para Cotizar'}</button>`;
            }
            actionContainer.innerHTML = buttonHtml;
        });
    }

    /**
     * Orquestador: Carga el catálogo y luego construye la UI.
     */
    async function initializeFerreteriaPage() {
        const acordeonContainer = document.getElementById("ferreteria-acordeon");
        if (!acordeonContainer) return; // No hacer nada si no es la página de ferretería

        acordeonContainer.innerHTML = '<p class="text-center text-[var(--yanz-text-alt)] col-span-full">Cargando productos...</p>';
        const catalog = await loadFerreteriaCatalog();
        buildAccordion(catalog);

        // Listener de eventos para el acordeón
        acordeonContainer.addEventListener('click', (e) => {
            const target = e.target;
            const categoryButton = target.closest('.acordeon-boton');
            if (categoryButton) {
                const panel = categoryButton.nextElementSibling;
                const isOpen = panel.classList.contains('open');
                acordeonContainer.querySelectorAll('.panel-productos.open').forEach(p => {
                    if (p !== panel) { p.classList.remove('open'); p.style.maxHeight = null; }
                });
                if (isOpen) {
                    panel.classList.remove('open');
                    panel.style.maxHeight = null;
                } else {
                    panel.classList.add('open');
                    panel.style.maxHeight = panel.scrollHeight + "px";
                }
                return;
            }

            const actionButton = target.closest('.add-to-cart-btn, .quantity-btn');
            if (actionButton) {
                const card = actionButton.closest('.product-card');
                const productId = card.dataset.productId;
                const product = findProductById(productId);
                if (!product) return;

                if (actionButton.classList.contains('add-to-cart-btn')) {
                    window.addItemToCart(product);
                } else if (actionButton.classList.contains('plus-btn')) {
                    window.increaseQuantity(productId);
                } else if (actionButton.classList.contains('minus-btn')) {
                    window.decreaseQuantity(productId);
                }
            }
        });
    }


    // --- 5. LÓGICA DE BÚSQUEDA (ARIA) ---
    // Esta sección también depende de que el catálogo esté cargado.
    const ariaInput = document.getElementById("aria-input");
    const ariaSearchButton = document.getElementById("aria-search-button");
    const ariaResultsContainer = document.getElementById("aria-results");

    async function performSearch() {
        // Asegurarnos de que el catálogo esté cargado antes de buscar
        if (!ferreteriaCatalog) {
            speakText("Un momento, estoy preparando el catálogo.");
            await loadFerreteriaCatalog();
        }

        const query = ariaInput.value.toLowerCase().trim();
        if (!query) { speakText("Por favor escribe lo que estás buscando."); return; }
        
        ariaResultsContainer.innerHTML = '<p class="text-center text-[var(--yanz-text-alt)]">Buscando...</p>';
        speakText(`Un momento, estoy buscando ${query} para ti.`);

        let results = [];
        let totalFound = 0;
        
        ferreteriaCatalog.forEach((category, index) => {
            const matchingProducts = category.products.filter(p => p.name.toLowerCase().includes(query));
            if (matchingProducts.length > 0) {
                results.push({
                    categoryIndex: index,
                    categoryTitle: category.title,
                    count: matchingProducts.length
                });
                totalFound += matchingProducts.length;
            }
        });

        setTimeout(() => {
            ariaResultsContainer.innerHTML = "";
            let speechOutput;
            if (results.length > 0) {
                speechOutput = `Listo. Encontré ${totalFound} ${totalFound === 1 ? 'producto' : 'productos'} para ${query}. Te muestro dónde están.`;
                results.forEach(result => {
                    const resultDiv = document.createElement("div");
                    resultDiv.className = "bg-[var(--yanz-bg-alt)] border border-[var(--yanz-border)] p-4 rounded-lg mb-2 flex justify-between items-center cursor-pointer hover:border-[var(--yanz-primary)]";
                    resultDiv.innerHTML = `<div><span class="font-bold">"${ariaInput.value}"</span><p class="text-sm text-[var(--yanz-text-alt)]">Encontrado en: ${result.categoryTitle} (${result.count} ${result.count > 1 ? "productos" : "producto"})</p></div><span class="text-[var(--yanz-primary)] font-bold">Ver &rarr;</span>`;
                    resultDiv.addEventListener("click", () => {
                        const acordeonContainer = document.getElementById("ferreteria-acordeon");
                        const categoryEl = acordeonContainer.querySelector(`.acordeon-boton[data-category-index='${result.categoryIndex}']`);
                        if (categoryEl) {
                            if(!categoryEl.nextElementSibling.classList.contains('open')) { categoryEl.click(); }
                            categoryEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                    });
                    ariaResultsContainer.appendChild(resultDiv);
                });
            } else {
                speechOutput = `Lo siento, no encontré nada parecido a ${query}. Pero no te preocupes, puedes usar el botón de Turbo para que te lo consigamos.`;
                ariaResultsContainer.innerHTML = `<p class="text-center text-[var(--yanz-text-alt)]">Lo siento, no encontré nada parecido a "${ariaInput.value}". Puedes pedirle ayuda a Turbo para conseguirlo.</p>`;
            }
            speakText(speechOutput);
        }, 800);
    }

    if (ariaSearchButton) ariaSearchButton.addEventListener("click", performSearch);
    if (ariaInput) ariaInput.addEventListener("keypress", e => { if (e.key === "Enter") performSearch(); });


    // --- 6. LÓGICA DE INTERFAZ DE USUARIO GENERAL Y MODALES ---
    // (Incluye Auth UI, Cart Modal, Turbo Modal, Theme Toggle, etc.)
    // Esta sección no tiene cambios mayores, solo se asegura de llamar a las funciones correctas.

    function renderAuthUI(user) { /* ... El código de renderAuthUI es idéntico al de la v3.3 ... */
        const authContainer = document.getElementById('auth-container');
        if (!authContainer) return;
        if (user) {
            const userImage = user.photoURL ? `<img src="${user.photoURL}" alt="${user.displayName}" class="w-full h-full object-cover">` : `<span class="text-white font-bold text-xl">${user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</span>`;
            authContainer.innerHTML = `<div class="relative"><button id="user-menu-button" title="Mi Cuenta" class="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm overflow-hidden border-2 border-gray-500 hover:border-gray-400 bg-gray-700">${userImage}</button><div id="user-menu-dropdown" class="hidden absolute top-full right-0 mt-2 w-56 bg-[var(--yanz-header-bg)] border border-gray-700 rounded-lg shadow-xl z-50"><div class="px-4 py-3 border-b border-gray-700"><p class="text-sm font-semibold text-white truncate">${user.displayName || 'Usuario'}</p><p class="text-xs text-gray-400 truncate">${user.email || 'Sin email'}</p></div><div class="py-1"><a href="#" id="logout-button-menu" class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"><svg class="w-4 h-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Cerrar Sesión</a></div></div></div>`;
            const userMenuButton = document.getElementById('user-menu-button');
            const userMenuDropdown = document.getElementById('user-menu-dropdown');
            const logoutButtonMenu = document.getElementById('logout-button-menu');
            userMenuButton.addEventListener('click', (event) => { event.stopPropagation(); userMenuDropdown.classList.toggle('hidden'); });
            logoutButtonMenu.addEventListener('click', (e) => { e.preventDefault(); userMenuDropdown.classList.add('hidden'); auth.signOut().catch(e => console.error(e)); });
            window.addEventListener('click', (event) => { if (userMenuDropdown && !userMenuDropdown.classList.contains('hidden') && !userMenuButton.contains(event.target) && !userMenuDropdown.contains(event.target)) { userMenuDropdown.classList.add('hidden'); } });
        } else {
            authContainer.innerHTML = `<button id="open-auth-modal-button" title="Acceder o Registrarse" class="w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm overflow-hidden"><video autoplay loop muted playsinline class="w-full h-full object-cover"><source src="/assets/videos/login-icon.mp4" type="video/mp4"></video></button>`;
            document.getElementById('open-auth-modal-button').addEventListener('click', () => { const authModal = document.getElementById('auth-modal'); if (authModal) authModal.classList.remove('hidden'); });
        }
    }

    function renderCartModal() {
        const cartModal = document.getElementById('cart-modal');
        if (!cartModal) return;
        const cart = getCart();
        const saleItems = cart.filter(item => item.type === 'sale' && item.price);
        let saleTotal = saleItems.reduce((total, item) => total + (item.price * item.quantity), 0);
        const checkoutButtonHtml = saleItems.length > 0 ? `<a href="/caja.html" class="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-base font-semibold text-white bg-green-500 rounded-lg shadow-sm hover:bg-green-600"><span>Ir a Pagar ($${saleTotal.toFixed(2)})</span></a>` : '';
        const quoteMessage = "Hola, me gustaría cotizar los siguientes productos de YAN'Z SMART WOOD:\n" + cart.map(item => `- ${item.name} (Cantidad: ${item.quantity})`).join("\n");
        const quoteButtonHtml = cart.length > 0 ? `<a href="https://wa.me/593996480843?text=${encodeURIComponent(quoteMessage)}" target="_blank" class="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700"><span>Solicitar Cotización de Todo</span></a>` : '';
        const cartItemsHtml = cart.length === 0 ? `<p class="text-gray-400 py-8 text-center">Tu carrito está vacío.</p>` : cart.map(item => `
            <div class="flex justify-between items-center py-3">
                <div class="flex-grow pr-2">
                    <span class="text-gray-300">${item.name}</span>
                    ${item.price ? `<p class="text-xs text-gray-500">$${item.price.toFixed(2)} c/u</p>` : ''}
                </div>
                <div class="flex items-center gap-2 text-white">
                    <button onclick="decreaseQuantity('${item.id}')" class="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors">-</button>
                    <span class="w-8 text-center">${item.quantity}</span>
                    <button onclick="increaseQuantity('${item.id}')" class="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors">+</button>
                </div>
            </div>`).join("");
        cartModal.innerHTML = `<div class="w-full max-w-md bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 flex flex-col modal-enter"><div class="text-center mb-6"><video autoplay loop muted playsinline class="w-24 h-24 mx-auto mb-2 rounded-full border-4 border-[var(--yanz-primary)] shadow-lg"><source src="/assets/videos/video-carrito.mp4" type="video/mp4"></video><h2 class="text-2xl font-bold text-white">¡Hola, soy Coti!</h2><p class="text-gray-300 text-sm mt-1 px-4">Tu asistente de proyectos. Aquí guardaré tus ideas.</p></div><div class="border-t border-gray-700 pt-4 flex-grow overflow-y-auto" style="max-height: 40vh;"><div class="divide-y divide-gray-700 text-left">${cartItemsHtml}</div></div><div class="mt-auto pt-4 space-y-3">${checkoutButtonHtml}${quoteButtonHtml}<button class="mt-2 text-sm text-gray-400 hover:text-white w-full" onclick="closeCartModal()">Cerrar</button></div></div>`;
    }

    // Funciones para abrir/cerrar modales y helpers de UI
    function setupGlobalUIListeners() {
        const googleLoginButtonModal = document.getElementById('google-login-button-modal');
        if(googleLoginButtonModal) googleLoginButtonModal.addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => console.error(e)));
        
        const authModal = document.getElementById('auth-modal');
        const closeAuthModalButton = document.getElementById('close-auth-modal-button');
        if(closeAuthModalButton) closeAuthModalButton.addEventListener('click', () => authModal.classList.add('hidden'));
        if(authModal) authModal.addEventListener('click', (event) => { if (event.target === authModal) authModal.classList.add('hidden'); });

        const openCartButton = document.getElementById('open-cart-button');
        const cartModal = document.getElementById('cart-modal');
        window.closeCartModal = () => { if(cartModal) cartModal.classList.add('hidden') };
        if(openCartButton) openCartButton.addEventListener('click', () => { renderCartModal(); if(cartModal) cartModal.classList.remove('hidden'); });

        const openTurboButton = document.getElementById("turbo-button");
        const turboModal = document.getElementById("turbo-modal");
        window.closeTurboModal = () => { if(turboModal) turboModal.classList.add("hidden") };
        if(openTurboButton) openTurboButton.addEventListener("click", () => {
             /* ... El código de renderTurboModal es idéntico al de la v3.3 ... */
             if (!turboModal) return;
             turboModal.innerHTML = `<div class="w-full max-w-lg bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 flex flex-col text-center modal-enter"><video autoplay loop muted playsinline class="w-32 h-32 mx-auto mb-4 rounded-full border-4 border-[var(--yanz-yellow)] shadow-lg object-cover"><source src="/assets/videos/perrito_en_moto.mp4" type="video/mp4"></video><h2 class="text-2xl font-bold text-white">¡Hola! Soy Turbo y llevo tu proyecto a la velocidad de la luz 🚀</h2><p class="text-gray-400 mt-2 mb-6">Nuestras entregas, claras y sin sorpresas:</p><div class="space-y-4 text-left"><div class="bg-blue-900/30 border border-blue-700 p-3 rounded-lg"><h4 class="font-bold text-white">Nota de Transparencia: ¡Te lo conseguimos!</h4><p class="text-sm text-gray-300">Para darte el catálogo más completo, trabajamos con los mejores proveedores. Si un artículo no está en nuestra bodega, ¡no te preocupes! Lo conseguimos para ti y te contactaremos por WhatsApp para confirmar la disponibilidad y el tiempo de entrega exacto.</p></div><div class="bg-gray-700/50 p-4 rounded-lg"><h3 class="font-bold text-white text-lg">Envío Express (en Moto 🛵)</h3><p class="text-sm text-gray-400 mb-2">Ideal para pedidos pequeños y urgentes (menores a $300).</p><ul class="text-sm space-y-1"><li><span class="font-semibold text-white">Quito Urbano:</span> $4.00 (<span class="text-green-400 font-bold">GRATIS</span> en compras +$60)</li><li><span class="font-semibold text-white">Valles:</span> $7.00 (<span class="text-green-400 font-bold">GRATIS</span> en compras +$60)</li></ul><p class="text-xs text-gray-400 mt-2">Tiempo de entrega: Menos de 8 horas laborables.</p></div><div class="bg-gray-700/50 p-4 rounded-lg"><h3 class="font-bold text-white text-lg">Carga Pesada (en Camioneta/Camión 🚚)</h3><p class="text-sm text-gray-400 mb-2">Para esos grandes proyectos (pedidos de ferretería de $300 o más).</p><p class="text-lg font-bold text-green-400">¡EL ENVÍO VA POR NUESTRA CUENTA!</p><p class="text-xs text-gray-400 mt-1">Nos contactaremos por WhatsApp para coordinar la logística perfecta para ti.</p></div></div><div class="mt-6"><button class="w-full bg-[var(--yanz-yellow)] text-gray-900 font-bold py-3 px-5 rounded-lg shadow-sm hover:opacity-90" onclick="closeTurboModal()">¡Entendido!</button></div></div>`;
            if(turboModal) turboModal.classList.remove("hidden");
        });
        
        // Menú móvil
        const menuButton = document.getElementById("menu-button");
        const mobileMenu = document.getElementById("mobile-menu");
        if(menuButton) menuButton.addEventListener("click", () => mobileMenu.classList.toggle("hidden"));
        if(mobileMenu) mobileMenu.querySelectorAll(".mobile-nav-link").forEach(link => link.addEventListener("click", () => mobileMenu.classList.add("hidden")));
        
        // Theme toggle
        const themeToggle = document.getElementById("theme-toggle");
        const sunIcon = document.getElementById("theme-icon-sun");
        const moonIcon = document.getElementById("theme-icon-moon");
        const applyTheme = (theme) => { document.documentElement.classList.toggle("dark", theme === "dark"); if(sunIcon) sunIcon.classList.toggle("hidden", theme !== "dark"); if(moonIcon) moonIcon.classList.toggle("hidden", theme === "dark"); };
        if(themeToggle) themeToggle.addEventListener("click", () => { const newTheme = document.documentElement.classList.contains("dark") ? "light" : "dark"; localStorage.setItem("theme", newTheme); applyTheme(newTheme); });
        applyTheme(localStorage.getItem("theme") || "dark");
        
        // Footer
        const yearSpan = document.getElementById("year");
        if(yearSpan) yearSpan.textContent = new Date().getFullYear();
    }
    
    function speakText(text, lang = 'es-LA') { /* ... El código de speakText es idéntico ... */ 
        if ('speechSynthesis' in window) {
            const cleanText = text.replace(/[,.]/g, ' ');
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = lang;
            utterance.pitch = 1.1;
            utterance.rate = 1.15;
            utterance.volume = 0.9;
            const allVoices = window.speechSynthesis.getVoices();
            const spanishVoice = allVoices.find(voice => voice.lang === 'es-US' || voice.lang === 'es-LA' || voice.lang.startsWith('es'));
            if (spanishVoice) { utterance.voice = spanishVoice; }
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } else { console.warn("La síntesis de voz no es soportada."); }
    }

    // --- 7. PUNTO DE ENTRADA Y EJECUCIÓN ---
    
    setupGlobalUIListeners();
    initializeFerreteriaPage(); // Intentará inicializar la página de ferretería. Si no lo es, no hará nada.

    // Bienvenida de Aria (si aplica)
    if (document.getElementById('aria-search')) {
        if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }
        setTimeout(() => {
            const welcomeMessage = "Hola. Bienvenido a YAN'Z SMART WOOD. Soy Aria, tu asistente virtual. Dime qué buscas y te ayudaré al instante.";
            speakText(welcomeMessage);
        }, 1500);
    }
});
