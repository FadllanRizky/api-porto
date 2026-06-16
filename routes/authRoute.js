import express from 'express';
import { login, register, resendEmail, getMe } from '../controllers/authController.js';
import { validateRegister } from '../validations/authValidation.js';
import { authMiddleware } from '../middleware/authMiddleware.js'; // 🔥 Import middleware utama kita

const router = express.Router();

router.post('/login', login);
router.post('/register', validateRegister, register);
router.post('/resend', resendEmail);

// 🔥 JALUR UTAMA: Menyediakan data real-time untuk fungsi refreshUser() di AuthContext frontend
router.get('/me', authMiddleware, getMe);

export default router;