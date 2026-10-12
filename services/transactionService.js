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

  // ⏱️ Parse string estimasi seperti "2 Hari" atau "6-8 Hari" → ambil angka max (null-safe)
  parseEstimationDays(estimationStr) {
    try {
      if (estimationStr === null || estimationStr === undefined) return 7;
      if (typeof estimationStr === 'number' && Number.isFinite(estimationStr)) {
        return Math.max(1, Math.round(estimationStr));
      }
      const str = String(estimationStr);
      const match = str.match(/(\d+)/g);
      if (!match) return 7;
      const numbers = match.map(Number).filter((n) => Number.isFinite(n));
      if (numbers.length === 0) return 7;
      return Math.max(...numbers);
    } catch {
      return 7;
    }
  },

  // 🏷️ Normalisasi status legacy/beda bahasa ke kanonik backend:
  // 'processing' | 'shipping' | 'completed' (DB tetap 'completed', UI mapping ke SUCCESS/SELESAI)
  normalizeStatus(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (['completed', 'complete', 'success', 'sukses', 'selesai', 'done'].includes(s)) return 'completed';
    if (['shipping', 'shipped', 'kirim', 'dikirim', 'jalan', 'dalam perjalanan', 'delivery', 'on_delivery'].includes(s)) return 'shipping';
    if (['processing', 'process', 'proses', 'pending', 'paid', 'dibayar', 'diproses'].includes(s)) return 'processing';
    return s || 'processing';
  },

  // 📅 Hitung tanggal tiba: pakai estimated_arrival_date jika valid, else created_at + estimasi hari
  resolveArrivalDate(tx, fallbackDays) {
    try {
      if (tx.estimated_arrival_date) {
        const d = new Date(tx.estimated_arrival_date);
        if (!Number.isNaN(d.getTime())) return d;
      }
      if (!tx.created_at) return null;
      const created = new Date(tx.created_at);
      if (Number.isNaN(created.getTime())) return null;
      const days = Number.isFinite(fallbackDays) ? fallbackDays : this.parseEstimationDays(tx.estimated_delivery);
      return new Date(created.getTime() + days * 24 * 60 * 60 * 1000);
    } catch {
      return null;
    }
  },

  // 🚚 Hitung ambang "kirim": dibuat + max(1 hari, setengah estimasi). Cth 10 hari → hari ke-5 jadi shipping.
  resolveShippingDate(tx, arrivalDays) {
    try {
      if (!tx.created_at) return null;
      const created = new Date(tx.created_at);
      if (Number.isNaN(created.getTime())) return null;
      const half = Math.max(1, Math.floor((arrivalDays || 7) / 2));
      return new Date(created.getTime() + half * 24 * 60 * 60 * 1000);
    } catch {
      return null;
    }
  },

  // 🔄 Auto-update 2 tahap sesuai estimasi daerah:
  // processing -> shipping (lewat setengah estimasi) -> completed (lewat estimated_arrival_date)
  // Aman untuk data legacy ('proses'/'pending') & estimated_delivery null.
  async autoCompleteTransactions(transactions) {
    const now = new Date();
    if (!Array.isArray(transactions)) return transactions;

    for (const tx of transactions) {
      try {
        if (!tx || !tx.id) continue;
        const raw = String(tx.status || '');
        const effective = this.normalizeStatus(raw);

        // Sudah sukses → samakan tampilan ke 'completed' (mapping ke SUCCESS di UI)
        if (effective === 'completed') {
          tx.status = 'completed';
          continue;
        }
        if (effective !== 'processing' && effective !== 'shipping') continue;
        if (!tx.created_at) continue;

        const arrivalDays = this.parseEstimationDays(tx.estimated_delivery);
        const arrivalDate = this.resolveArrivalDate(tx, arrivalDays);
        if (!arrivalDate) continue;

        // Tahap 2: waktu tiba terlewati → completed (SUCCESS di UI)
        if (now >= arrivalDate) {
          const { error } = await supabase
            .from('transactions')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', tx.id);
          if (!error) tx.status = 'completed';
          continue;
        }

        // Tahap 1: lewat setengah estimasi → shipping (DALAM PERJALANAN di UI)
        if (effective === 'processing') {
          const shippingAt = this.resolveShippingDate(tx, arrivalDays);
          if (shippingAt && now >= shippingAt) {
            const { error } = await supabase
              .from('transactions')
              .update({ status: 'shipping', updated_at: new Date().toISOString() })
              .eq('id', tx.id);
            if (!error) tx.status = 'shipping';
          } else {
            // Normalisasi fosil legacy ('proses'/'pending') ke 'processing' biar tidak stuck permanen
            if (raw.toLowerCase() !== 'processing') {
              const { error } = await supabase
                .from('transactions')
                .update({ status: 'processing', updated_at: new Date().toISOString() })
                .eq('id', tx.id);
              if (!error) tx.status = 'processing';
              else tx.status = 'processing';
            }
          }
        } else {
          tx.status = 'shipping';
        }
      } catch {
        continue;
      }
    }

    return transactions;
  },

  // ✅ Update status manual dengan validasi transisi + kepemilikan
  async updateTransactionStatus({ transactionId, requesterId, requesterRole, targetStatus }) {
    const target = this.normalizeStatus(targetStatus);
    if (!['shipping', 'completed'].includes(target)) {
      throw new Error('Status tujuan tidak valid. Gunakan: shipping / completed.');
    }
    if (!transactionId) throw new Error('ID transaksi wajib diisi.');

    const { data: tx, error: fetchError } = await supabase
      .from('transactions')
      .select('id, user_id, status')
      .eq('id', transactionId)
      .single();

    if (fetchError || !tx) throw new Error('Transaksi tidak ditemukan.');
    const current = this.normalizeStatus(tx.status);
    if (current === 'completed') throw new Error('Transaksi sudah selesai (SUCCESS).');

    const isAdmin = requesterRole === 'admin';
    const isOwner = String(tx.user_id) === String(requesterId);
    if (!isAdmin && !isOwner) throw new Error('Kamu tidak berhak mengubah transaksi ini.');

    // Aturan transisi:
    // processing -> shipping : admin only (tombol Kirim)
    // processing -> completed : owner / admin (tombol Pesanan Diterima / Selesaikan)
    // shipping -> completed   : owner / admin
    if (current === 'processing' && target === 'shipping' && !isAdmin) {
      throw new Error('Hanya admin yang bisa mengubah ke status pengiriman.');
    }
    if (current === 'shipping' && target === 'shipping') {
      throw new Error('Transaksi sudah dalam pengiriman.');
    }
    if (current === 'processing' && !['shipping', 'completed'].includes(target)) {
      throw new Error('Transisi status tidak diizinkan.');
    }
    if (current === 'shipping' && target !== 'completed') {
      throw new Error('Transisi status tidak diizinkan.');
    }

    const { data: updated, error: updateError } = await supabase
      .from('transactions')
      .update({ status: target, updated_at: new Date().toISOString() })
      .eq('id', transactionId)
      .select()
      .single();

    if (updateError) throw new Error('Gagal memperbarui status: ' + updateError.message);
    return updated;
  },

  // 🕛 Batch untuk cron: sapu semua processing/shipping (+legacy) yang kedaluwarsa tanpa perlu token user
  async autoCompleteExpiredBatch(limit = 500) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, status, created_at, estimated_delivery, estimated_arrival_date')
      .in('status', ['processing', 'shipping', 'proses', 'pending', 'PROSES', 'PROCESSING', 'SHIPPING'])
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);
    const before = (data || []).map((t) => ({ id: t.id, status: this.normalizeStatus(t.status) }));
    const updated = await this.autoCompleteTransactions(data || []);
    let shipped = 0;
    let completed = 0;
    updated.forEach((tx, i) => {
      const prev = before[i]?.status;
      if (tx.status === 'shipping' && prev === 'processing') shipped += 1;
      if (tx.status === 'completed' && prev !== 'completed') completed += 1;
    });
    return { checked: updated.length, shipped, completed };
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