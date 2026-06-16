import { shippingRegionService } from '../services/shippingRegionService.js';

export const shippingRegionController = {
  getAll: async (req, res) => {
    try {
      const data = await shippingRegionService.getAll();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const data = await shippingRegionService.create(req.body);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const data = await shippingRegionService.update(id, req.body);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await shippingRegionService.remove(id);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
};
