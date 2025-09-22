document.addEventListener('DOMContentLoaded', () => {
    // Check if Firebase is initialized
    if (typeof db === 'undefined') {
        console.error("Firebase (db) no está inicializado. Asegúrate de que firebase-init.js se cargue correctamente.");
        alert("Error: No se pudo conectar a la base de datos.");
        return;
    }

    const experienceForm = document.getElementById('experience-form');
    const experienceBoard = document.getElementById('experience-board');
    const submitButton = document.getElementById('submit-experience');

    const opinionsCollection = db.collection('opiniones');

    // --- GUARDAR UNA NUEVA OPINIÓN ---
    const saveExperience = async (e) => {
        e.preventDefault();

        const authorName = experienceForm.querySelector('#author-name').value.trim();
        const experienceText = experienceForm.querySelector('#experience-text').value.trim();

        if (!authorName || !experienceText) {
            alert("Por favor, completa tu nombre y tu opinión.");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Publicando...';

        try {
            await opinionsCollection.add({
                author: authorName,
                text: experienceText,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            experienceForm.reset();
            console.log("Opinión guardada con éxito.");

        } catch (error) {
            console.error("Error al guardar la opinión: ", error);
            alert("Hubo un error al guardar tu opinión. Por favor, inténtalo de nuevo.");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Publicar Opinión';
        }
    };

    // --- CARGAR Y MOSTRAR OPINIONES ---
    const renderExperience = (doc) => {
        const data = doc.data();

        // Formatear la fecha
        const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString('es-EC', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }) : 'Fecha no disponible';

        const card = document.createElement('div');
        card.className = 'bg-gray-800 p-6 rounded-lg shadow-lg animate-fade-in';

        card.innerHTML = `
            <p class="text-gray-300 italic mb-4">"${data.text}"</p>
            <div class="flex justify-between items-center">
                <h3 class="font-bold text-[var(--yanz-primary)]">- ${data.author}</h3>
                <span class="text-xs text-gray-500">${date}</span>
            </div>
        `;

        experienceBoard.prepend(card); // Añadir las nuevas al principio
    };

    const loadExperiences = () => {
        opinionsCollection.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            experienceBoard.innerHTML = ''; // Limpiar el tablero para evitar duplicados
            if (snapshot.empty) {
                experienceBoard.innerHTML = '<p class="text-center text-gray-500">¡Sé el primero en dejar tu opinión!</p>';
            } else {
                snapshot.forEach(doc => {
                    renderExperience(doc);
                });
            }
        }, error => {
            console.error("Error al cargar las opiniones: ", error);
            experienceBoard.innerHTML = '<p class="text-center text-red-500">No se pudieron cargar las opiniones. Inténtalo de nuevo más tarde.</p>';
        });
    };

    // --- INICIALIZACIÓN ---
    experienceForm.addEventListener('submit', saveExperience);
    loadExperiences();

    // Pequeña animación para el tablero al cargar la página
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
});
