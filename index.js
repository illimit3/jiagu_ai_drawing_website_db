import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { mkdir } from 'fs/promises';
import { router } from './routes/route.js';

const prisma = new PrismaClient();
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use('/', router);

const STABLE_DIFFUSION_API_KEY = process.env.STABLE_DIFFUSION_API_KEY;
const API_HOST = 'https://stablediffusionapi.com/api/v3/text2img';

// Ensure uploads directory exists
try {
  await mkdir('public/uploads', { recursive: true });
} catch (err) {
  if (err.code !== 'EEXIST') {
    console.error('Failed to create uploads directory:', err);
  }
}

// Multer configuration
const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  }
});

// Image upload endpoint
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
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
        title: file.originalname,
        url: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        userId: anonymousUser.id
      }
    });

    res.json({
      id: image.id,
      title: image.title,
      url: image.url,
      createdAt: image.createdAt
    });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Stable Diffusion API endpoints
app.get('/test-api-key', async (req, res) => {
  try {
    if (!STABLE_DIFFUSION_API_KEY) {
      return res.status(400).json({
        status: 'error',
        message: 'API key is not set'
      });
    }

    console.log('Testing API key...');

    const response = await fetch(API_HOST, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: STABLE_DIFFUSION_API_KEY,
        prompt: 'test',
        width: 256,
        height: 256,
        samples: 1,
        num_inference_steps: 1
      }),
    });

    const data = await response.json();

    if (response.ok && !data.error) {
      res.json({
        status: 'success',
        message: 'API key is valid'
      });
    } else {
      res.status(401).json({
        status: 'error',
        message: data.message || 'Invalid API key'
      });
    }
  } catch (error) {
    console.error('API test error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to verify API key'
    });
  }
});

app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt is required'
      });
    }

    const response = await fetch(API_HOST, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: STABLE_DIFFUSION_API_KEY,
        prompt: prompt,
        width: 512,
        height: 512,
        samples: 1,
        num_inference_steps: 20,
        safety_checker: 'yes',
        enhance_prompt: 'yes',
        seed: null,
        guidance_scale: 7.5,
        webhook: null,
        track_id: null
      }),
    });

    const data = await response.json();

    if (data.status === 'processing') {
      res.json({
        status: 'processing',
        fetch_result: data.fetch_url,
        eta: data.eta || 30
      });
    } else if (data.output && data.output[0]) {
      res.json({
        status: 'success',
        imageUrl: data.output[0]
      });
    } else {
      throw new Error(data.message || 'Failed to generate image');
    }
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to generate image'
    });
  }
});

app.get('/fetch-result', async (req, res) => {
  try {
    const { fetch_result } = req.query;

    if (!fetch_result) {
      return res.status(400).json({
        status: 'error',
        message: 'Fetch URL is required'
      });
    }

    const response = await fetch(fetch_result);
    const data = await response.json();

    if (data.status === 'success' && data.output && data.output[0]) {
      res.json({
        status: 'success',
        imageUrl: data.output[0]
      });
    } else if (data.status === 'processing') {
      res.json({
        status: 'processing',
        eta: data.eta || 30
      });
    } else {
      throw new Error(data.message || 'Failed to fetch result');
    }
  } catch (error) {
    console.error('Fetch result error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch result'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export default app;
