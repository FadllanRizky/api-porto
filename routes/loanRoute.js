import express from 'express';
import multer from 'multer';
import { createLoan, getMyLoans, getAllLoans, updateLoanStatus, payLoanInstallment } from '../controllers/loanController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js'; // 🔥 Sudah terimport dengan aman bos

const router = express.Router();

// NOTE: memoryStorage agar aman di Vercel (filesystem read-only → diskStorage bikin EROFS).
// File KTP diteruskan sebagai buffer lalu diupload ke Supabase Storage oleh loanController.
const storage = multer.memoryStorage();

// Filter File: Memastikan hanya berkas gambar yang boleh masuk
const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Format berkas salah bos! Harus berupa gambar (JPG/PNG).'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Batas maksimal file 5 Megabytes
});

// Bungkus multer agar error-nya selalu JSON (bukan 500 HTML)
const handleMulter = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Ukuran foto KTP maksimal 5MB, bos!' });
      }
      return res.status(400).json({ success: false, error: err.message || 'Gagal memproses file upload.' });
    }
    next();
  });
};

// 👥 ROUTE SISI USER (Hanya butuh login customer biasa)
// Ditambahkan middleware upload.single('id_card') untuk menangkap file dari form-data react
router.post('/', authMiddleware, handleMulter('id_card'), createLoan);
router.get('/me', authMiddleware, getMyLoans);

// 💳 ROUTE PEMBAYARAN CICILAN
router.post('/pay/:id', authMiddleware, payLoanInstallment);

// 👑 ROUTE SISI ADMIN (Proteksi Ganda: Wajib Login & Wajib Akun ber-Role Admin)
router.get('/admin/all', authMiddleware, adminMiddleware, getAllLoans);
router.put('/admin/status/:id', authMiddleware, adminMiddleware, updateLoanStatus);

export default router;
