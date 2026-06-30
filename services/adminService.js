import { supabase } from '../config/db.js';

export const adminService = {
  // ==================== 👥 MANAGEMENT USERS ====================
  async getAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("🚨 Supabase Error (getAllUsers):", error.message);
      throw error;
    }
    return data;
  },

  async updateUser(id, updateData) {
    const { data, error } = await supabase
      .from('users')
      .update({
        balance: Number(updateData.balance || 0),
        loan_limit: Number(updateData.loan_limit || 0),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error("🚨 Supabase Error (updateUser):", error.message);
      throw error;
    }
    return data;
  },

  async deleteUser(id) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error("🚨 Supabase Error (deleteUser):", error.message);
      throw error;
    }
    return { message: 'User berhasil dihapus dari pangkalan data!' };
  },

  // ==================== 💰 MANAGEMENT LOANS ====================
  async getAllLoans() {
    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        products (id, name, price, brand),
        users (id, email, full_name, balance)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("🚨 Supabase Error (getAllLoans):", error.message);
      throw error;
    }
    return data;
  },

  async approveLoan(id, adminId) {
    if (!adminId) {
      throw new Error('Gagal ACC: ID Admin tidak valid atau tidak terdeteksi oleh sistem!');
    }

    // 1. Ambil data pinjaman terlebih dahulu
    const { data: loan, error: loanErr } = await supabase
      .from('loans')
      .select('*')
      .eq('id', id)
      .single();

    if (loanErr || !loan) throw new Error('Berkas pinjaman tidak ditemukan!');
    if (loan.status === 'approved') throw new Error('Pinjaman ini sudah di-ACC sebelumnya!');

    const nominalPinjaman = Number(loan.loan_amount || 0);

    // 2. PROSES CHECK & POTONG SALDO ADMIN
    const { data: adminData, error: adminErr } = await supabase
      .from('admins')
      .select('balance')
      .eq('id', adminId)
      .single();

    if (adminErr || !adminData) {
      throw new Error('Data profil admin tidak ditemukan untuk pemotongan saldo!');
    }

    const saldoAdminSekarang = Number(adminData.balance || 0);
    if (saldoAdminSekarang < nominalPinjaman) {
      throw new Error(`Saldo admin tidak mencukupi! Saldo Anda: Rp${saldoAdminSekarang.toLocaleString()}, Pinjaman: Rp${nominalPinjaman.toLocaleString()}`);
    }

    const saldoAdminBaru = saldoAdminSekarang - nominalPinjaman;

    // 3. Ambil saldo user peminjam
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('balance')
      .eq('id', loan.user_id)
      .single();

    if (userErr || !user) throw new Error('User peminjam tidak ditemukan!');

    const saldoUserBaru = Number(user.balance || 0) + nominalPinjaman;

    // 4. JALANKAN UPDATE KE MASING-MASING TABEL
    // Update saldo Admin
    const { error: updateAdminErr } = await supabase
      .from('admins')
      .update({ balance: saldoAdminBaru })
      .eq('id', adminId);

    if (updateAdminErr) throw new Error('Gagal memotong dana saldo admin: ' + updateAdminErr.message);

    // Update saldo User
    const { error: updateWallErr } = await supabase
      .from('users')
      .update({ balance: saldoUserBaru })
      .eq('id', loan.user_id);

    if (updateWallErr) throw new Error('Gagal menyuntikkan dana saldo ke user: ' + updateWallErr.message);

    // Hitung sisa tagihan & tanggal jatuh tempo pertama
    const remainingAmountValue = Number(loan.monthly_payment) * parseInt(loan.tenure_month, 10);
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);

    // Update status berkas pinjaman (sekaligus set remaining_amount & next_due_date)
    const { error: updateLoanErr } = await supabase
      .from('loans')
      .update({ 
        status: 'approved',
        approved_by: adminId,
        remaining_amount: remainingAmountValue,
        next_due_date: dueDate.toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()

    if (updateLoanErr) {
      console.error("🚨 Detail Eror Supabase (loans):", updateLoanErr);
      throw new Error('Gagal memperbarui status berkas di database: ' + updateLoanErr.message);
    }

    return { message: 'Pinjaman disetujui, saldo admin berhasil dipotong, dana sukses dicairkan bos!' };
  },

  async rejectLoan(id, adminId) {
    const { error } = await supabase
      .from('loans')
      .update({ 
        status: 'rejected',
        approved_by: adminId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error("🚨 Supabase Error (rejectLoan):", error.message);
      throw error;
    }
    return { message: 'Berkas pinjaman berhasil ditolak!' };
  },

  // ==================== 📦 MANAGEMENT PRODUCTS ====================
  async createProduct(productData) {
    const productPrice = Number(productData.price || 0);
    if (productPrice <= 0) {
      throw new Error('Harga produk harus lebih dari 0, bos!');
    }

    const finalStok = productData.stock !== undefined ? productData.stock : productData.stok;
    
    // Validasi super ketat untuk category_id agar tidak memicu bad request UUID
    const cleanCategoryId = productData.category_id && productData.category_id.trim() !== "" 
      ? productData.category_id 
      : null;

    const payload = {
      category_id: cleanCategoryId,
      name: productData.name,
      slug: productData.slug || productData.name?.toLowerCase().replace(/ /g, '-'), // Auto slug jika kosong
      brand: productData.brand,
      price: productPrice,
      stok: Number(finalStok || 0),
      image_url: productData.image_url,
      description: productData.description
    };

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select();
    
    if (error) {
      console.error("🚨 Supabase Error (createProduct):", error.message, error.details);
      throw new Error(`Gagal tambah produk: ${error.message}`);
    }
    return data[0];
  },

  async updateProduct(id, productData) {
    const productPrice = Number(productData.price || 0);
    if (productPrice <= 0) {
      throw new Error('Harga produk harus lebih dari 0, bos!');
    }

    const finalStok = productData.stock !== undefined ? productData.stock : productData.stok;

    const cleanCategoryId = productData.category_id && productData.category_id.trim() !== "" 
      ? productData.category_id 
      : null;

    const payload = {
      category_id: cleanCategoryId,
      name: productData.name,
      slug: productData.slug,
      brand: productData.brand,
      price: productPrice,
      stok: Number(finalStok || 0),
      image_url: productData.image_url,
      description: productData.description,
      update_at: new Date().toISOString() // 🔥 FIX: Sudah diganti ke 'update_at' sesuai kolom DB asli lu!
    };

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error("🚨 Supabase Error (updateProduct):", error.message, error.details);
      throw new Error(`Gagal update produk: ${error.message}`);
    }
    return data[0];
  },

  async deleteProduct(id) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error("🚨 Supabase Error (deleteProduct):", error.message, error.details);
      // Deteksi jika eror disebabkan karena produk sedang dipakai di tabel loans
      if (error.code === '23503') {
        throw new Error('Gagal menghapus! Produk ini masih terikat dengan data pinjaman aktif user.');
      }
      throw new Error(`Gagal menghapus produk: ${error.message}`);
    }
    return { message: 'Produk berhasil ditendang dari etalase!' };
  },

  // ==================== 🏷️ MANAGEMENT CATEGORIES ====================
  async getAllCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("🚨 Supabase Error (getAllCategories):", error.message);
      throw error;
    }
    return data;
  },

  async createCategory(categoryData) {
    const payload = {
      name: categoryData.name,
      slug: categoryData.slug
    };

    const { data, error } = await supabase
      .from('categories')
      .insert([payload])
      .select();
    
    if (error) {
      console.error("🚨 Supabase Error (createCategory):", error.message);
      throw error;
    }
    return data[0];
  },

  async updateCategory(id, categoryData) {
    const payload = {
      name: categoryData.name,
      slug: categoryData.slug,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error("🚨 Supabase Error (updateCategory):", error.message);
      throw error;
    }
    return data[0];
  },

  async deleteCategory(id) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error("🚨 Supabase Error (deleteCategory):", error.message);
      throw error;
    }
    return { message: 'Kategori berhasil dimusnahkan!' };
  }
};