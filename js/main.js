/**
 * =================================================================
 * YAN'Z SMART WOOD - MAIN ENGINE v4.1 (Consolidated)
 * -----------------------------------------------------------------
 * Este motor unificado centraliza toda la lógica de la aplicación y
 * debe ser incluido en TODAS las páginas del sitio después de
 * firebase-init.js.
 *
 * Asume que las variables `app`, `auth`, y `db` de Firebase
 * ya han sido inicializadas y están disponibles globalmente.
 *
 * Gestiona:
 * - Carga dinámica de productos desde Firestore.
 * - Gestión global del carrito de compras (invitado y logueado).
 * - Lógica de autenticación de usuarios y UI.
 * - Renderizado de componentes UI (acordeón, modales, etc.).
 * - Asistente de voz 'Aria'.
 * =================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 0. CONFIGURACIÓN INICIAL ---
    // Determina la ruta base para los assets dependiendo si estamos en un subdirectorio.
    const isSubdirectory = window.location.pathname.split('/').length > 2 && !window.location.pathname.endsWith('.html');
    const basePath = isSubdirectory ? '..' : '.';

    // Variables globales para el estado de la aplicación.
    // `auth` y `db` son provistas por firebase-init.js
    let currentUser = null;
    let cartUnsubscribe = null;
    let ferreteriaCatalog = null; // Caché para el catálogo de ferretería.
    let localCart = []; // Carrito para usuarios no logueados.


    // --- GESTIÓN DEL CARRITO DE COMPRAS (GLOBAL) ---
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

    // --- GESTIÓN DE AUTENTICACIÓN (GLOBAL) ---
    // El objeto `auth` es provisto por firebase-init.js
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

    // --- LÓGICA DE CARGA Y RENDERIZADO DE PRODUCTOS (FERRETERÍA) ---
    const findProductById = (productId) => {
        if (!ferreteriaCatalog) return null;
        for (const category of ferreteriaCatalog) {
            const found = (category.products || []).find(p => p.id === productId);
            if (found) return found;
        }
        return null;
    };

    async function loadFerreteriaCatalog() {
        if (ferreteriaCatalog) return ferreteriaCatalog;
        try {
            const categoriesSnapshot = await db.collection('categoriasFerreteria').orderBy('order').get();
            const categoriesPromises = categoriesSnapshot.docs.map(async (categoryDoc) => {
                const categoryData = categoryDoc.data();
                const productsSnapshot = await db.collection('categoriasFerreteria').doc(categoryDoc.id).collection('products').get();
                const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            return [];
        }
    }

    function buildAccordion(categorias) {
        const acordeonContainer = document.getElementById("ferreteria-acordeon");
        if (!acordeonContainer) return;
        if (!categorias || categorias.length === 0) {
            acordeonContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">No se pudieron cargar los productos. Por favor, intente recargar la página.</p>';
            return;
        }
        acordeonContainer.innerHTML = "";
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

    async function initializeFerreteriaPage() {
        const acordeonContainer = document.getElementById("ferreteria-acordeon");
        if (!acordeonContainer) return;
        acordeonContainer.innerHTML = '<p class="text-center text-[var(--yanz-text-alt)] col-span-full">Cargando productos...</p>';
        const catalog = await loadFerreteriaCatalog();
        buildAccordion(catalog);
        acordeonContainer.addEventListener('click', (e) => {
            const target = e.target;
            const categoryButton = target.closest('.acordeon-boton');
            if (categoryButton) {
                const panel = categoryButton.nextElementSibling;
                const isOpen = panel.classList.contains('open');
                acordeonContainer.querySelectorAll('.panel-productos.open').forEach(p => { if (p !== panel) { p.classList.remove('open'); p.style.maxHeight = null; } });
                if (isOpen) { panel.classList.remove('open'); panel.style.maxHeight = null; } else { panel.classList.add('open'); panel.style.maxHeight = panel.scrollHeight + "px"; }
                return;
            }
            const actionButton = target.closest('.add-to-cart-btn, .quantity-btn');
            if (actionButton) {
                const card = actionButton.closest('.product-card');
                const productId = card.dataset.productId;
                const product = findProductById(productId);
                if (!product) return;
                if (actionButton.classList.contains('add-to-cart-btn')) window.addItemToCart(product);
                else if (actionButton.classList.contains('plus-btn')) window.increaseQuantity(productId);
                else if (actionButton.classList.contains('minus-btn')) window.decreaseQuantity(productId);
            }
        });
    }

    // --- LÓGICA DE BÚSQUEDA (ARIA) ---
    const ariaInput = document.getElementById("aria-input");
    const ariaSearchButton = document.getElementById("aria-search-button");
    const ariaResultsContainer = document.getElementById("aria-results");
    async function performSearch() {
        if (!ferreteriaCatalog) { speakText("Un momento, estoy preparando el catálogo."); await loadFerreteriaCatalog(); }
        const query = ariaInput.value.toLowerCase().trim();
        if (!query) { speakText("Por favor escribe lo que estás buscando."); return; }
        ariaResultsContainer.innerHTML = '<p class="text-center text-[var(--yanz-text-alt)]">Buscando...</p>';
        speakText(`Un momento, estoy buscando ${query} para ti.`);
        let results = [];
        let totalFound = 0;
        ferreteriaCatalog.forEach((category, index) => {
            const matchingProducts = category.products.filter(p => p.name.toLowerCase().includes(query));
            if (matchingProducts.length > 0) {
                results.push({ categoryIndex: index, categoryTitle: category.title, count: matchingProducts.length });
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
                        if (categoryEl) { if(!categoryEl.nextElementSibling.classList.contains('open')) { categoryEl.click(); } categoryEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
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

    // --- LÓGICA DE UI GENERAL Y MODALES ---
    function renderAuthUI(user) {
        const authContainer = document.getElementById('auth-container');
        if (!authContainer) return;
        if (user) {
            // --- Logic for Premium Avatar Ring ---
            const providerId = user.providerData?.[0]?.providerId || '';
            const ringClasses = {
                'google.com': 'google-ring',
                'facebook.com': 'facebook-ring',
                'apple.com': 'apple-ring'
            };
            const ringClass = ringClasses[providerId] || ''; // Default to no ring

            const userImage = user.photoURL
                ? `<img src="${user.photoURL}" alt="${user.displayName}">`
                : `<span>${user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</span>`;

            authContainer.innerHTML = `
                <div class="relative">
                    <button id="user-menu-button" title="Mi Cuenta" class="user-avatar-ring-container transition-transform hover:scale-110 ${ringClass}">
                        <div class="user-avatar-ring"></div>
                        ${userImage}
                    </button>
                    <div id="user-menu-dropdown" class="hidden absolute top-full right-0 mt-2 w-56 bg-[var(--yanz-header-bg)] border border-gray-700 rounded-lg shadow-xl z-50">
                        <div class="px-4 py-3 border-b border-gray-700">
                            <p class="text-sm font-semibold text-white truncate">${user.displayName || 'Usuario'}</p>
                            <p class="text-xs text-gray-400 truncate">${user.email || 'Sin email'}</p>
                        </div>
                        <div class="py-1">
                            <a href="#" id="logout-button-menu" class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                                <svg class="w-4 h-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                                Cerrar Sesión
                            </a>
                        </div>
                    </div>
                </div>`;

            const userMenuButton = document.getElementById('user-menu-button');
            const userMenuDropdown = document.getElementById('user-menu-dropdown');
            const logoutButtonMenu = document.getElementById('logout-button-menu');
            userMenuButton.addEventListener('click', (event) => { event.stopPropagation(); userMenuDropdown.classList.toggle('hidden'); });
            logoutButtonMenu.addEventListener('click', (e) => { e.preventDefault(); userMenuDropdown.classList.add('hidden'); auth.signOut().catch(e => console.error(e)); });
            window.addEventListener('click', (event) => { if (userMenuDropdown && !userMenuDropdown.classList.contains('hidden') && !userMenuButton.contains(event.target) && !userMenuDropdown.contains(event.target)) { userMenuDropdown.classList.add('hidden'); } });
        } else {
            authContainer.innerHTML = `<button id="open-auth-modal-button" title="Acceder o Registrarse" class="w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm overflow-hidden"><video autoplay loop muted playsinline class="w-full h-full object-cover"><source src="${basePath}/assets/videos/login-icon.mp4" type="video/mp4"></video></button>`;
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
                    <button onclick="decreaseQuantity('${item.id}')" class="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors">-</button><span class="w-8 text-center">${item.quantity}</span><button onclick="increaseQuantity('${item.id}')" class="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors">+</button>
                </div>
            </div>`).join("");
        cartModal.innerHTML = `<div class="w-full max-w-md bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 flex flex-col modal-enter"><div class="text-center mb-6"><video autoplay loop muted playsinline class="w-24 h-24 mx-auto mb-2 rounded-full border-4 border-[var(--yanz-primary)] shadow-lg"><source src="${basePath}/assets/videos/video-carrito.mp4" type="video/mp4"></video><h2 class="text-2xl font-bold text-white">¡Hola, soy Coti!</h2><p class="text-gray-300 text-sm mt-1 px-4">Tu asistente de proyectos. Aquí guardaré tus ideas.</p></div><div class="border-t border-gray-700 pt-4 flex-grow overflow-y-auto" style="max-height: 40vh;"><div class="divide-y divide-gray-700 text-left">${cartItemsHtml}</div></div><div class="mt-auto pt-4 space-y-3">${checkoutButtonHtml}${quoteButtonHtml}<button class="mt-2 text-sm text-gray-400 hover:text-white w-full" onclick="closeCartModal()">Cerrar</button></div></div>`;
    }
    function setupGlobalUIListeners() {
        const googleLoginButtonModal = document.getElementById('google-login-button-modal');
        if(googleLoginButtonModal) googleLoginButtonModal.addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => console.error("Google Sign-In Error:", e)));

        const facebookLoginButtonModal = document.getElementById('facebook-login-button-modal');
        if(facebookLoginButtonModal) facebookLoginButtonModal.addEventListener('click', () => {
            console.log("Attempting Facebook login...");
            auth.signInWithPopup(new firebase.auth.FacebookAuthProvider()).catch(e => {
                console.error("Facebook Sign-In Error:", e);
                alert("El inicio de sesión con Facebook no está configurado. Por favor, contacta al administrador del sitio.");
            });
        });

        const appleLoginButtonModal = document.getElementById('apple-login-button-modal');
        if(appleLoginButtonModal) appleLoginButtonModal.addEventListener('click', () => {
            console.log("Attempting Apple login...");
            auth.signInWithPopup(new firebase.auth.OAuthProvider('apple.com')).catch(e => {
                console.error("Apple Sign-In Error:", e);
                alert("El inicio de sesión con Apple no está configurado. Por favor, contacta al administrador del sitio.");
            });
        });

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
             if (!turboModal) return;
             turboModal.innerHTML = `<div class="w-full max-w-lg bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 flex flex-col text-center modal-enter"><video autoplay loop muted playsinline class="w-32 h-32 mx-auto mb-4 rounded-full border-4 border-[var(--yanz-yellow)] shadow-lg object-cover"><source src="/assets/videos/perrito_en_moto.mp4" type="video/mp4"></video><h2 class="text-2xl font-bold text-white">¡Hola! Soy Turbo y llevo tu proyecto a la velocidad de la luz 🚀</h2><p class="text-gray-400 mt-2 mb-6">Nuestras entregas, claras y sin sorpresas:</p><div class="space-y-4 text-left"><div class="bg-blue-900/30 border border-blue-700 p-3 rounded-lg"><h4 class="font-bold text-white">Nota de Transparencia: ¡Te lo conseguimos!</h4><p class="text-sm text-gray-300">Para darte el catálogo más completo, trabajamos con los mejores proveedores. Si un artículo no está en nuestra bodega, ¡no te preocupes! Lo conseguimos para ti y te contactaremos por WhatsApp para confirmar la disponibilidad y el tiempo de entrega exacto.</p></div><div class="bg-gray-700/50 p-4 rounded-lg"><h3 class="font-bold text-white text-lg">Envío Express (en Moto 🛵)</h3><p class="text-sm text-gray-400 mb-2">Ideal para pedidos pequeños y urgentes (menores a $300).</p><ul class="text-sm space-y-1"><li><span class="font-semibold text-white">Quito Urbano:</span> $4.00 (<span class="text-green-400 font-bold">GRATIS</span> en compras +$60)</li><li><span class="font-semibold text-white">Valles:</span> $7.00 (<span class="text-green-400 font-bold">GRATIS</span> en compras +$60)</li></ul><p class="text-xs text-gray-400 mt-2">Tiempo de entrega: Menos de 8 horas laborables.</p></div><div class="bg-gray-700/50 p-4 rounded-lg"><h3 class="font-bold text-white text-lg">Carga Pesada (en Camioneta/Camión 🚚)</h3><p class="text-sm text-gray-400 mb-2">Para esos grandes proyectos (pedidos de ferretería de $300 o más).</p><p class="text-lg font-bold text-green-400">¡EL ENVÍO VA POR NUESTRA CUENTA!</p><p class="text-xs text-gray-400 mt-1">Nos contactaremos por WhatsApp para coordinar la logística perfecta para ti.</p></div></div><div class="mt-6"><button class="w-full bg-[var(--yanz-yellow)] text-gray-900 font-bold py-3 px-5 rounded-lg shadow-sm hover:opacity-90" onclick="closeTurboModal()">¡Entendido!</button></div></div>`;
             if(turboModal) turboModal.classList.remove("hidden");
        });

        const openPreciosButton = document.getElementById("precios-button");
        const preciosModal = document.getElementById("precios-modal");
        window.closePreciosModal = () => { if(preciosModal) preciosModal.classList.add("hidden"); };
        if (openPreciosButton) {
            openPreciosButton.addEventListener("click", () => {
                if (!preciosModal) return;
                preciosModal.innerHTML = `
                    <div class="w-full max-w-3xl bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col modal-enter relative text-white">
                        <button onclick="closePreciosModal()" class="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                        <div class="overflow-y-auto pr-4" style="max-height: 80vh;">
                            <h2 class="text-2xl md:text-3xl font-bold text-center mb-4 text-yellow-400">Tu Cocina a tu Medida y Presupuesto</h2>
                            <p class="text-center text-gray-300 mb-6">En YAN'Z SMART WOOD, la transparencia es la base de cada proyecto. Entendemos que el precio es un factor clave, y queremos darte puntos de partida claros y honestos para que planifiques la cocina de tus sueños sin sorpresas.</p>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">Nuestros Puntos de Partida: Calidad y Funcionalidad</h3>
                            <div class="space-y-4 text-left">
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">Opción 1: Muebles Bajos con Bastidor - Desde $90/ML</h4>
                                    <p class="text-sm text-gray-300">La solución más económica. Optimizamos al máximo tu presupuesto con una estructura de bastidor para tus muebles bajos. Esta técnica inteligente utiliza un marco resistente con puertas, reduciendo costos de material sin sacrificar la apariencia frontal.</p>
                                </div>
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">Opción 2: Muebles en Melamina Blanca - Desde $110/ML</h4>
                                    <p class="text-sm text-gray-300">Versatilidad y luminosidad. La opción más popular para lograr espacios modernos y atemporales con un mueble 100% funcional y de cajón completo.</p>
                                </div>
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">Opción 3: Muebles con Frentes Maderados - Desde $140/ML</h4>
                                    <p class="text-sm text-gray-300">Un toque de calidez y diseño. Mantenemos la estructura en melamina blanca para optimizar el costo y revestimos los frentes (puertas y cajones) en tu tono maderado preferido.</p>
                                </div>
                            </div>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">Da el Salto a Acabados Premium</h3>
                             <div class="space-y-4 text-left">
                                <div class="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">Opción 4: Muebles en High Gloss (Alto Brillo) - Desde $220/ML</h4>
                                    <p class="text-sm text-gray-300">El look más moderno y reflectante. El High Gloss ofrece una superficie perfectamente lisa y brillante que amplifica la luz y crea una sensación de lujo y amplitud.</p>
                                    <p class="text-xs text-gray-400 mt-2"><strong>Nota:</strong> Este es un precio base. El valor final puede variar según el color y la marca. Te asesoraremos en detalle.</p>
                                </div>
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">Otras Opciones de Alta Gama</h4>
                                    <p class="text-sm text-gray-300">Si buscas aún más personalización, podemos cotizar tu proyecto en otros materiales premium como Melaminas de Colección (con texturas y colores especiales), MDF Lacado o Termoformado. ¡Las posibilidades son infinitas!</p>
                                </div>
                            </div>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">¿Qué Incluye Siempre Nuestro Precio Base?</h3>
                            <ul class="list-disc list-inside text-gray-300 space-y-2 mb-4">
                                <li>Estructura Completa y Sólida (excepto en la opción de bastidor).</li>
                                <li>Herrajes Funcionales de Calidad: Bisagras rectas y rieles de extensión.</li>
                                <li>Haladeras Estándar: Una selección de modelos modernos incluidos.</li>
                                <li>Instalación Profesional.</li>
                            </ul>
                            <p class="text-xs text-gray-400 mt-2"><strong>Nota Importante:</strong> Mejoras como bisagras de cierre suave, herrajes de alta gama (Blum), iluminación LED, accesorios internos y el mesón se cotizan por separado.</p>

                             <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">El Diseño 3D: Visualiza tu Proyecto</h3>
                            <div class="bg-green-900/30 border border-green-700 p-4 rounded-lg text-center">
                                <p class="text-gray-300">El costo para iniciar tu diseño 3D fotorrealista es de <span class="font-bold text-white">$60</span>.</p>
                                <p class="font-bold text-green-400 text-lg">¡Este valor es 100% REEMBOLSABLE!</p>
                                <p class="text-sm text-gray-300">Se descuenta del abono inicial si decides realizar el proyecto con nosotros.</p>
                            </div>
                        </div>
                        <div class="mt-6">
                            <button class="w-full bg-yellow-500 text-white font-bold py-3 px-5 rounded-lg shadow-sm hover:bg-yellow-600" onclick="closePreciosModal()">¡Entendido!</button>
                        </div>
                    </div>
                `;
                if(preciosModal) preciosModal.classList.remove("hidden");
            });
        }

        const openClosetsPreciosButton = document.getElementById("closets-precios-button");
        const closetsPreciosModal = document.getElementById("closets-precios-modal");
        window.closeClosetsPreciosModal = () => { if(closetsPreciosModal) closetsPreciosModal.classList.add("hidden"); };
        if (openClosetsPreciosButton) {
            openClosetsPreciosButton.addEventListener("click", () => {
                if (!closetsPreciosModal) return;
                closetsPreciosModal.innerHTML = `
                    <div class="w-full max-w-3xl bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col modal-enter relative text-white">
                        <button onclick="closeClosetsPreciosModal()" class="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                        <div class="overflow-y-auto pr-4" style="max-height: 80vh;">
                            <h2 class="text-2xl md:text-3xl font-bold text-center mb-4 text-yellow-400">Optimiza tu Espacio con Estilo: Nuestra Guía de Precios para Clósets</h2>
                            <p class="text-center text-gray-300 mb-6">Un clóset bien diseñado es una inversión en tu comodidad diaria. En YAN'Z SMART WOOD, creamos soluciones a medida que se adaptan a tu espacio y presupuesto. Para darte la máxima transparencia, nuestra guía de precios se basa en el metro cuadrado (m²), calculado multiplicando el alto por el ancho de tu clóset.</p>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">Línea Esencial y Diseño (Acabados en Melamina)</h3>
                            <div class="space-y-4 text-left">
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">1. Solo Interior (Estructura Blanca) - Desde $95 por m²</h4>
                                    <p class="text-sm text-gray-300">Perfecto si ya tienes puertas o buscas una solución abierta tipo walk-in closet. Incluye la estructura interna completa (maletero, divisiones, base) en melamina blanca de alta calidad, con su distribución básica. No incluye puertas.</p>
                                </div>
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">2. Clóset Completo Blanco - Desde $110 por m²</h4>
                                    <p class="text-sm text-gray-300">La opción más luminosa y versátil. Incluye la estructura modular completa en melamina blanca y puertas abatibles o corredizas en el mismo material.</p>
                                </div>
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">3. Clóset Completo Color (Maderado) - Desde $140 por m²</h4>
                                    <p class="text-sm text-gray-300">Calidez y diseño para tu habitación. Incluye la estructura modular completa y puertas en una amplia gama de colores y texturas maderadas.</p>
                                </div>
                                 <div class="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">Opción Económica en Color: Bastidor Maderado - Desde $120 por m²</h4>
                                    <p class="text-sm text-gray-300">¡Diseño a un precio optimizado! Utilizamos una estructura de bastidor (marco frontal) con puertas en el color maderado que elijas. Una solución inteligente para lograr un gran look con un menor costo.</p>
                                </div>
                            </div>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">Línea Premium (Acabados en High Gloss)</h3>
                             <div class="space-y-4 text-left">
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">1. High Gloss con Bastidor - Desde $200 por m²</h4>
                                    <p class="text-sm text-gray-300">El look de alta gama, optimizado. Combinamos la elegancia de las puertas en High Gloss (alto brillo) con una estructura de bastidor para ofrecerte un acabado de lujo a un precio más accesible.</p>
                                </div>
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">2. High Gloss con Cuerpo Completo - Desde $240 por m²</h4>
                                    <p class="text-sm text-gray-300">La experiencia premium total. Tanto la estructura interna como las puertas se fabrican para un acabado cohesivo y de máximo impacto visual con el brillo y la perfección del High Gloss.</p>
                                </div>
                                <p class="text-xs text-gray-400 mt-2"><strong>Nota Importante sobre High Gloss:</strong> Estos precios son un punto de partida. El valor final puede variar según el color, la marca y los detalles del diseño. Te recomendamos una consulta para darte una cotización exacta.</p>
                            </div>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">¿Qué Incluye Siempre Nuestro Precio Base?</h3>
                            <ul class="list-disc list-inside text-gray-300 space-y-2 mb-4">
                                <li>Distribución Básica Funcional: Un tubo para colgar ropa y de 3 a 4 repisas por cada cuerpo del clóset.</li>
                                <li>Herrajes Estándar: Bisagras rectas y haladeras funcionales.</li>
                                <li>Instalación Profesional: Dejamos tu clóset listo para usar.</li>
                            </ul>
                            <p class="text-xs text-gray-400 mt-2">Accesorios como cajoneras, zapateras, iluminación LED o herrajes de cierre suave se cotizan por separado para que personalices tu clóset a tu gusto.</p>

                             <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">El Diseño 3D: Visualiza tu Clóset Ideal</h3>
                            <div class="bg-green-900/30 border border-green-700 p-4 rounded-lg text-center">
                                <p class="text-gray-300">El costo para iniciar tu diseño 3D fotorrealista es de <span class="font-bold text-white">$60</span>.</p>
                                <p class="font-bold text-green-400 text-lg">¡Este valor es 100% REEMBOLSABLE!</p>
                                <p class="text-sm text-gray-300">Se descuenta del abono inicial si decides realizar el proyecto con nosotros.</p>
                            </div>
                        </div>
                        <div class="mt-6">
                            <button class="w-full bg-yellow-500 text-white font-bold py-3 px-5 rounded-lg shadow-sm hover:bg-yellow-600" onclick="closeClosetsPreciosModal()">¡Entendido!</button>
                        </div>
                    </div>
                `;
                if(closetsPreciosModal) closetsPreciosModal.classList.remove("hidden");
            });
        }

        const openPuertasPreciosButton = document.getElementById("puertas-precios-button");
        const puertasPreciosModal = document.getElementById("puertas-precios-modal");
        window.closePuertasPreciosModal = () => { if(puertasPreciosModal) puertasPreciosModal.classList.add("hidden"); };
        if (openPuertasPreciosButton) {
            openPuertasPreciosButton.addEventListener("click", () => {
                if (!puertasPreciosModal) return;
                puertasPreciosModal.innerHTML = `
                    <div class="w-full max-w-3xl bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col modal-enter relative text-white">
                        <button onclick="closePuertasPreciosModal()" class="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                        <div class="overflow-y-auto pr-4" style="max-height: 80vh;">
                            <h2 class="text-2xl md:text-3xl font-bold text-center mb-4 text-yellow-400">Puertas que Definen tu Estilo: Nuestra Guía de Precios</h2>
                            <p class="text-center text-gray-300 mb-6">La puerta es la primera impresión de cualquier espacio. En YAN'Z SMART WOOD, diseñamos y fabricamos puertas modernas a medida en materiales de alta durabilidad como Melamina y MDF, que se integran perfectamente con tu decoración y garantizan un acabado impecable.</p>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">Nuestra Estructura de Precios: Transparencia y Ahorro</h3>
                            <div class="space-y-4 text-left">
                                <div class="bg-gray-700/50 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">Puertas en Melamina o MDF Lacado</h4>
                                    <p class="text-sm text-gray-300 mb-2">Ideal para interiores modernos con acabados lisos y personalizables.</p>
                                    <p class="text-base font-semibold">1. Para Proyectos de Renovación (3+ puertas): <span class="text-yellow-400">Desde $200 c/u</span></p>
                                    <p class="text-base font-semibold">2. Para una Sola Puerta: <span class="text-yellow-400">$320 c/u</span></p>
                                </div>
                                <div class="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
                                    <h4 class="font-bold text-white">Opción Premium: Puertas de Madera Maciza</h4>
                                    <p class="text-sm text-gray-300 mb-2">Para un acabado clásico y de máxima durabilidad. Su precio puede variar según el tipo de madera, secado y laca.</p>
                                    <p class="text-base font-semibold">Precio a consultar (<span class="text-yellow-400">Referencial desde $250 por puerta</span>)</p>
                                    <p class="text-xs text-gray-400 mt-1">Contáctanos para una cotización precisa y personalizada.</p>
                                </div>
                            </div>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">¿Qué Incluye Siempre Nuestro Precio Estándar?</h3>
                            <ul class="list-disc list-inside text-gray-300 space-y-2 mb-4">
                                <li>Hoja de Puerta y Marco: Fabricados a medida en el material y color que elijas.</li>
                                <li>Herrajes Estándar: Bisagras de alta calidad y cerradura funcional.</li>
                                <li>Instalación Profesional.</li>
                            </ul>

                            <div class="border-t border-gray-700 my-4"></div>

                            <h3 class="text-xl font-bold mb-4">Personaliza tu Puerta a tu Gusto (Se Cotiza por Separado)</h3>
                            <p class="text-sm text-gray-300 mb-4">El precio base cubre una puerta funcional y elegante, pero puedes llevarla al siguiente nivel con personalizaciones:</p>
                             <ul class="list-disc list-inside text-gray-300 space-y-2 mb-4">
                                <li>Herrajes de Diseño: Chapas, cerraduras y manijas de alta gama o más económicas.</li>
                                <li>Incrustaciones de Vidrio: Paneles de vidrio esmerilado, transparente, etc.</li>
                                <li>Diseños Especiales: Ranuras, detalles decorativos y más.</li>
                            </ul>

                        </div>
                        <div class="mt-6">
                            <button class="w-full bg-yellow-500 text-white font-bold py-3 px-5 rounded-lg shadow-sm hover:bg-yellow-600" onclick="closePuertasPreciosModal()">¡Entendido!</button>
                        </div>
                    </div>
                `;
                if(puertasPreciosModal) puertasPreciosModal.classList.remove("hidden");
            });
        }
        const menuButton = document.getElementById("menu-button");
        const mobileMenu = document.getElementById("mobile-menu");
        if(menuButton) menuButton.addEventListener("click", () => mobileMenu.classList.toggle("hidden"));
        if(mobileMenu) mobileMenu.querySelectorAll(".mobile-nav-link").forEach(link => link.addEventListener("click", () => mobileMenu.classList.add("hidden")));
        const themeToggle = document.getElementById("theme-toggle");
        const sunIcon = document.getElementById("theme-icon-sun");
        const moonIcon = document.getElementById("theme-icon-moon");
        const applyTheme = (theme) => { document.documentElement.classList.toggle("dark", theme === "dark"); if(sunIcon) sunIcon.classList.toggle("hidden", theme !== "dark"); if(moonIcon) moonIcon.classList.toggle("hidden", theme === "dark"); };
        if(themeToggle) themeToggle.addEventListener("click", () => { const newTheme = document.documentElement.classList.contains("dark") ? "light" : "dark"; localStorage.setItem("theme", newTheme); applyTheme(newTheme); });
        applyTheme(localStorage.getItem("theme") || "dark");
        const yearSpan = document.getElementById("year");
        if(yearSpan) yearSpan.textContent = new Date().getFullYear();
    }

    function setupTabbedInterfaces() {
        const tabContainers = document.querySelectorAll('#tabs-container');
        if (!tabContainers.length) return;

        tabContainers.forEach(container => {
            const tabButtons = container.querySelectorAll('.tab-button');
            const contentContainer = container.nextElementSibling; // Assumes content follows tabs
            if (!contentContainer) return;
            const tabContents = contentContainer.querySelectorAll('.tab-content');

            tabButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault(); // Prevent any default button action
                    const tabId = button.dataset.tab;

                    // Remove active class from all buttons and content panes within this specific tab system
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));

                    // Add active class to the clicked button and corresponding content
                    button.classList.add('active');
                    const activeContent = document.getElementById(tabId);
                    if (activeContent) {
                        activeContent.classList.add('active');
                    }
                });
            });
        });
    }

    function speakText(text, lang = 'es-LA') {
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

    // --- PUNTO DE ENTRADA Y EJECUCIÓN ---
    function renderPaymentLogos() {
        const paymentLogoContainers = document.querySelectorAll('#payment-logos');
        if (paymentLogoContainers.length === 0) return;

        const paymentMethods = [
            'pago-visa.png', 'pago-mastercard.png', 'pago-american-express.png', 'pago-diners-club.png',
            'pago-discover.png', 'pago-jcb.png', 'pago-paypal.png', 'pago-binance-pay.png',
            'pago-banco-pichincha.png', 'pago-banco-guayaquil.png', 'pago-deuna.png', 'pago-peigo.png'
        ];

        const logoPath = `${basePath}/assets/images/metodos-pago/`;

        paymentLogoContainers.forEach(container => {
            container.innerHTML = ''; // Clear any existing content
            paymentMethods.forEach(logoFile => {
                const img = document.createElement('img');
                img.src = `${logoPath}${logoFile}`;
                img.alt = `Logo de ${logoFile.replace('pago-', '').replace('.png', '')}`;
                img.className = "h-6 w-auto object-contain transition-transform hover:scale-110";
                img.loading = 'lazy';
                container.appendChild(img);
            });
        });
    }

    setupGlobalUIListeners();
    initializeFerreteriaPage();
    setupTabbedInterfaces();
    renderPaymentLogos();

    function initializeSwiperCarousels() {
        const swiperContainer = document.querySelector('.mySwiper');
        if (swiperContainer && typeof Swiper !== 'undefined') {
            const swiper = new Swiper('.mySwiper', {
                loop: true,
                autoplay: {
                    delay: 2500,
                    disableOnInteraction: false,
                },
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
            });
        }
    }
    initializeSwiperCarousels();

// --- Lógica para el Slideshow del Hero Banner (VERSIÓN DEFINITIVA) ---
if (document.getElementById('hero-slideshow')) {
    const slideshow = document.getElementById('hero-slideshow');
    const slides = Array.from(slideshow.querySelectorAll('.hero-slide'));

    if (slides.length > 0) {
        // Ordenar el array de imágenes numéricamente
        slides.sort((a, b) => {
            const getNum = (src) => parseInt(src.match(/Presentacion-(\d+)\.jpeg/)?.[1] || 0, 10);
            return getNum(a.src) - getNum(b.src);
        });

        let currentSlide = 0;

        // --- CAMBIO CLAVE: Forzar el estado inicial ---
        // 1. Primero, nos aseguramos de que NINGUNA imagen esté activa.
        slides.forEach(slide => slide.classList.remove('active'));

        // 2. Luego, activamos ÚNICAMENTE la primera imagen del array ya ordenado.
        slides[0].classList.add('active');

        // Iniciar el intervalo para cambiar de imagen cada 4 segundos
        setInterval(() => {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 4000);
    }
}
    if (document.getElementById('preloader')) {
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

        // If running locally via file://, bypass the video timer for tests
        if (window.location.protocol === 'file:') {
            console.log('File protocol detected, bypassing video preloader for testing.');
            setTimeout(startApp, 200); // Short delay to ensure DOM is ready
        } else if (introVideo) {
            introVideo.addEventListener('ended', startApp);
            introVideo.addEventListener('error', startApp);
            setTimeout(startApp, 5000);
        } else {
            startApp();
        }
    } else {
        // If there's no preloader, make sure the page content is visible immediately.
        const pageContent = document.getElementById('page-content');
        if (pageContent) {
            pageContent.classList.add('loaded');
        }
    }
    if (document.getElementById('product-grid')) {
        const productGrid = document.getElementById('product-grid');
        const serviceGrid = document.getElementById('service-grid');
        const videosToLazyLoad = [];
        const slideshowsToInitialize = []; // Array to hold slideshow containers

        const createCategoryCard = (category) => {
            const cardLink = document.createElement('a');
            cardLink.href = category.link;
            cardLink.className = "block bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-[var(--yanz-border)] shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-2";

            const mediaContainer = document.createElement('div');
            // Add 'relative' for absolute positioning of slides
            mediaContainer.className = "overflow-hidden h-48 bg-gray-900 relative";

            if (category.images && category.images.length > 0) {
                // This category has images, so create a slideshow
                category.images.forEach((imageSrc, index) => {
                    const img = document.createElement('img');
                    img.src = imageSrc;
                    img.alt = `${category.title} image ${index + 1}`;
                    // Add a common class for all slides and an 'active' class for the first one
                    img.className = 'category-slide';
                    if (index === 0) {
                        img.classList.add('active');
                    }
                    mediaContainer.appendChild(img);
                });
                // Add the container to a list to be initialized later
                slideshowsToInitialize.push(mediaContainer);
            } else {
                // This category has a video
                const video = document.createElement('video');
                video.className = "w-full h-full object-cover lazy-video";
                video.loop = true;
                video.muted = true;
                video.playsInline = true;

                const source = document.createElement('source');
                source.setAttribute('data-src', category.video);
                source.type = "video/mp4";

                video.appendChild(source);
                mediaContainer.appendChild(video);

                // Collect video for the lazy load observer
                videosToLazyLoad.push(video);
            }

            const cardBody = document.createElement('div');
            cardBody.className = "p-6 flex flex-col flex-grow";
            cardBody.innerHTML = `<div class="flex-grow"><h3 class="text-xl font-bold mb-2">${category.title}</h3><p class="text-sm text-[var(--yanz-text-alt)]">${category.description}</p></div><div class="mt-6 w-full text-center bg-[var(--yanz-primary)] text-white text-sm font-semibold py-2 px-4 rounded-full group-hover:bg-[var(--yanz-secondary)] transition-colors">Explorar Categoría</div>`;
            
            cardLink.appendChild(mediaContainer);
            cardLink.appendChild(cardBody);

            return cardLink;
        };

        const categories = [
            { title: 'Cocinas de Vanguardia', video: 'assets/videos/cocinas.mp4', description: 'El corazón de tu hogar, rediseñado con funcionalidad y un estilo que enamora.', link: 'cocinas/', type: 'product' },
            { title: 'Granitos y Mesones', video: 'assets/videos/Granito.mp4', description: 'Superficies que combinan belleza natural y resistencia para tu hogar.', link: 'granitos/', type: 'product' },
            { title: 'Clósets', video: 'assets/videos/closets.mp4', description: 'Transformamos el orden en un arte, creando soluciones de almacenamiento que se adaptan a tu vida.', link: 'closets/', type: 'product' },
            { title: 'Puertas Modernas', video: 'assets/videos/puertas.mp4', description: 'La primera impresión es inolvidable. Crea una bienvenida espectacular con nuestros diseños.', link: 'puertas/', type: 'product' },
            { title: 'Pisos de Madera Sintética', video: 'assets/videos/pisos.mp4', description: 'La calidez de la madera con una resistencia y durabilidad que superan la prueba del tiempo.', link: 'pisos/', type: 'product' },
            { title: 'Muebles de Baño', video: 'assets/videos/banos.mp4', description: 'Convierte tu baño en un santuario de relajación y elegancia con nuestros muebles a medida.', link: 'banos/', type: 'product' },
            // Placeholder videos for categories without a specific one yet
            { title: 'Gypsum y Luz', video: 'assets/videos/gypsum-luz.mp4', description: 'Esculpe tus techos y paredes con luz, creando ambientes únicos y atmósferas envolventes.', link: 'gypsum/', type: 'product' },
            {
                title: 'Accesorios y Organizadores',
                images: [
                    'assets/images/Accesorios/Accesorio-1.jpg',
                    'assets/images/Accesorios/Accesorio-2.webp',
                    'assets/images/Accesorios/Accesorio-3.jpg',
                    'assets/images/Accesorios/Accesorio-4.png',
                    'assets/images/Accesorios/Accesorio-5.webp',
                    'assets/images/Accesorios/Accesorio-6.webp',
                    'assets/images/Accesorios/Accesorio-7.webp',
                    'assets/images/Accesorios/Accesorio-8.webp',
                    'assets/images/Accesorios/Accesorio-9.webp',
                    'assets/images/Accesorios/Accesorio-10.webp',
                    'assets/images/Accesorios/Accesorio-11.webp'
                ],
                description: 'Los detalles marcan la diferencia. Optimiza cada rincón con nuestras soluciones inteligentes.',
                link: 'accesorios/',
                type: 'product'
            },
            { title: 'Diseño con IA "Aria"', video: 'assets/videos/Asistente.mp4', description: '¿No tienes claro tu diseño? Deja que nuestra Inteligencia Artificial visualice tu espacio ideal.', link: 'aria/', type: 'product' },
            {
                title: 'Renovación y Cuidado del Hogar',
                images: [
                    'assets/images/renovacion/renovacion1.jpeg',
                    'assets/images/renovacion/renovacion2.jpeg',
                    'assets/images/renovacion/renovacion3.jpeg',
                    'assets/images/renovacion/renovacion4.jpeg',
                    'assets/images/renovacion/renovacion5.jpeg',
                    'assets/images/renovacion/renovacion6.jpeg',
                    'assets/images/renovacion/renovacion7.jpeg'
                ],
                description: 'Devolvemos la vida y el brillo a tus espacios. Un servicio integral para que luzcan como nuevos.',
                link: 'renovacion/',
                type: 'service'
            },
            {
                title: 'Herrajes y Ferretería Profesional',
                images: [
                    'assets/images/Ferreteria/ferreteria-1.jpg',
                    'assets/images/Ferreteria/ferreteria-2.webp',
                    'assets/images/Ferreteria/ferreteria-3.jpg',
                    'assets/images/Ferreteria/ferreteria-4.jpeg',
                    'assets/images/Ferreteria/ferreteria-5.jpg',
                    'assets/images/Ferreteria/ferreteria-6.jpg',
                    'assets/images/Ferreteria/ferreteria-7.jpg',
                    'assets/images/Ferreteria/ferreteria-8.jpg',
                    'assets/images/Ferreteria/ferreteria-9.jpg',
                    'assets/images/Ferreteria/ferreteria-10.jpeg',
                    'assets/images/Ferreteria/ferreteria-11.jpeg',
                    'assets/images/Ferreteria/ferreteria-12.jpg'
                ],
                description: 'La base de un gran proyecto. Encuentra la más alta calidad en materiales para tus creaciones.',
                link: 'ferreteria/',
                type: 'service'
            },
            { title: 'Consultoría e Integración de IA', video: 'assets/videos/Asistente-IA.mp4', description: 'Lleva tu negocio al siguiente nivel. Implementamos asistentes de IA para potenciar tus ventas.', link: 'ia-consulting/', type: 'service' }
        ];

        categories.forEach(cat => {
            const card = createCategoryCard(cat);
            if (cat.type === 'product' && productGrid) productGrid.appendChild(card);
            if (cat.type === 'service' && serviceGrid) serviceGrid.appendChild(card);
        });
        
        // Initialize all the slideshows we created
        slideshowsToInitialize.forEach(slideshowContainer => {
            const slides = slideshowContainer.querySelectorAll('.category-slide');
            if (slides.length > 1) {
                let currentSlideIndex = 0;
                setInterval(() => {
                    slides[currentSlideIndex].classList.remove('active');
                    currentSlideIndex = (currentSlideIndex + 1) % slides.length;
                    slides[currentSlideIndex].classList.add('active');
                }, 4000); // Change image every 4 seconds
            }
        });

// --- Intersection Observer for Lazy Loading Videos (VERSIÓN REVISADA) ---
const videoObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
            const source = video.querySelector('source');
            // Si el video tiene un data-src y no una fuente real, es la primera vez que se ve.
            if (source && source.dataset.src && !video.currentSrc) {
                // Asignar la fuente para empezar la carga
                source.src = source.dataset.src;
                video.load();
                // El atributo 'autoplay' es una señal más fuerte para el navegador.
                // El video ya tiene 'muted' y 'playsinline' desde su creación.
                video.setAttribute('autoplay', '');
            }
            // Intenta reproducir el video. Esto funcionará si ya está cargado
            // o si el navegador permite el autoplay después de `load()`.
            // El catch previene errores en la consola si el autoplay es bloqueado.
            video.play().catch(e => console.warn("El autoplay fue prevenido por el navegador.", e));
        } else {
            // Si el video no está visible y ya tiene una fuente cargada, páusalo.
            if (video.currentSrc && !video.paused) {
                video.pause();
            }
        }
    });
}, {
    rootMargin: '0px 0px 200px 0px', // Pre-cargar videos un poco antes para una experiencia más fluida
    threshold: 0.01
});

// El resto del código que observa los videos se mantiene igual
videosToLazyLoad.forEach(video => videoObserver.observe(video));
    }

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
