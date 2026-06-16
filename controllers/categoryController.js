import { categoryService } from '../services/categoryService.js';

export const getCategories = async (req, res) => {
  try {
    const data = await categoryService.getAll();
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name wajib diisi' });
    }

    const data = await categoryService.create(req.body);
    res.json(data);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await categoryService.update(id, req.body);
    res.json(data);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    await categoryService.delete(id);

    res.json({ message: 'Category deleted successfully' });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};