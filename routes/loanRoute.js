import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createLoan, getMyLoans, getAllLoans, updateLoanStatus, payLoanInstallment } from '../controllers/loanController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js'; // 🔥 Sudah terimport dengan aman bos

const router = express.Router();

// 📁 Pastikan folder lokal 'uploads' otomatis terbuat jika belum ada
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⚙️ Konfigurasi Penyimpanan File Gambar KTP
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ktp-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter File: Memastikan hanya berkas gambar yang boleh masuk
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
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

// 👥 ROUTE SISI USER (Hanya butuh login customer biasa)
// Ditambahkan middleware upload.single('id_card') untuk menangkap file dari form-data react
router.post('/', authMiddleware, upload.single('id_card'), createLoan);
router.get('/me', authMiddleware, getMyLoans);

// 💳 ROUTE PEMBAYARAN CICILAN
router.post('/pay/:id', authMiddleware, payLoanInstallment);

// 👑 ROUTE SISI ADMIN (Proteksi Ganda: Wajib Login & Wajib Akun ber-Role Admin)
router.get('/admin/all', authMiddleware, adminMiddleware, getAllLoans);
router.put('/admin/status/:id', authMiddleware, adminMiddleware, updateLoanStatus);

export default router;