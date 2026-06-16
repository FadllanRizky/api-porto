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