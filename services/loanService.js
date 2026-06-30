import { supabase } from '../config/db.js';
import { calculateLoan } from '../utils/calculateInterest.js';
import { sendEmailNotification, generateLoanTemplate } from '../helpers/emailHelper.js';

export const loanService = {

  // 1. AJUKAN PINJAMAN BARU (UANG TUNAI ATAU KREDIT BARANG)
  async create(body, user) {
    // Validasi apakah user sudah login melalui middleware
    if (!user?.id) throw new Error('User tidak valid, silakan login ulang bos!');

    // 🛡️ VALIDASI BATAS MAKSIMAL 3 PINJAMAN AKTIF/PENDING
    const { count, error: countError } = await supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved']); 

    if (countError) throw new Error('Gagal memeriksa limit pinjaman user: ' + countError.message);
    if (count >= 3) {
      throw new Error('Pengajuan ditolak! Anda sudah mencapai batas maksimal (3 pinjaman aktif/pending). Lunasi tagihan lama terlebih dahulu, bos!');
    }

    // Validasi wajib upload KTP
    if (!body.id_card_url || body.id_card_url.trim() === '') {
      throw new Error('Wajib mengupload foto KTP terlebih dahulu, bos!');
    }

    // Validasi Nama Lengkap Pemohon
    if (!body.full_name_applicant || !body.full_name_applicant.trim()) {
      throw new Error('Nama lengkap pemohon wajib diisi sesuai KTP!');
    }

    // Validasi NIK KTP (Wajib pas 16 digit angka)
    const cleanNik = body.nik ? body.nik.toString().trim() : '';
    if (cleanNik.length !== 16 || !/^\d+$/.test(cleanNik)) {
      throw new Error('Nomor KTP (NIK) tidak valid! Harus berupa angka dan tepat 16 digit, bos!');
    }

    // 🔥 FIX: Bersihkan nomor telepon dari karakter unik (+, -, spasi) sebelum divalidasi
    const cleanPhone = body.phone_number ? body.phone_number.toString().replace(/\D/g, '') : '';
    if (cleanPhone.length !== 12 || /^0+$/.test(cleanPhone)) {
      throw new Error('Nomor telepon tidak valid! Harus tepat 12 digit angka, bos!');
    }

    // 🔥 FIX: Paksa konversi ke tipe data Number/Integer semenjak awal masuk dari form-data
    let finalAmount = body.loan_amount ? Number(body.loan_amount) : 0;
    let interestRate = body.interest_rate ? Number(body.interest_rate) : 5; // Default bunga 5%
    let tenorMonth = body.tenure_month ? parseInt(body.tenure_month, 10) : 6;
    let finalPayment = 0;

    // 🛒 LOGIKA JIKA YANG DIPINJAM/DIKREDIT ADALAH BARANG
    if (body.type === 'product') {
      if (!body.product_id) {
        throw new Error('Wajib menyertakan ID Produk jika ingin melakukan kredit barang, bos!');
      }

      // Ambil data harga asli produk langsung dari database Supabase (Anti-Hack Frontend)
      const { data: databaseProduct, error: productError } = await supabase
        .from('products')
        .select('price, description')
        .eq('id', body.product_id)
        .single();

      if (productError || !databaseProduct) {
        throw new Error('Produk pilihan tidak ditemukan di database, bos!');
      }

      // Set nominal pinjaman sebesar harga barang asli di DB
      finalAmount = Number(databaseProduct.price);
      
      // Hitung rincian cicilan bulanan barang menggunakan kalkulator bunga
      const calcProduct = calculateLoan(finalAmount, interestRate, tenorMonth);
      finalPayment = Number(calcProduct.monthly_payment);
    } else {
      // Jika pinjam uang tunai biasa (Cash)
      const calcCash = calculateLoan(finalAmount, interestRate, tenorMonth);
      finalAmount = Number(calcCash.loan_amount);
      finalPayment = Number(calcCash.monthly_payment);
    }

    // Validasi Nominal Pinjaman (Minimal 200 Ribu, Maksimal 5 Juta)
    if (finalAmount < 200000) {
      throw new Error('Pengajuan ditolak! Minimal harga barang/pinjaman adalah Rp 200.000, bos!');
    }
    if (finalAmount > 5000000) {
      throw new Error('Pengajuan ditolak! Maksimal limit harga barang/pinjaman adalah Rp 5.000.000, bos!');
    }

    // Bungkus data ke payload dengan tipe data yang sudah bersih
    const payload = {
      user_id: user.id, 
      product_id: body.type === 'product' ? body.product_id : null,
      loan_amount: finalAmount,
      tenure_month: tenorMonth,
      interest_rate: interestRate,
      monthly_payment: finalPayment,
      type: body.type || 'cash',
      status: 'pending', 
      reason: body.reason || null,
      id_card_url: body.id_card_url,
      full_name_applicant: body.full_name_applicant.trim(),
      nik: cleanNik,
      phone_number: cleanPhone,
      payment_method: body.payment_method || 'DANA'
    };

    const { data, error } = await supabase
      .from('loans')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // 📬 LANGSUNG KIRIM EMAIL NOTIFIKASI PENDING KE GMAIL ASLI USER
    try {
      const emailHtml = generateLoanTemplate(payload.full_name_applicant, 'pending', data);
      await sendEmailNotification(user.email, 'Konfirmasi Antrean Aktivitas Baru Mbur System ⚡', emailHtml);
    } catch (emailErr) {
      console.error('Gagal mengirim email, tapi data loan aman:', emailErr.message);
    }

    return data;
  },

  // 2. AMBIL PINJAMAN MILIK USER TERTENTU
  async getByUser(user) {
    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        products (id, description, price, image_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // 3. AMBIL SEMUA DATA PINJAMAN (KHUSUS SISI ADMIN)
  async getAllLoansForAdmin() {
    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        products (id, description, price),
        users (id, email, username, balance)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // 4. UPDATE STATUS PINJAMAN OLEH ADMIN
  async updateStatusByAdmin(loanId, status, adminId) {
    const safeStatus = status.toLowerCase(); 
    
    if (!['approved', 'rejected', 'pending'].includes(safeStatus)) {
      throw new Error('Status tidak valid! Harus pending, approved, atau rejected');
    }

    // 🔥 FIX: Menghapus kolom fiktif 'tenor_month' dari pemanggilan select
    const { data: currentLoan, error: fetchLoanError } = await supabase
      .from('loans')
      .select('user_id, product_id, loan_amount, status, type, tenure_month, monthly_payment, full_name_applicant, interest_rate, reason') 
      .eq('id', loanId)
      .single();

    if (fetchLoanError || !currentLoan) {
      throw new Error('Data pengajuan pinjaman tidak ditemukan, bos!');
    }

    if (currentLoan.status === 'approved') {
      throw new Error('Pinjaman ini sudah disetujui sebelumnya, tidak bisa diubah lagi!');
    }

    // Tentukan isi nilai sisa tagihan berjalan (remaining_amount) ketika admin menyetujui
    let remainingAmountValue = 0;
    if (safeStatus === 'approved') {
      remainingAmountValue = Number(currentLoan.monthly_payment) * parseInt(currentLoan.tenure_month, 10);
    }

    // 🔥 FIX: Menggunakan kolom 'updated_at' (Sesuaikan dengan perbaikan tabel di bawah)
    const { data: updatedLoan, error: updateLoanError } = await supabase
      .from('loans')
      .update({ 
        status: safeStatus,
        approved_by: adminId,
        remaining_amount: remainingAmountValue, 
        updated_at: new Date().toISOString()
      })
      .eq('id', loanId)
      .select()
      .single();

    if (updateLoanError) throw new Error(updateLoanError.message);

    // Ambil alamat email asli target user dari database untuk notifikasi
    const { data: targetUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', currentLoan.user_id)
      .single();

    // 🟢 JIKA APPROVED & YANG DIAJUKAN ADALAH CASH (UANG TUNAI)
    if (safeStatus === 'approved' && currentLoan.type === 'cash') {
      const { data: userData, error: fetchUserError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', currentLoan.user_id)
        .single();

      if (fetchUserError || !userData) {
        throw new Error('Gagal mengambil data saldo user: ' + fetchUserError?.message);
      }

      const currentBalance = Number(userData.balance || 0);
      const loanAmount = Number(currentLoan.loan_amount || 0);
      const newBalance = currentBalance + loanAmount;

      const { error: updateUserError } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', currentLoan.user_id);

      if (updateUserError) {
        throw new Error('Pinjaman approved, tapi GAGAL menambah saldo user: ' + updateUserError.message);
      }
    }

    // 🔵 JIKA APPROVED & YANG DIAJUKAN ADALAH PRODUCT (KREDIT BARANG)
    if (safeStatus === 'approved' && currentLoan.type === 'product') {
      const { data: newTx, error: txError } = await supabase
        .from('transactions')
        .insert([{
          user_id: currentLoan.user_id,
          type: 'product_loan',
          amount: Number(currentLoan.loan_amount),
          payment_method: 'MBUR_LOAN_FINANCING',
          description: `Pembiayaan cicilan barang: Akad Kredit Disetujui Admin`,
          status: 'completed',
          shipping_region: currentLoan.reason || 'Wilayah Utama Mbur', 
          estimated_delivery: '3-5 Hari Kerja'
        }])
        .select()
        .single();

      if (txError) {
        throw new Error('Pinjaman disetujui, tapi GAGAL membuat riwayat transaksi barang: ' + txError.message);
      }

      const { error: itemError } = await supabase
        .from('transaction_items')
        .insert([{
          transaction_id: newTx.id,
          product_id: currentLoan.product_id,
          quantity: 1,
          price: Number(currentLoan.loan_amount)
        }]);

      if (itemError) {
        throw new Error('Transaksi barang tercatat, tapi GAGAL memasukkan item produk ke manifest gudang: ' + itemError.message);
      }

      // Kurangi stok produk
      const { data: prodData } = await supabase
        .from('products')
        .select('stok')
        .eq('id', currentLoan.product_id)
        .single();

      if (prodData) {
        const newStok = Math.max(0, Number(prodData.stok || 0) - 1);
        await supabase.from('products').update({ stok: newStok }).eq('id', currentLoan.product_id);
      }
    }

    // 📬 KIRIM NOTIFIKASI KEPUTUSAN ADMIN (APPROVED/REJECTED) KE GMAIL ASLI USER
    if (targetUser?.email) {
      try {
        const statusEmailHtml = generateLoanTemplate(currentLoan.full_name_applicant, safeStatus, currentLoan);
        await sendEmailNotification(
          targetUser.email, 
          `Pembaruan Keputusan Pengajuan Pinjaman: ${safeStatus.toUpperCase()} 🔔`, 
          statusEmailHtml
        );
      } catch (emailErr) {
        console.error('Gagal mengirim email status admin:', emailErr.message);
      }
    }

    return updatedLoan;
  },
// Tambahkan fungsi ini di dalam objek loanService {} di backend kamu
async payInstallment(loanId, user) {
  if (!user?.id) throw new Error('User tidak valid, silakan login ulang boskuh!');

  // 1. Ambil data pinjaman terbaru
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (loanError || !loan) throw new Error('Data kontrak pinjaman tidak ditemukan!');
  if (loan.remaining_amount <= 0) throw new Error('Kontrak pinjaman ini sudah lunas, boskuh!');

  const nominalTagihan = Number(loan.monthly_payment);

  // 2. Ambil saldo riil user dari database
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('balance')
    .eq('id', user.id)
    .single();

  if (userError || !userData) throw new Error('Gagal mengambil profil user!');
  
  const currentBalance = Number(userData.balance || 0);

  // 3. Validasi Kecukupan Saldo
  if (currentBalance < nominalTagihan) {
    throw new Error('Maaf saldo anda kurang boskuh!');
  }

  // 4. Hitung nilai baru
  const newBalance = currentBalance - nominalTagihan;
  const currentRemaining = Number(loan.remaining_amount);
  const newRemaining = Math.max(0, currentRemaining - nominalTagihan);

  // Hitung tanggal jatuh tempo bulan berikutnya (+1 bulan)
  const baseDate = loan.next_due_date ? new Date(loan.next_due_date) : new Date(loan.created_at);
  baseDate.setMonth(baseDate.getMonth() + 1);

  // 5. EKSEKUSI MUTASI DI SUPABASE (Gunakan Transaksi atau Update Berurutan)
  // A. Potong Saldo User
  const { error: upUserErr } = await supabase
    .from('users')
    .update({ balance: newBalance })
    .eq('id', user.id);
  if (upUserErr) throw new Error('Gagal memotong saldo user: ' + upUserErr.message);

  // B. Perbarui Sisa Tagihan & Jatuh Tempo di Tabel Loans
  const { data: updatedLoan, error: upLoanErr } = await supabase
    .from('loans')
    .update({
      remaining_amount: newRemaining,
      next_due_date: baseDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', loanId)
    .select()
    .single();

  if (upLoanErr) throw new Error('Gagal memperbarui kontrak pinjaman: ' + upLoanErr.message);

  // C. Kredit saldo admin (uang masuk ke admin)
      const { data: adminAccounts, error: adminFetchErr } = await supabase
        .from('admins')
        .select('id, balance')
        .limit(1);

      if (adminFetchErr || !adminAccounts || adminAccounts.length === 0) {
        throw new Error('Gagal mengambil data admin: ' + (adminFetchErr?.message || 'Tidak ada akun admin ditemukan'));
      }

  const adminNewBalance = Number(adminAccounts[0].balance || 0) + nominalTagihan;
  const { error: upAdminErr } = await supabase
    .from('admins')
    .update({ balance: adminNewBalance })
    .eq('id', adminAccounts[0].id);

  if (upAdminErr) throw new Error('Gagal mengkredit saldo admin: ' + upAdminErr.message);

  return { updatedLoan, newBalance };
}
};