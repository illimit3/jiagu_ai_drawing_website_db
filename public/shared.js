function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `
        <img src="${image.url}" alt="Image">
        <div class="image-info">
            <div class="image-actions">
                <button onclick="handleLike('${image.id}', this, false)" class="like-btn">
                    ❤ <span class="like-count">0</span>
                </button>
                <button onclick="showComments('${image.id}')" class="comment-btn">💬</button>
            </div>
        </div>
    `;
    return card;
}
// 确保这些函数在全局作用域可用
window.createImageCard = createImageCard;

window.handleLike = async function (imageId, button, isLiked) {
    try {
        const method = isLiked ? 'DELETE' : 'POST';
        const response = await fetch(`/api/images/${imageId}/like`, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const likeCount = button.querySelector('.like-count');
            const currentCount = parseInt(likeCount.textContent);
            likeCount.textContent = isLiked ? currentCount - 1 : currentCount + 1;
            button.classList.toggle('liked');
            button.dataset.isLiked = (!isLiked).toString();
        } else if (response.status === 401) {
            alert('请先登录后再点赞');
        }
    } catch (error) {
        console.error('Failed to update like:', error);
        alert('点赞失败，请重试');
    }
}

async function showComments(imageId) {
    try {
        const response = await fetch(`/api/images/${imageId}/comments`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const comments = await response.json();

        const modal = document.createElement('div');
        modal.className = 'comment-modal';
        modal.innerHTML = `
            <div class="comment-modal-content">
                <h3>评论</h3>
                <div class="comments-list">
                    ${comments.map(comment => `
                        <div class="comment">
                            <strong>${comment.userName || 'Anonymous'}</strong>
                            <p>${comment.content}</p>
                        </div>
                    `).join('')}
                </div>
                <div class="comment-input">
                    <textarea placeholder="写下你的评论..."></textarea>
                    <button onclick="submitComment('${imageId}', this)">发送</button>
                </div>
                <button class="close-modal" onclick="document.body.removeChild(this.parentElement.parentElement)">×</button>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Failed to load comments:', error);
        alert('加载评论失败，请重试');
    }
}

async function submitComment(imageId, button) {
    const textarea = button.parentElement.querySelector('textarea');
    const content = textarea.value.trim();
    if (!content) return;

    try {
        const response = await fetch(`/api/images/${imageId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            const comment = await response.json();
            const commentsList = button.parentElement.parentElement.querySelector('.comments-list');
            commentsList.insertAdjacentHTML('afterbegin', `
                <div class="comment">
                    <strong>Anonymous</strong>
                    <p>${comment.content}</p>
                </div>
            `);
            textarea.value = '';
        }
    } catch (error) {
        console.error('Failed to submit comment:', error);
    }
}