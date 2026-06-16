import { supabase } from '../config/db.js';

export const authService = {

  // ================= LOGIN (VERSI FIX ANTI-OVERWRITE) =================
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      throw new Error('Email atau password salah');
    }

    const user = data.user;

    // 1. Ambil data profil yang SEKARANG ada di tabel 'users' Supabase bos
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // 2. KUNCI ROLE: Ikuti role dari dashboard (misal 'admin'). Kalau belum terdaftar, baru default 'customer'
    const finalRole = existingProfile?.role || 'customer';

    // 3. UPSERT USER: Update data tanpa merusak / menimpa status role admin bos
    const { data: profile, error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: existingProfile?.full_name || user.email.split('@')[0],
        role: finalRole, // 🔥 Aman bos, role 'admin' hasil ketikan manual bos tidak akan berubah lagi!
        credit_score: existingProfile?.credit_score || 50,
        loan_limit: existingProfile?.loan_limit || 2000000,
        balance: existingProfile?.balance ?? 2000000
      })
      .select()
      .maybeSingle();

    if (upsertError) throw new Error(`Gagal singkronisasi profil: ${upsertError.message}`);

    return {
      user: {
        ...profile,      
        id: user.id,
        email: user.email,
        role: finalRole // Lempar role sesungguhnya ('admin') ke frontend
      },
      token: data.session?.access_token, 
      session: data.session
    };
  },

  // ================= REGISTER =================
  async register({ email, password, full_name }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw new Error(error.message);
    const user = data.user;

    if (!user) {
      throw new Error('User tidak terbentuk');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email,
        full_name,
        role: 'customer', // Pendaftar baru otomatis customer biasa
        credit_score: 50,
        loan_limit: 2000000,
        balance: 2000000
      })
      .select()
      .maybeSingle();

    if (profileError) throw new Error(`Gagal menyimpan data ke tabel users: ${profileError.message}`);

    return {
      user: {
        ...profile,
        id: user.id,
        email,
        role: 'customer'
      },
      token: data.session?.access_token || null,
      message: 'Register berhasil bos!'
    };
  }
};