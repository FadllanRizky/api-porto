import path from 'path';
import { supabase } from '../config/db.js';
import { uploadService } from '../services/uploadService.js';

const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';
// Di serverless (Vercel) filesystem read-only → DILARANG tulis disk. Hanya dev lokal boleh fallback.
const IS_SERVERLESS = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

function extFrom(mimetype, originalname) {
  const fromName = (path.extname(originalname || '') || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fromName)) return fromName;
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  if (mimetype === 'image/gif') return '.gif';
  return '.jpg';
}

export const uploadController = {
  uploadAvatar: async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, error: 'Tidak ada file yang diupload. Pastikan field form bernama "avatar".' });
      }

      const userId = req.user.id;
      const role = req.user.role || 'customer';
      const ext = extFrom(req.file.mimetype, req.file.originalname);
      const filename = `avatar-${userId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const storagePath = `${role}/${filename}`;

      // Upload ke Supabase Storage (persisten, aman di Vercel — tanpa tulis disk sama sekali)
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        const msg = uploadError.message || '';
        // Bucket belum ada / tidak bisa diakses → jangan pernah fallback ke disk di serverless (itu sumber EROFS)
        if (!IS_SERVERLESS && /not found|bucket|does not exist|404/i.test(msg)) {
          // Dev lokal saja: simpan ke ./uploads/avatars agar tetap bisa dites offline
          const fs = await import('fs');
          const dir = path.join(process.cwd(), 'uploads', 'avatars');
          await fs.promises.mkdir(dir, { recursive: true });
          await fs.promises.writeFile(path.join(dir, filename), req.file.buffer);
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const localUrl = `${baseUrl}/uploads/avatars/${filename}`;
          const data = await uploadService.updateAvatar(userId, localUrl, role);
          return res.status(200).json({ success: true, avatar_url: localUrl, message: 'Avatar berhasil diupload (lokal dev)!', user: data });
        }
        return res.status(500).json({
          success: false,
          error: `Gagal menyimpan ke Storage "${AVATAR_BUCKET}": ${msg}. Pastikan bucket public "${AVATAR_BUCKET}" sudah dibuat di Supabase Dashboard → Storage.`,
        });
      }

      const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
      const avatarUrl = urlData?.publicUrl || null;
      if (!avatarUrl) {
        return res.status(500).json({ success: false, error: 'Gagal mendapatkan URL publik avatar.' });
      }

      // Simpan URL ke tabel users/admins
      const data = await uploadService.updateAvatar(userId, avatarUrl, role);

      return res.status(200).json({
        success: true,
        avatar_url: avatarUrl,
        message: 'Avatar berhasil diupload!',
        user: data,
      });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message || 'Gagal upload avatar.' });
    }
  },

  updateAvatarUrl: async (req, res) => {
    try {
      const { avatar_url } = req.body || {};
      if (!avatar_url || typeof avatar_url !== 'string') {
        return res.status(400).json({ success: false, error: 'URL avatar wajib diisi.' });
      }
      if (!/^https?:\/\/.+/i.test(avatar_url.trim())) {
        return res.status(400).json({ success: false, error: 'Format URL avatar tidak valid (harus http/https).' });
      }

      const userId = req.user.id;
      const role = req.user.role || 'customer';

      const data = await uploadService.updateAvatar(userId, avatar_url.trim(), role);

      return res.status(200).json({
        success: true,
        avatar_url: avatar_url.trim(),
        message: 'URL avatar berhasil diperbarui!',
        user: data,
      });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message || 'Gagal update URL avatar.' });
    }
  },
};
