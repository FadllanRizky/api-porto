import { supabase } from '../config/db.js';

export const productService = {

  async getAll() {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories ( name )
      `);

    if (error) throw new Error(error.message);

    return data;
  },

  async create(body, user) {
    const { name, price, category_id, description, brand, image_url, stok } = body;

    // 🔥 cek category ada atau tidak
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', category_id)
      .maybeSingle();

    if (categoryError) throw new Error(categoryError.message);

    if (!category) {
      throw new Error('Category tidak ditemukan');
    }

    const { data, error } = await supabase
      .from('products')
      .insert([
        { name, price, category_id, description, brand, image_url, stok }
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);

    return data;
  },

  async bulkCreate(products, user) {
  if (!Array.isArray(products)) {
    throw new Error('Body harus array');
  }

  if (!user?.id) {
    throw new Error('User tidak valid');
  }

  const categoryIds = [...new Set(products.map(p => p.category_id))];

  const { data: categories, error: errCategory } = await supabase
    .from('categories')
    .select('id')
    .in('id', categoryIds);

  if (errCategory) throw new Error(errCategory.message);

  if (!categories || categories.length !== categoryIds.length) {
    throw new Error('Ada category yang tidak valid');
  }

  const payload = products.map(p => ({
    name: p.name,
    description: p.description,
    price: p.price,
    stok: p.stok,
    category_id: p.category_id,
    brand: p.brand,
    image_url: p.image_url,
  }));

  const { data: insertedData, error: errInsert } = await supabase
    .from('products')
    .insert(payload)
    .select();

  if (errInsert) throw new Error(errInsert.message);

  return insertedData;
},

  async update(id, body, user) {
    const { data, error } = await supabase
      .from('products')
      .update(body)
      .eq('id', id)
      // .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return data;
  },

  async delete(id, user) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
    // .eq('user_id', user.id)

    if (error) throw new Error(error.message);

    return true;
  }
};

  