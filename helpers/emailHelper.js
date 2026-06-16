import { Resend } from 'resend';

// Inisialisasi kurir handal Resend menggunakan API Key dari .env
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Fungsi Inti Pengirim Email Notifikasi menggunakan Resend
 */
export const sendEmailNotification = async (to, subject, htmlContent) => {
  if (!to) {
    console.error('❌ Gagal kirim email: Alamat email tujuan user kosong!');
    return { success: false, error: 'No recipient email' };
  }

  try {
    // 🔥 TRICK: Selama masih tahap testing (sandbox), alihkan semua tujuan ke email kamu
    const emailTujuan = 'fadllanrizky321@gmail.com'; 

    const { data, error } = await resend.emails.send({
      from: 'Mbur Loan System ⚡ <onboarding@resend.dev>',
      to: [emailTujuan], // Kodingan asli 'to' diganti sementara ke emailTujuan
      subject: `${subject} (Testing untuk: ${to})`, // Tetap pantau email asli di subject
      html: htmlContent
    });

    if (error) {
      console.error('❌ Gagal mengirim via Resend API:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`📧 GOKIL! Resend sukses mengalihkan email testing ke: ${emailTujuan}`);
    return { success: true, data };
  } catch (error) { 
    console.error('❌ Crash fatal pada komponen Resend Helper:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Template Desain HTML Email bertema Premium Dark Mode
 */
export const generateLoanTemplate = (userName, status, loanDetails) => {
  let statusColor = '#eab308'; // Pending = Kuning
  let statusText = 'MENUNGGU PERSETUJUAN (PENDING)';

  if (status === 'approved') {
    statusColor = '#10b981'; // Approved = Hijau
    statusText = 'DISETUJUI (APPROVED)';
  } else if (status === 'rejected') {
    statusColor = '#ef4444'; // Rejected = Merah
    statusText = 'DITOLAK (REJECTED)';
  }

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0a0a0a; color: #e5e5e5; padding: 30px; border-radius: 12px; max-width: 550px; margin: 0 auto; border: 1px solid #1f1f1f;">
      <h2 style="color: #38bdf8; border-bottom: 2px solid #1f1f1f; padding-bottom: 15px; margin-top: 0; font-size: 20px; letter-spacing: 1px;">⚡ MBUR SYSTEM NOTIFICATION</h2>
      <p style="font-size: 15px; color: #a3a3a3;">Halo <strong style="color: #ffffff;">${userName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #a3a3a3;">Ada pembaruan data terkait aktivitas transaksi/pengajuan pinjaman pada akun Anda. Berikut rincian detailnya:</p>
      
      <div style="background-color: #121212; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #262626; border-left: 5px solid ${statusColor};">
        <p style="margin: 0 0 15px 0; font-size: 12px; font-weight: bold; color: #737373; text-transform: uppercase;">
          STATUS SAAT INI: <span style="color: ${statusColor}; font-size: 13px;">${statusText}</span>
        </p>
        <table style="width: 100%; font-size: 14px; color: #d4d4d4; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #737373;">Tipe Komitmen</td>
            <td style="padding: 8px 0; text-align: right; color: #ffffff; font-weight: 500;">${loanDetails.type === 'cash' ? 'Pinjaman Uang Tunai' : 'Kredit Pembelian Barang'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #737373;">Nominal Pokok</td>
            <td style="padding: 8px 0; text-align: right; color: #ffffff; font-weight: 500;">Rp ${Number(loanDetails.loan_amount).toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #737373;">Tenor Pembayaran</td>
            <td style="padding: 8px 0; text-align: right; color: #ffffff; font-weight: 500;">${loanDetails.tenure_month} Bulan</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #737373;">Bunga Admin</td>
            <td style="padding: 8px 0; text-align: right; color: #38bdf8; font-weight: 500;">${loanDetails.interest_rate}%</td>
          </tr>
          <tr style="border-top: 1px solid #262626;">
            <td style="padding: 12px 0 0 0; color: #ffffff; font-weight: bold;">Cicilan / Bulan</td>
            <td style="padding: 12px 0 0 0; text-align: right; color: #38bdf8; font-weight: bold; font-size: 16px;">Rp ${Number(loanDetails.monthly_payment).toLocaleString('id-ID')}</td>
          </tr>
        </table>
      </div>
      
      <p style="font-size: 11px; color: #525252; line-height: 1.5; margin-bottom: 0; border-top: 1px solid #1f1f1f; padding-top: 15px;">
        *Email ini dikirim otomatis secara real-time langsung ke Gmail terdaftar Anda. Jika Anda merasa tidak mengenali aktivitas ini, segera ganti password akun Anda atau hubungi Admin IT Mbur System.
      </p>
    </div>
  `;
};