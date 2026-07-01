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

  // ⏱️ Parse string estimasi seperti "2 Hari" atau "6-8 Hari" → ambil angka max
  parseEstimationDays(estimationStr) {
    const match = estimationStr.match(/(\d+)/g);
    if (!match) return 7;
    const numbers = match.map(Number);
    return Math.max(...numbers);
  },

  // 🔄 Auto-update status transaksi yang sudah melewati estimasi tiba
  async autoCompleteTransactions(transactions) {
    const now = new Date();
    const updatedIds = [];

    for (const tx of transactions) {
      if (tx.status !== 'processing' && tx.status !== 'shipping') continue;
      if (!tx.created_at) continue;

      // Gunakan estimated_arrival_date jika ada, atau hitung dari estimasi
      let arrivalDate;
      if (tx.estimated_arrival_date) {
        arrivalDate = new Date(tx.estimated_arrival_date);
      } else {
        const days = this.parseEstimationDays(tx.estimated_delivery);
        const createdDate = new Date(tx.created_at);
        arrivalDate = new Date(createdDate.getTime() + days * 24 * 60 * 60 * 1000);
      }

      if (now >= arrivalDate) {
        const { error } = await supabase
          .from('transactions')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', tx.id);

        if (!error) {
          updatedIds.push(tx.id);
          tx.status = 'completed';
        }
      }
    }

    return transactions;
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
      throw new Error(`Saldo tidak cukup bos! Total belanjaan: Rp ${totalAmount.toLocaleString()}, Saldo Anda: Rp ${user.balance.toLocaleString()}.`);
    }

    // 🔥 A. BUAT TRANSAKSI TERLEBIH DAHULU (sebelum potong saldo)
    const estimation = await this.calculateShipping(shippingRegion);
    const arrivalDays = this.parseEstimationDays(estimation);
    const arrivalDate = new Date(Date.now() + arrivalDays * 24 * 60 * 60 * 1000);

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
        estimated_delivery: estimation,
        estimated_arrival_date: arrivalDate.toISOString()
      }])
      .select()
      .single();

    if (txError) throw new Error('Gagal membuat transaksi: ' + txError.message);

    // 🔥 B. INSERT ITEM & UPDATE STOK (dengan error handling)
    for (const item of validatedItems) {
      const { error: itemError } = await supabase
        .from('transaction_items')
        .insert([{ transaction_id: transaction.id, product_id: item.product_id, quantity: item.quantity, price: item.price }]);

      if (itemError) throw new Error('Gagal menyimpan item transaksi: ' + itemError.message);

      const updatedStok = item.currentStok - item.quantity;
      const { error: stokError } = await supabase
        .from('products')
        .update({ stok: updatedStok }) 
        .eq('id', item.product_id);

      if (stokError) throw new Error('Gagal memperbarui stok produk: ' + stokError.message);
    }

    // 🔥 C. POTONG SALDO USER (PALING AKHIR, setelah transaksi berhasil dibuat)
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
      const { error: adminError } = await supabase.from('admins').update({ balance: adminNewBal }).eq('id', adminAccounts[0].id);
      if (adminError) console.error('Gagal mengkredit saldo admin:', adminError.message);
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

    // 🔄 Auto-update status transaksi yang sudah lewat estimasi
    const updatedData = await this.autoCompleteTransactions(data);

    return updatedData;
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

    // 🔄 Auto-update status agar sinkron dengan user
    const updatedData = await this.autoCompleteTransactions(data);

    return updatedData;
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