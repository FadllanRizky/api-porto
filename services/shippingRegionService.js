import { supabase } from '../config/db.js';

export const shippingRegionService = {
  async getAll() {
    const { data, error } = await supabase
      .from('shipping_regions')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  },

  async create(body) {
    const { name, estimated_delivery } = body;
    if (!name || !estimated_delivery) throw new Error('Nama wilayah dan estimasi wajib diisi');

    const { data, error } = await supabase
      .from('shipping_regions')
      .insert([{ name, estimated_delivery }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, body) {
    const { name, estimated_delivery } = body;
    if (!name || !estimated_delivery) throw new Error('Nama wilayah dan estimasi wajib diisi');

    const { data, error } = await supabase
      .from('shipping_regions')
      .update({ name, estimated_delivery })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    const { error } = await supabase
      .from('shipping_regions')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Wilayah pengiriman berhasil dihapus' };
  }
};
