import { supabase } from '../config/db.js';

export const uploadService = {
  async updateAvatar(userId, avatarUrl, role) {
    const table = role === 'admin' ? 'admins' : 'users';

    const { data, error } = await supabase
      .from(table)
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error('Gagal update avatar: ' + error.message);
    return data;
  }
};
