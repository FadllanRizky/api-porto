import { productService } from '../services/productService.js';

export const getProducts = async (req, res) => {
  try {
    const data = await productService.getAll();
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const data = await productService.create(req.body, req.user);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const bulkCreateProducts = async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Body harus array' });
    }

    const data = await productService.bulkCreate(req.body, req.user);

    res.json({
      message: 'Bulk insert berhasil',
      data
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await productService.update(id, req.body, req.user);

    res.json(data);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    await productService.delete(id, req.user);

    res.json({ message: 'Product deleted successfully' });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};