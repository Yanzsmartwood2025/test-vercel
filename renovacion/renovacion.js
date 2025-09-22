document.addEventListener('DOMContentLoaded', () => {
    const slidesContainer = document.querySelector('.hero-carousel .slides-container');
    if (!slidesContainer) return;

    const images = [
        '../assets/images/renovacion/renovacion1.jpeg',
        '../assets/images/renovacion/renovacion2.jpeg',
        '../assets/images/renovacion/renovacion3.jpeg',
        '../assets/images/renovacion/renovacion4.jpeg',
        '../assets/images/renovacion/renovacion5.jpeg',
        '../assets/images/renovacion/renovacion6.jpeg',
        '../assets/images/renovacion/renovacion7.jpeg'
    ];

    images.forEach((imgSrc, index) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.style.backgroundImage = `url(${imgSrc})`;
        if (index === 0) {
            slide.classList.add('active');
        }
        slidesContainer.appendChild(slide);
    });

    const slides = document.querySelectorAll('.hero-carousel .slide');
    let currentSlide = 0;

    if (slides.length > 1) {
        setInterval(() => {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 4000);
    }
});
