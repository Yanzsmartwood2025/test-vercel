// YAN'Z SMART WOOD - Centralized Firebase Initializer

// This configuration was extracted from ferreteria/index.html
const firebaseConfig = {
    apiKey: "AIzaSyC3ENgMXZWAHu7r8l-0z1Iva8CbML_Z26o",
    authDomain: "yan-z-smart-wood.firebaseapp.com",
    projectId: "yan-z-smart-wood",
    storageBucket: "yan-z-smart-wood.appspot.com",
    messagingSenderId: "369287615235",
    appId: "1:369287615235:web:654e1e6fb48b4f634f8f36"
};

// Declare variables in the global scope to be accessible by other scripts
let app, auth, db;

try {
    // Initialize Firebase
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log("Firebase Central Engine Initialized Successfully.");
} catch (error) {
    console.error("Fatal Error: Could not initialize Firebase.", error);
    // Display a user-friendly error message on the page
    document.body.innerHTML = `
        <div style="text-align: center; padding: 40px; font-family: sans-serif;">
            <h1>Error de Conexión</h1>
            <p>No se pudo iniciar la aplicación. Por favor, revisa tu conexión a internet e inténtalo de nuevo más tarde.</p>
        </div>`;
}
