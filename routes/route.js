import express from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
export const router = express.Router();
const prisma = new PrismaClient();

// Image upload configuration
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Upload image
router.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let anonymousUser = await prisma.user.findFirst({
            where: { email: 'anonymous@example.com' }
        });

        if (!anonymousUser) {
            anonymousUser = await prisma.user.create({
                data: {
                    name: 'Anonymous',
                    email: 'anonymous@example.com'
                }
            });
        }

        const image = await prisma.image.create({
            data: {
                title: req.file.originalname,
                url: `/uploads/${req.file.filename}`,
                mimeType: req.file.mimetype,
                userId: anonymousUser.id
            }
        });

        res.json(image);
    } catch (error) {
        console.error('Failed to upload image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Get all images with likes and comments count
router.get('/api/images', async (req, res) => {
    try {
        const images = await prisma.image.findMany({
            include: {
                _count: {
                    select: {
                        likes: true,
                        comments: true
                    }
                },
                user: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // 添加完整的访问路径并保留计数
        const imagesWithPaths = images.map(image => ({
            ...image,
            likeCount: image._count.likes,
            commentCount: image._count.comments,
            userName: image.user.name,
            _count: undefined,
            user: undefined
        }));

        res.json(imagesWithPaths);
    } catch (error) {
        console.error('Failed to fetch images:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

// Like or unlike an image
router.post('/api/images/:id/like', async (req, res) => {
    try {
        const imageId = req.params.id;

        let anonymousUser = await prisma.user.findFirst({
            where: { email: 'anonymous@example.com' }
        });

        if (!anonymousUser) {
            anonymousUser = await prisma.user.create({
                data: {
                    name: 'Anonymous',
                    email: 'anonymous@example.com'
                }
            });
        }

        const existingLike = await prisma.like.findFirst({
            where: {
                imageId: imageId,
                userId: anonymousUser.id
            }
        });

        if (existingLike) {
            // Unlike the image
            await prisma.like.delete({
                where: { id: existingLike.id }
            });
        } else {
            // Like the image
            await prisma.like.create({
                data: {
                    imageId: imageId,
                    userId: anonymousUser.id
                }
            });
        }

        const likeCount = await prisma.like.count({
            where: { imageId: imageId }
        });

        res.json({ likeCount });
    } catch (error) {
        console.error('Failed to like/unlike image:', error);
        res.status(500).json({ error: 'Failed to like/unlike image' });
    }
});

// Comment on an image
router.post('/api/images/:id/comments', async (req, res) => {
    try {
        const imageId = req.params.id;
        const { content } = req.body;
        let anonymousUser = await prisma.user.findFirst({
            where: { email: 'anonymous@example.com' }
        });

        if (!anonymousUser) {
            anonymousUser = await prisma.user.create({
                data: {
                    name: 'Anonymous',
                    email: 'anonymous@example.com'
                }
            });
        }
        const comment = await prisma.comment.create({
            data: {
                content,
                imageId: imageId,
                userId: anonymousUser.id
            },
            include: {
                user: {
                    select: {
                        name: true
                    }
                }
            }
        });
        res.json({
            ...comment,
            userName: comment.user.name,
            user: undefined
        });
    } catch (error) {
        console.error('Failed to comment on image:', error);
        res.status(500).json({ error: '评论失败，请重试' });
    }
});

// Get comments for an image
router.get('/api/images/:id/comments', async (req, res) => {
    try {
        const imageId = req.params.id;
        const comments = await prisma.comment.findMany({
            where: { imageId: imageId },
            include: {
                user: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(comments.map(comment => ({
            ...comment,
            userName: comment.user.name,
            user: undefined
        })));
    } catch (error) {
        console.error('Failed to fetch comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

export default router; 