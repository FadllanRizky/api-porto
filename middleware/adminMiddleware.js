import { supabase } from '../config/db.js';

export const adminMiddleware = async (req, res, next) => {
  try {
    // 1. Pastikan user-nya udah lolos login dulu di middleware sebelumnya
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Sesi login tidak valid, silakan login ulang bos!' });
    }

    // 🔍 2. KETUK PINTU LANGSUNG KE TABEL ADMINS (Bukan users!)
    const { data: adminData, error } = await supabase
      .from('admins')
      .select('id, role')
      .eq('id', req.user.id) // Mencocokkan UUID auth login dengan UUID di tabel admins
      .single();

    // 3. Kalau error / data gak ketemu / role-nya bukan admin, tendang!
    if (error || !adminData || adminData.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Akses diblokir! Akun lu gak terdaftar di tabel khusus administrator, boskuh.' 
      });
    }

    // 4. Kalau sukses terdaftar di tabel admins, loloskan ke halaman admin!
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Terjadi kesalahan internal server admin: ' + err.message });
  }
};