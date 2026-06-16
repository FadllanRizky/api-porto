import { authService } from '../services/authService.js';
import { supabase } from '../config/db.js';

// 🔐 REGISTER
export const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    const result = await authService.register({
      email,
      password,
      full_name
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// 🔐 LOGIN (DITWEAK BIAR LANGSUNG DETEKSI ADMIN / USER)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Jalankan login default bawaan authService lu
    const result = await authService.login(email, password);

    // Ambil user data dan token dari hasil login (antisipasi variasi struktur response)
    const authUser = result?.user || result?.data?.user || result;
    const sessionToken = result?.token || result?.access_token || result?.data?.session?.access_token;

    if (!authUser || !authUser.id) {
      return res.json(result); // Jaga-jaga jika format berbeda, kembalikan data asli
    }

    // 2. 🔥 KUNCI EMAS: Cek apakah ID UUID ini terdaftar di tabel khusus 'admins'
    const { data: adminData } = await supabase
      .from('admins')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    let finalUserObject = {};

    if (adminData) {
      // 👑 Jika terdaftar di tabel admins, satukan datanya!
      finalUserObject = {
        id: authUser.id,
        email: authUser.email,
        role: 'admin',
        ...adminData // Kolom balance, full_name dari tabel admins masuk sini
      };
    } else {
      // 👥 Jika tidak ada di admins, ambil profilenya dari tabel 'users' biasa
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      finalUserObject = {
        id: authUser.id,
        email: authUser.email,
        role: 'customer',
        ...userData
      };
    }

    // 3. Kirim balik ke frontend dengan payload super steril
    res.json({
      user: finalUserObject,
      token: sessionToken
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// 🔄 GET ME CONTROLLER (Dibuat baru khusus untuk melayani refreshUser di frontend)
export const getMe = async (req, res) => {
  try {
    // req.user di bawah ini datanya otomatis sangat akurat berkat authMiddleware baru kita!
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔁 RESEND EMAIL
export const resendEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Email konfirmasi berhasil dikirim ulang bos!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};