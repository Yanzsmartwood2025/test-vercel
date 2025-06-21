/**
 * =================================================================
 * YAN'Z SMART WOOD - MOTOR GLOBAL v3.3 (carrito-yanz.js)
 * -----------------------------------------------------------------
 * Este script centraliza toda la lógica de la aplicación,
 * incluyendo Firebase, autenticación, carrito de compras y
 * la interfaz de usuario dinámica.
 * Debe ser incluido en TODAS las páginas del sitio.
 * =================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE ---
    // Asegúrate de que esta configuración sea correcta.
    const firebaseConfig = {
        apiKey: "AIzaSyC3ENgMXZWAHu7r8l-0z1Iva8CbML_Z26o",
        authDomain: "yan-z-smart-wood.firebaseapp.com",
        projectId: "yan-z-smart-wood",
        storageBucket: "yan-z-smart-wood.appspot.com",
        messagingSenderId: "369287615235",
        appId: "1:369287615235:web:654e1e6fb48b4f634f8f36"
    };

    // Variables globales para los servicios de Firebase y estado del usuario.
    let app, auth, db, currentUser = null,
        cartUnsubscribe = null;

    try {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("Motor Global YANZ v3.3 Inicializado.");
    } catch (error) {
        console.error("Error Fatal: No se pudo inicializar Firebase.", error);
        // Muestra un mensaje de error si Firebase no carga.
        document.body.innerHTML = '<div style="text-align: center; padding: 40px; font-family: sans-serif;"><h1>Error de Conexión</h1><p>No se pudo iniciar la aplicación. Por favor, revisa tu conexión a internet e inténtalo de nuevo más tarde.</p></div>';
        return; // Detiene la ejecución si Firebase falla.
    }

    // --- 1.1. LÓGICA DE SÍNTESIS DE VOZ (ARIA) ---
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
            if (spanishVoice) {
                utterance.voice = spanishVoice;
            }
            
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } else {
            console.warn("La síntesis de voz no es soportada en este navegador.");
        }
    }

    if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    
    // --- 1.2. Mensaje de Bienvenida de Aria (SOLO en la página de ferretería) ---
    // Se comprueba si existe el contenedor de búsqueda de Aria para dar la bienvenida.
    if (document.getElementById('aria-search')) {
        setTimeout(() => {
            const welcomeMessage = "Hola. Bienvenido a YAN'Z SMART WOOD. Soy Aria, tu asistente virtual de ferretería. Estoy aquí para ayudarte a encontrar todo lo que necesitas para tu proyecto. Dime qué buscas y te ayudaré al instante.";
            speakText(welcomeMessage);
        }, 1500);
    }


    // --- 2. LÓGICA DEL CARRITO DE COMPRAS (GLOBAL) ---
    let localCart = [];
    const loadLocalCart = () => {
        localCart = JSON.parse(localStorage.getItem('yanzGuestCart') || '[]');
        updateCartUI();
    };
    const saveLocalCart = () => {
        localStorage.setItem('yanzGuestCart', JSON.stringify(localCart));
        updateCartUI();
    };
    const getCart = () => currentUser ? (window.firestoreCart || []) : localCart;
    const saveCartToFirestore = async (cartData) => {
        if (!currentUser) return;
        try {
            await db.collection('userCarts').doc(currentUser.uid).set({
                items: cartData
            });
        } catch (error) {
            console.error("Error guardando el carrito en Firestore:", error);
        }
    };
    const updateCartItem = (item, quantityChange) => {
        let cart = getCart();
        const existingItemIndex = cart.findIndex(cartItem => cartItem.id === item.id);

        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += quantityChange;
            if (cart[existingItemIndex].quantity <= 0) {
                cart.splice(existingItemIndex, 1);
            }
        } else if (quantityChange > 0) {
            cart.push({ ...item,
                quantity: quantityChange
            });
        }

        if (currentUser) {
            saveCartToFirestore(cart);
        } else {
            localCart = cart;
            saveLocalCart();
        }
    };

    // Funciones globales para ser llamadas desde el HTML
    window.addItemToCart = (item) => updateCartItem(item, (item.quantity || 1));
    window.increaseQuantity = (itemId, itemData) => updateCartItem(itemData, 1);
    window.decreaseQuantity = (itemId, itemData) => updateCartItem(itemData, -1);
    window.removeItemFromCart = (itemId, itemData) => updateCartItem(itemData, -itemData.quantity);

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
        // Actualiza la UI de productos si la función existe en la página actual
        if (typeof renderFerreteriaUI === 'function') {
            renderFerreteriaUI();
        }
        // Actualiza la UI de la caja si la función existe
        if (typeof renderCajaUI === 'function') {
            renderCajaUI(cart);
        }
    };

    // --- 3. LÓGICA DE AUTENTICACIÓN (GLOBAL) ---
    const authContainer = document.getElementById('auth-container');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModalButton = document.getElementById('close-auth-modal-button');
    const googleLoginButtonModal = document.getElementById('google-login-button-modal');

    const signInWithGoogle = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        auth.signInWithPopup(provider).catch((error) => console.error("Error de SignIn:", error));
    };

    const signOutUser = () => {
        auth.signOut().catch((error) => console.error("Error de SignOut:", error));
    };

    auth.onAuthStateChanged(async (user) => {
        if (cartUnsubscribe) {
            cartUnsubscribe();
            cartUnsubscribe = null;
        }
        currentUser = user;

        if (user) { // Usuario ha iniciado sesión
            renderAuthUI(user);
            const cartRef = db.collection('userCarts').doc(user.uid);
            const guestCart = JSON.parse(localStorage.getItem('yanzGuestCart') || '[]');
            
            // Si hay un carrito de invitado, lo fusionamos con el de Firestore
            if (guestCart.length > 0) {
                const firestoreDoc = await cartRef.get();
                const firestoreItems = firestoreDoc.exists ? firestoreDoc.data().items : [];
                guestCart.forEach(localItem => {
                    const existingItem = firestoreItems.find(fsItem => fsItem.id === localItem.id);
                    if (existingItem) {
                        existingItem.quantity += localItem.quantity;
                    } else {
                        firestoreItems.push(localItem);
                    }
                });
                await cartRef.set({ items: firestoreItems });
                localStorage.removeItem('yanzGuestCart'); // Limpiamos el carrito local
            }
            
            // Escuchamos cambios en el carrito de Firestore en tiempo real
            cartUnsubscribe = cartRef.onSnapshot((doc) => {
                window.firestoreCart = doc.exists ? doc.data().items : [];
                updateCartUI();
                const cartModalEl = document.getElementById('cart-modal');
                if (cartModalEl && !cartModalEl.classList.contains('hidden')) renderCartModal();
            }, (error) => console.error("Error de Snapshot:", error));
            
            if(authModal) authModal.classList.add('hidden');

        } else { // Usuario no ha iniciado sesión (invitado)
            window.firestoreCart = [];
            renderAuthUI(null);
            loadLocalCart(); // Cargamos el carrito desde localStorage
        }
    });

    const renderAuthUI = (user) => {
        if (!authContainer) return;

        if (user) {
            const userImage = user.photoURL ? `<img src="${user.photoURL}" alt="${user.displayName}" class="w-full h-full object-cover">` : `<span class="text-white font-bold text-xl">${user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</span>`;
            authContainer.innerHTML = `<div class="relative"><button id="user-menu-button" title="Mi Cuenta" class="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm overflow-hidden border-2 border-gray-500 hover:border-gray-400 bg-gray-700">${userImage}</button><div id="user-menu-dropdown" class="hidden absolute top-full right-0 mt-2 w-56 bg-[var(--yanz-header-bg)] border border-gray-700 rounded-lg shadow-xl z-50"><div class="px-4 py-3 border-b border-gray-700"><p class="text-sm font-semibold text-white truncate">${user.displayName || 'Usuario'}</p><p class="text-xs text-gray-400 truncate">${user.email || 'Sin email'}</p></div><div class="py-1"><a href="#" id="logout-button-menu" class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"><svg class="w-4 h-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Cerrar Sesión</a></div></div></div>`;
            
            const userMenuButton = document.getElementById('user-menu-button');
            const userMenuDropdown = document.getElementById('user-menu-dropdown');
            const logoutButtonMenu = document.getElementById('logout-button-menu');

            userMenuButton.addEventListener('click', (event) => {
                event.stopPropagation();
                userMenuDropdown.classList.toggle('hidden');
            });
            logoutButtonMenu.addEventListener('click', (e) => {
                e.preventDefault();
                userMenuDropdown.classList.add('hidden');
                signOutUser();
            });
            window.addEventListener('click', (event) => {
                if (userMenuDropdown && !userMenuDropdown.classList.contains('hidden') && !userMenuButton.contains(event.target) && !userMenuDropdown.contains(event.target)) {
                    userMenuDropdown.classList.add('hidden');
                }
            });
        } else {
            authContainer.innerHTML = `<button id="open-auth-modal-button" title="Acceder o Registrarse" class="w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm overflow-hidden"><video autoplay loop muted playsinline class="w-full h-full object-cover"><source src="/assets/videos/login-icon.mp4" type="video/mp4"></video></button>`;
            document.getElementById('open-auth-modal-button').addEventListener('click', () => authModal.classList.remove('hidden'));
        }
    };
    
    if(googleLoginButtonModal) googleLoginButtonModal.addEventListener('click', signInWithGoogle);
    if(closeAuthModalButton) closeAuthModalButton.addEventListener('click', () => authModal.classList.add('hidden'));
    if(authModal) authModal.addEventListener('click', (event) => { if (event.target === authModal) authModal.classList.add('hidden'); });

    
    // --- 4. LÓGICA ESPECÍFICA DE PÁGINAS ---
    
    // 4.1 Lógica para la página de Ferretería
    const ferreteriaCategorias = [ 
        { title:"Herramientas Manuales", products:[ 
            {id:"fer001", name:"Martillo de Carpintero", image:"/assets/images/productos/martillo.jpg", type: 'sale', price: 12.50}, 
            {id:"fer002", name:"Martillo de Goma", image:"/assets/images/productos/martillo_goma.jpg", type: 'sale', price: 8.00}, 
            {id:"fer003", name:"Alicate de Presión 8\"", image:"/assets/images/productos/alicate.jpg", type: 'sale', price: 15.00} 
        ]}, 
        { title:"Tornillería y Anclajes", products:[ 
            {id:"fer004", name:"Tornillos para madera (Caja 100u)", image:"/assets/images/productos/tornillos.jpg", type: 'sale', price: 5.50} 
        ]}, 
        {title:"Herramientas Eléctricas",products:[]}, 
        {title:"Adhesivos y Selladores",products:[]}, 
        {title:"Obra Gris y Construcción",products:[]}, 
        {title:"Pintura y Acabados",products:[]} 
    ];
    
    const acordeonContainer = document.getElementById("ferreteria-acordeon");
    
    function renderFerreteriaUI() {
        if (!acordeonContainer) return;
        acordeonContainer.querySelectorAll('.product-card').forEach(card => {
            const productId = card.dataset.productId;
            const actionContainer = card.querySelector('.action-container');
            const product = ferreteriaCategorias.flatMap(c => c.products).find(p => p.id === productId);

            if (!product || !actionContainer) return;

            const cartItem = getCart().find(item => item.id === productId);
            let buttonHtml;

            if (cartItem) {
                buttonHtml = `<div class="quantity-selector mt-auto"><button class="quantity-btn minus-btn" data-product-id="${product.id}">-</button><span class="quantity-display">${cartItem.quantity}</span><button class="quantity-btn plus-btn" data-product-id="${product.id}">+</button></div>`;
            } else {
                buttonHtml = `<button class="add-to-cart-btn mt-auto w-full bg-[var(--yanz-primary)] hover:bg-[var(--yanz-secondary)] text-white font-bold py-2 px-4 rounded-full transition-colors" data-product-id="${product.id}">${product.type === 'sale' ? 'Agregar a Coti' : 'Agregar para Cotizar'}</button>`;
            }
            actionContainer.innerHTML = buttonHtml;
        });
    }

    function buildAccordion() {
        if (!acordeonContainer) return;
        acordeonContainer.innerHTML = "";
        ferreteriaCategorias.forEach((category, index) => {
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
                    productDiv.innerHTML = `<img src="${product.image}" alt="${product.name}" class="w-full h-32 object-cover rounded-md mb-4"><h4 class="font-semibold mb-2 flex-grow">${product.name}</h4>${product.price ? `<p class="font-bold text-lg text-[var(--yanz-primary)] mb-4">$${product.price.toFixed(2)}</p>` : ''}<div class="action-container"></div>`;
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
    
    if (acordeonContainer) {
        buildAccordion(); // Construir el acordeón si estamos en la página correcta
        acordeonContainer.addEventListener('click', (e) => {
            const target = e.target;
            const categoryButton = target.closest('.acordeon-boton');
            if (categoryButton) {
                const panel = categoryButton.nextElementSibling;
                const isOpen = panel.classList.contains('open');
                acordeonContainer.querySelectorAll('.panel-productos.open').forEach(p => {
                    if (p !== panel) {
                        p.classList.remove('open');
                        p.style.maxHeight = null;
                    }
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
                const product = ferreteriaCategorias.flatMap(c => c.products).find(p => p.id === productId);
                if (!product) return;

                if (actionButton.classList.contains('add-to-cart-btn')) {
                    window.addItemToCart(product);
                } else if (actionButton.classList.contains('plus-btn')) {
                    window.increaseQuantity(productId, product);
                } else if (actionButton.classList.contains('minus-btn')) {
                    window.decreaseQuantity(productId, product);
                }
            }
        });
    }

    const ariaInput = document.getElementById("aria-input");
    const ariaSearchButton = document.getElementById("aria-search-button");
    const ariaResultsContainer = document.getElementById("aria-results");

    function performSearch() {
        const query = ariaInput.value.toLowerCase().trim();
        if (!query) {
            speakText("Por favor escribe lo que estás buscando para que pueda ayudarte");
            return;
        }

        ariaResultsContainer.innerHTML = '<p class="text-center text-[var(--yanz-text-alt)]">Buscando...</p>';
        speakText(`Un momento estoy buscando ${query} para ti`);

        let results = {};
        let totalFound = 0;
        ferreteriaCategorias.forEach((category, index) => {
            const matchingProducts = category.products.filter(p => p.name.toLowerCase().includes(query));
            if (matchingProducts.length > 0) {
                if (!results[index]) {
                    results[index] = { count: 0, title: category.title };
                }
                results[index].count += matchingProducts.length;
                totalFound += matchingProducts.length;
            }
        });

        setTimeout(() => {
            ariaResultsContainer.innerHTML = "";
            let speechOutput;
            if (Object.keys(results).length > 0) {
                speechOutput = `Listo Encontré ${totalFound} ${totalFound === 1 ? 'producto' : 'productos'} para ${query} Te muestro dónde están`;
                Object.keys(results).forEach(index => {
                    const resultDiv = document.createElement("div");
                    resultDiv.className = "bg-[var(--yanz-bg-alt)] border border-[var(--yanz-border)] p-4 rounded-lg mb-2 flex justify-between items-center cursor-pointer hover:border-[var(--yanz-primary)]";
                    resultDiv.innerHTML = `<div><span class="font-bold">"${ariaInput.value}"</span><p class="text-sm text-[var(--yanz-text-alt)]">Encontrado en: ${results[index].title} (${results[index].count} ${results[index].count > 1 ? "productos" : "producto"})</p></div><span class="text-[var(--yanz-primary)] font-bold">Ver &rarr;</span>`;
                    resultDiv.addEventListener("click", () => {
                        const categoryEl = acordeonContainer.querySelector(`.acordeon-boton[data-category-index='${index}']`);
                        if (categoryEl) {
                            if (!categoryEl.nextElementSibling.classList.contains('open')) {
                                categoryEl.click();
                            }
                            categoryEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                    });
                    ariaResultsContainer.appendChild(resultDiv);
                });
            } else {
                speechOutput = `Lo siento no encontré nada parecido a ${query} Pero no te preocupes puedes usar el botón de Turbo para que te lo consigamos`;
                ariaResultsContainer.innerHTML = `<p class="text-center text-[var(--yanz-text-alt)]">Lo siento, no encontré nada parecido a "${ariaInput.value}". Puedes pedirle ayuda a Turbo para conseguirlo.</p>`;
            }
            speakText(speechOutput);
        }, 800);
    }
    
    if(ariaSearchButton) ariaSearchButton.addEventListener("click", performSearch);
    if(ariaInput) ariaInput.addEventListener("keypress", e => { if (e.key === "Enter") performSearch(); });


    // --- 5. LÓGICA DE MODALES (GLOBAL) ---
    const cartModal = document.getElementById('cart-modal');
    const openCartButton = document.getElementById('open-cart-button');
    const turboModal = document.getElementById("turbo-modal");
    const openTurboButton = document.getElementById("turbo-button");

    window.closeCartModal = () => { if(cartModal) cartModal.classList.add('hidden') };
    if(openCartButton) openCartButton.addEventListener('click', () => {
        renderCartModal();
        if(cartModal) cartModal.classList.remove('hidden');
    });

    window.closeTurboModal = () => { if(turboModal) turboModal.classList.add("hidden") };
    if(openTurboButton) openTurboButton.addEventListener("click", () => {
        renderTurboModal();
        if(turboModal) turboModal.classList.remove("hidden");
    });
    
    function renderCartModal() {
        if (!cartModal) return;
        const cart = getCart();
        const saleItems = cart.filter(item => item.type === 'sale');
        let saleTotal = saleItems.reduce((total, item) => total + (item.price * item.quantity), 0);
        const checkoutButtonHtml = saleItems.length > 0 ? `<a href="/caja.html" class="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-base font-semibold text-white bg-green-500 rounded-lg shadow-sm hover:bg-green-600"><span>Ir a Pagar ($${saleTotal.toFixed(2)})</span></a>` : '';
        const quoteMessage = "Hola, me gustaría cotizar:\n" + cart.map(item => `- ${item.name} (x${item.quantity})`).join("\n");
        const quoteButtonHtml = cart.length > 0 ? `<a href="https://wa.me/593996480843?text=${encodeURIComponent(quoteMessage)}" target="_blank" class="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700"><span>Solicitar Cotización de Todo</span></a>` : '';
        const cartItemsHtml = cart.length === 0 ? `<p class="text-gray-400 py-8 text-center">Tu carrito está vacío.</p>` : cart.map(item => `<div class="flex justify-between items-center py-3"><span class="text-gray-300 pr-2 flex-grow">${item.name}</span><div class="flex items-center gap-2 text-white"><button onclick="decreaseQuantity('${item.id}', ${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors">-</button><span class="w-8 text-center">${item.quantity}</span><button onclick="increaseQuantity('${item.id}', ${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors">+</button></div></div>`).join("");
        
        cartModal.innerHTML = `<div class="w-full max-w-md bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 flex flex-col modal-enter"><div class="text-center mb-6"><video autoplay loop muted playsinline class="w-24 h-24 mx-auto mb-2 rounded-full border-4 border-[var(--yanz-primary)] shadow-lg"><source src="/assets/videos/video-carrito.mp4" type="video/mp4"></video><h2 class="text-2xl font-bold text-white">¡Hola, soy Coti!</h2><p class="text-gray-300 text-sm mt-1 px-4">Tu asistente de proyectos. Aquí guardaré tus ideas.</p></div><div class="border-t border-gray-700 pt-4 flex-grow overflow-y-auto" style="max-height: 40vh;"><div class="divide-y divide-gray-700 text-left">${cartItemsHtml}</div></div><div class="mt-auto pt-4 space-y-3">${checkoutButtonHtml}${quoteButtonHtml}<button class="mt-2 text-sm text-gray-400 hover:text-white w-full" onclick="closeCartModal()">Cerrar</button></div></div>`;
    }

    function renderTurboModal() {
        if (!turboModal) return;
        turboModal.innerHTML = `<div class="w-full max-w-lg bg-[var(--yanz-header-bg)] rounded-2xl shadow-2xl p-6 flex flex-col text-center modal-enter">
            <video autoplay loop muted playsinline class="w-32 h-32 mx-auto mb-4 rounded-full border-4 border-[var(--yanz-yellow)] shadow-lg object-cover"><source src="/assets/videos/perrito_en_moto.mp4" type="video/mp4"></video>
            <h2 class="text-2xl font-bold text-white">¡Hola! Soy Turbo y llevo tu proyecto a la velocidad de la luz 🚀</h2>
            <p class="text-gray-400 mt-2 mb-6">Nuestras entregas, claras y sin sorpresas:</p>
            <div class="space-y-4 text-left">
                <div class="bg-blue-900/30 border border-blue-700 p-3 rounded-lg"><h4 class="font-bold text-white">Nota de Transparencia: ¡Te lo conseguimos!</h4><p class="text-sm text-gray-300">Para darte el catálogo más completo, trabajamos con los mejores proveedores. Si un artículo no está en nuestra bodega, ¡no te preocupes! Lo conseguimos para ti y te contactaremos por WhatsApp para confirmar la disponibilidad y el tiempo de entrega exacto.</p></div>
                <div class="bg-gray-700/50 p-4 rounded-lg"><h3 class="font-bold text-white text-lg">Envío Express (en Moto 🛵)</h3><p class="text-sm text-gray-400 mb-2">Ideal para pedidos pequeños y urgentes (menores a $300).</p><ul class="text-sm space-y-1"><li><span class="font-semibold text-white">Quito Urbano:</span> $4.00 (<span class="text-green-400 font-bold">GRATIS</span> en compras +$60)</li><li><span class="font-semibold text-white">Valles:</span> $7.00 (<span class="text-green-400 font-bold">GRATIS</span> en compras +$60)</li></ul><p class="text-xs text-gray-400 mt-2">Tiempo de entrega: Menos de 8 horas laborables.</p></div>
                <div class="bg-gray-700/50 p-4 rounded-lg"><h3 class="font-bold text-white text-lg">Carga Pesada (en Camioneta/Camión 🚚)</h3><p class="text-sm text-gray-400 mb-2">Para esos grandes proyectos (pedidos de ferretería de $300 o más).</p><p class="text-lg font-bold text-green-400">¡EL ENVÍO VA POR NUESTRA CUENTA!</p><p class="text-xs text-gray-400 mt-1">Nos contactaremos por WhatsApp para coordinar la logística perfecta para ti.</p></div>
            </div>
            <div class="mt-6"><button class="w-full bg-[var(--yanz-yellow)] text-gray-900 font-bold py-3 px-5 rounded-lg shadow-sm hover:opacity-90" onclick="closeTurboModal()">¡Entendido!</button></div>
        </div>`;
    }

    // --- 6. INICIALIZACIÓN DE UI GENERAL (GLOBAL) ---
    const menuButton = document.getElementById("menu-button");
    const mobileMenu = document.getElementById("mobile-menu");
    if(menuButton) menuButton.addEventListener("click", () => mobileMenu.classList.toggle("hidden"));
    if(mobileMenu) mobileMenu.querySelectorAll(".mobile-nav-link").forEach(link => link.addEventListener("click", () => mobileMenu.classList.add("hidden")));

    const themeToggle = document.getElementById("theme-toggle");
    const sunIcon = document.getElementById("theme-icon-sun");
    const moonIcon = document.getElementById("theme-icon-moon");
    const applyTheme = (theme) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        if(sunIcon) sunIcon.classList.toggle("hidden", theme !== "dark");
        if(moonIcon) moonIcon.classList.toggle("hidden", theme === "dark");
    };
    if(themeToggle) themeToggle.addEventListener("click", () => {
        const newTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
        localStorage.setItem("theme", newTheme);
        applyTheme(newTheme);
    });
    applyTheme(localStorage.getItem("theme") || "dark");

    const paymentLogosContainer = document.getElementById("payment-logos");
    if (paymentLogosContainer) {
        const paymentMethods = [{name:"PeiGo",image:"/assets/images/pago-peigo.png"},{name:"Mastercard",image:"/assets/images/pago-mastercard.png"},{name:"Visa",image:"/assets/images/pago-visa.png"},{name:"American Express",image:"/assets/images/pago-american-express.png"},{name:"Discover",image:"/assets/images/pago-discover.png"},{name:"JCB",image:"/assets/images/pago-jcb.png"},{name:"Diners Club",image:"/assets/images/pago-diners-club.png"},{name:"PayPal",image:"/assets/images/pago-paypal.png"},{name:"Binance Pay",image:"/assets/images/pago-binance-pay.png"},{name:"Banco Guayaquil",image:"/assets/images/pago-banco-guayaquil.png"},{name:"Banco Pichincha",image:"/assets/images/pago-banco-pichincha.png"},{name:"DeUna",image:"/assets/images/pago-deuna.png"}];
        paymentLogosContainer.innerHTML = paymentMethods.map(m => `<img src="${m.image}" alt="${m.name}" title="${m.name}" class="h-8 bg-white rounded-md p-1">`).join('');
    }

    const yearSpan = document.getElementById("year");
    if(yearSpan) yearSpan.textContent = new Date().getFullYear();

});
