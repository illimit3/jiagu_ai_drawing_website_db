document.addEventListener('DOMContentLoaded', () => {
    const fullGallery = document.getElementById('fullGallery');
    const sortFilter = document.getElementById('sortFilter');

    let images = [];

    async function loadImages() {
        try {
            const response = await fetch('/api/images');
            images = await response.json();
            renderGallery();
        } catch (error) {
            console.error('Failed to load images:', error);
        }
    }

    function renderGallery() {
        fullGallery.innerHTML = '';

        const sortedImages = [...images].sort((a, b) => {
            if (sortFilter.value === 'newest') {
                return new Date(b.createdAt) - new Date(a.createdAt);
            } else {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
        });

        sortedImages.forEach(image => {
            const card = createImageCard(image);
            fullGallery.appendChild(card);
        });
    }
    sortFilter.addEventListener('change', renderGallery);
    loadImages();
});