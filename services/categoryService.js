import { supabase } from '../config/db.js';

export const categoryService = {

  async getAll() {
    const { data, error } = await supabase
      .from('categories')
      .select('*');

    if (error) throw new Error(error.message);
    return data;
  },

  async create(body) {
    const { name } = body;

    // 🔥 cek duplicate
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      throw new Error('Category sudah ada');
    }

    const { data, error } = await supabase
      .from('categories')
      .insert([{ name }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    return data;
  },

  async update(id, body) {
    const { data, error } = await supabase
      .from('categories')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    return true;
  }
};