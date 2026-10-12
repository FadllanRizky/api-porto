import express from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/uploadController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// NOTE: pakai memoryStorage agar aman di Vercel (filesystem read-only, hanya /tmp).
// File diteruskan sebagai buffer lalu diupload ke Supabase Storage bucket 'avatars'.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Format file harus gambar (JPG/PNG/WEBP)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Bungkus multer agar error-nya selalu JSON { success:false, error } (bukan 500 HTML)
const handleMulter = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Ukuran foto maksimal 5MB, bos!' });
      }
      return res.status(400).json({ success: false, error: err.message || 'Gagal memproses file upload.' });
    }
    next();
  });
};

router.post('/avatar', authMiddleware, handleMulter('avatar'), uploadController.uploadAvatar);
router.put('/avatar-url', authMiddleware, uploadController.updateAvatarUrl);

export default router;
