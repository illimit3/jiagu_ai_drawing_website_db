document.addEventListener('DOMContentLoaded', () => {
    loadShowcaseImages();
    const promptInput = document.getElementById('prompt');
    const generateButton = document.getElementById('generate');
    const testApiButton = document.getElementById('test-api');
    const apiStatus = document.getElementById('api-status');
    const generatedImage = document.getElementById('generated-image');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const uploadButton = document.getElementById('uploadButton');
    const imageUpload = document.getElementById('imageUpload');
    const imageShowcase = document.getElementById('imageShowcase');

    let pollingInterval;

    uploadButton.addEventListener('click', () => {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            uploadButton.disabled = true;
            uploadButton.textContent = '上传中...';

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            loadShowcaseImages();
            imageUpload.value = '';
        } catch (error) {
            console.error('Upload failed:', error);
            alert('图片上传失败，请重试');
        } finally {
            uploadButton.disabled = false;
            uploadButton.textContent = '上传图片';
        }
    });

    async function loadShowcaseImages() {
        try {
            const response = await fetch('/api/images');
            const images = await response.json();
            const showcase = document.getElementById('imageShowcase');
            showcase.innerHTML = '';

            // 只显示最新的 6 张图片
            images.slice(0, 6).forEach(image => {
                const card = createImageCard(image);
                showcase.appendChild(card);
            });
        } catch (error) {
            console.error('Failed to load showcase images:', error);
        }
    }

    testApiButton.addEventListener('click', async () => {
        testApiButton.disabled = true;
        apiStatus.style.display = 'block';
        apiStatus.textContent = 'Testing API key...';
        apiStatus.className = '';

        try {
            const response = await fetch('/test-api-key');
            const data = await response.json();

            if (data.status === 'success') {
                apiStatus.textContent = 'API key is valid!';
                apiStatus.className = 'success';
            } else {
                apiStatus.textContent = data.message || 'API key is invalid';
                apiStatus.className = 'error';
            }
        } catch (error) {
            apiStatus.textContent = 'Failed to test API key';
            apiStatus.className = 'error';
        } finally {
            testApiButton.disabled = false;
        }
    });

    async function pollResult(fetchUrl) {
        try {
            const response = await fetch(`/fetch-result?fetch_result=${encodeURIComponent(fetchUrl)}`);
            const data = await response.json();

            if (data.status === 'success') {
                clearInterval(pollingInterval);
                generatedImage.src = data.imageUrl;
                generatedImage.style.display = 'block';
                loadingElement.style.display = 'none';
                generateButton.disabled = false;
            } else if (data.status === 'processing') {
                loadingElement.textContent = `Generating image... ETA: ${data.eta}s`;
            } else {
                throw new Error('Failed to generate image');
            }
        } catch (error) {
            clearInterval(pollingInterval);
            showError('Failed to generate image. Please try again.');
            generateButton.disabled = false;
            loadingElement.style.display = 'none';
        }
    }

    generateButton.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showError('Please enter a prompt');
            return;
        }

        if (pollingInterval) {
            clearInterval(pollingInterval);
        }

        generateButton.disabled = true;
        loadingElement.textContent = 'Generating image...';
        loadingElement.style.display = 'block';
        errorElement.style.display = 'none';
        generatedImage.style.display = 'none';

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate image');
            }

            const data = await response.json();

            if (data.status === 'processing' && data.fetch_result) {
                pollingInterval = setInterval(() => {
                    pollResult(data.fetch_result);
                }, 5000);
            } else if (data.status === 'success') {
                generatedImage.src = data.imageUrl;
                generatedImage.style.display = 'block';
                loadingElement.style.display = 'none';
                generateButton.disabled = false;
            } else {
                throw new Error('Failed to start image generation');
            }
        } catch (error) {
            showError('Failed to generate image. Please try again.');
            generateButton.disabled = false;
            loadingElement.style.display = 'none';
        }
    });

    function showError(message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    // Load initial showcase images
    loadShowcaseImages();
});