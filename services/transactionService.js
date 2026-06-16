import { supabase } from '../config/db.js';

export const transactionService = {
  
  // 🚚 Ambil Estimasi dari Database Supabase (Online)
  async calculateShipping(region) {
    const { data, error } = await supabase
      .from('shipping_regions')
      .select('estimated_delivery')
      .ilike('name', region.trim())
      .maybeSingle();

    if (error || !data) return '7-10 Hari';
    return data.estimated_delivery;
  },

  // 🛒 1. PROSES CHECKOUT & BELANJA (Potong Saldo + Potong Stok Toko)
  async checkout(userId, items, shippingRegion, paymentMethod, token) {
    if (!items || items.length === 0) throw new Error('Keranjang belanja lu kosong, bos!');

    // 🔥 AMBIL DATA SALDO USER (Bersih tanpa .headers)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (userError || !user) throw new Error('User tidak ditemukan, bos!');

    let totalAmount = 0;
    const validatedItems = [];

    // Loop keranjang belanja untuk cek ketersediaan 'stok' & hitung total harga real dari DB
    for (const item of items) {
      // 🔥 CEK STOK PRODUK (Bersih tanpa .headers)
      const { data: prod, error: prodError } = await supabase
        .from('products')
        .select('id, price, stok, name') 
        .eq('id', item.product_id)
        .single();

      if (prodError || !prod) throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan!`);
      if (prod.stok < item.quantity) throw new Error(`Stok untuk produk "${prod.name}" tidak cukup! Sisa stok: ${prod.stok}`);

      totalAmount += Number(prod.price) * item.quantity;
      validatedItems.push({ ...item, price: prod.price, currentStok: prod.stok });
    }

    // Validasi kecukupan saldo user
    if (user.balance < totalAmount) {
      throw new Error(`Saldo tidak cukup bos! Total belanjaan: Rp ${totalAmount.toLocaleString()}, Saldo lu: Rp ${user.balance.toLocaleString()}.`);
    }

    // 🔥 A. POTONG SALDO USER DI TABEL USERS (Bersih tanpa .headers)
    const newBalance = user.balance - totalAmount;
    const { error: updateBalError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (updateBalError) throw new Error('Gagal memotong saldo user: ' + updateBalError.message);

    // KREDIT SALDO ADMIN
    const { data: adminAccounts } = await supabase
      .from('admins')
      .select('id, balance')
      .limit(1);

    if (adminAccounts && adminAccounts.length > 0) {
      const adminNewBal = Number(adminAccounts[0].balance || 0) + totalAmount;
      await supabase.from('admins').update({ balance: adminNewBal }).eq('id', adminAccounts[0].id);
    }

    // B. HITUNG ESTIMASI HARI SAMPAI (dari database online)
    const estimation = await this.calculateShipping(shippingRegion);

    // 🔥 C. INSERT KE TABEL TRANSACTIONS (Bersih tanpa .headers)
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert([{ 
        user_id: userId, 
        type: 'shopping', 
        amount: totalAmount, 
        payment_method: paymentMethod || 'BALANCE', 
        description: `Belanja e-commerce sebanyak ${items.length} jenis barang`,
        status: 'processing', 
        shipping_region: shippingRegion, 
        estimated_delivery: estimation   
      }])
      .select()
      .single();

    if (txError) throw new Error('Gagal membuat transaksi: ' + txError.message);

    // D. INSERT KE DETAIL ITEM & POTONG ANGKA 'STOK' PRODUK SATU PER SATU
    for (const item of validatedItems) {
      // 🔥 Insert Item (Bersih tanpa .headers)
      await supabase
        .from('transaction_items')
        .insert([{ transaction_id: transaction.id, product_id: item.product_id, quantity: item.quantity, price: item.price }]);
      
      // 🔥 Update nilai stok yang berkurang (Bersih tanpa .headers)
      const updatedStok = item.currentStok - item.quantity;
      await supabase
        .from('products')
        .update({ stok: updatedStok }) 
        .eq('id', item.product_id);
    }

    return { message: 'Belanja berhasil, boskuh!', transaction_id: transaction.id, estimation };
  },

  // 📜 2. AMBIL HISTORY TRANSAKSI + REVIEW (SISI USER/CUSTOMER)
  async getUserHistory(userId, token) {
    // 🔥 Ambil History Belanja (Bersih tanpa .headers)
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items ( id, quantity, price, products (id, name, image_url) ),
        product_reviews ( id, rating, comment, product_id )
      `)
      .eq('user_id', userId)
      .eq('type', 'shopping') 
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // 👑 3. ADMIN DASHBOARD (Melihat Barang yang Dibeli & Sisa 'Stok' yang Berkurang)
  async getAdminDashboardTx(token) {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items (
          id, quantity, price,
          products (id, name, stok)
        ),
        users!user_id ( id, full_name, email )
      `)
      .eq('type', 'shopping')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },
  // ⭐️ 4. KIRIM ULASAN BINTANG & KOMEN (SISI USER)
  async createReview(userId, body, token) {
    const { transaction_id, product_id, rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) throw new Error('Rating wajib diisi antara 1 - 5 bintang, bos!');

    // 🔥 Insert Review (Bersih tanpa .headers)
    const { data, error } = await supabase
      .from('product_reviews')
      .insert([{ transaction_id, product_id, user_id: userId, rating: parseInt(rating), comment }])
      .select()
      .single();

    if (error) throw new Error('Gagal mengirimkan ulasan: ' + error.message);
    return data;
  },

  // 👑 5. ADMIN LIHAT ISI KOMEN & RATING USER
  async getProductReviewsForAdmin(token) {
    // 🔥 FIX 500: Hapus join users (username, email) agar query database lancar jaya
    const { data, error } = await supabase
      .from('product_reviews')
      .select(`
        id, rating, comment, created_at, product_id, transaction_id, user_id,
        products (id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }
};