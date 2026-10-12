import { supabase } from '../config/db.js';

export const uploadService = {
  async updateAvatar(userId, avatarUrl, role) {
    const table = role === 'admin' ? 'admins' : 'users';

    if (!userId) throw new Error('User ID tidak valid.');
    if (!avatarUrl || typeof avatarUrl !== 'string') throw new Error('URL avatar tidak valid.');

    const { data, error } = await supabase
      .from(table)
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      // Pesan ramah jika kolom belum ada di Supabase
      if (/avatar_url/i.test(error.message) && /column|does not exist|schema/i.test(error.message)) {
        throw new Error(
          `Kolom avatar_url belum ada di tabel ${table}. Tambahkan kolom avatar_url (text, nullable) di Supabase lalu coba lagi.`
        );
      }
      throw new Error('Gagal update avatar: ' + error.message);
    }
    if (!data) throw new Error(`Data ${table} tidak ditemukan untuk ID tersebut.`);
    return data;
  }
};
