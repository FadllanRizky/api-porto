import { uploadService } from '../services/uploadService.js';

export const uploadController = {
  uploadAvatar: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Tidak ada file yang diupload' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
      const userId = req.user.id;
      const role = req.user.role || 'customer';

      const data = await uploadService.updateAvatar(userId, avatarUrl, role);

      return res.status(200).json({
        success: true,
        avatar_url: avatarUrl,
        message: 'Avatar berhasil diupload!',
        user: data
      });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  updateAvatarUrl: async (req, res) => {
    try {
      const { avatar_url } = req.body;
      if (!avatar_url) {
        return res.status(400).json({ success: false, error: 'URL avatar wajib diisi' });
      }

      const userId = req.user.id;
      const role = req.user.role || 'customer';

      const data = await uploadService.updateAvatar(userId, avatar_url, role);

      return res.status(200).json({
        success: true,
        avatar_url,
        message: 'URL avatar berhasil diperbarui!',
        user: data
      });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
};
