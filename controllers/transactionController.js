import { transactionService } from '../services/transactionService.js';

export const transactionController = {
  
  // POST /api/transactions/checkout
  checkout: async (req, res) => {
    try {
      const userId = req.user.id;
      const { items, shipping_region, payment_method } = req.body;
      const token = req.headers.authorization;

      const result = await transactionService.checkout(userId, items, shipping_region, payment_method, token);
      return res.status(201).json({ success: true, ...result });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  // GET /api/transactions/history
  getHistory: async (req, res) => {
    try {
      const userId = req.user.id;
      const token = req.headers.authorization;

      const data = await transactionService.getUserHistory(userId, token);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // POST /api/transactions/review
  reviewProduct: async (req, res) => {
    try {
      const userId = req.user.id;
      const token = req.headers.authorization;

      const data = await transactionService.createReview(userId, req.body, token);
      return res.status(201).json({ success: true, message: 'Review bintang berhasil dikirim, bos!', data });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  // 🔄 PATCH /api/transactions/:id/status { status: 'shipping' | 'completed' }
  // - admin: boleh shipping & completed (Kirim / Selesaikan)
  // - user pemilik: boleh completed (Pesanan Diterima), tidak boleh shipping
  updateStatus: async (req, res) => {
    try {
      const transactionId = req.params.id;
      const { status } = req.body || {};
      const requesterId = req.user.id;
      const requesterRole = req.user.role || 'customer';

      if (!status) {
        return res.status(400).json({ success: false, error: 'Field status wajib diisi (shipping / completed).' });
      }

      const data = await transactionService.updateTransactionStatus({
        transactionId,
        requesterId,
        requesterRole,
        targetStatus: status,
      });
      return res.status(200).json({ success: true, message: 'Status pesanan diperbarui.', data });
    } catch (error) {
      const msg = error.message || 'Gagal memperbarui status.';
      const code = /tidak ditemukan/i.test(msg) ? 404 : /berhak|Hanya admin|diizinkan|sudah/i.test(msg) ? 403 : 400;
      return res.status(code).json({ success: false, error: msg });
    }
  },

  // 🕛 GET /api/transactions/cron-auto-complete (dipanggil Vercel Cron tiap malam)
  runAutoComplete: async (req, res) => {
    try {
      const required = process.env.CRON_SECRET;
      if (required) {
        const provided =
          req.headers['x-cron-secret'] ||
          req.query.secret ||
          (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (provided !== required) {
          return res.status(401).json({ success: false, error: 'Cron secret tidak valid.' });
        }
      }
      const result = await transactionService.autoCompleteExpiredBatch(500);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // 👑 GET /api/transactions/admin/dashboard (Monitoring Admin)
  getAdminDashboard: async (req, res) => {
    try {
      const token = req.headers.authorization;
      const data = await transactionService.getAdminDashboardTx(token);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  // 👑 GET /api/transactions/admin/reviews (Review Monitor Admin)
  getAdminReviews: async (req, res) => {
    try {
      const token = req.headers.authorization;
      const data = await transactionService.getProductReviewsForAdmin(token);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};