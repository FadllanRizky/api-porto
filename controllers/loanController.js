import path from 'path';
import { supabase } from '../config/db.js';
import { loanService } from '../services/loanService.js';
import { successResponse, errorResponse } from '../utils/responHandler.js';

// KTP disimpan di bucket yang sama dengan avatar (prefix ktp/) agar cukup buat 1 bucket public "avatars".
// Bisa dioverride via env SUPABASE_KTP_BUCKET jika mau bucket terpisah.
const KTP_BUCKET = process.env.SUPABASE_KTP_BUCKET || process.env.SUPABASE_AVATAR_BUCKET || 'avatars';

function extFrom(mimetype, originalname) {
  const fromName = (path.extname(originalname || '') || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(fromName)) return fromName;
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  return '.jpg';
}

export const createLoan = async (req, res) => {
  try {
    const bodyData = { ...req.body };

    // req.file kini memoryStorage (buffer), bukan disk → upload ke Supabase Storage (Vercel-safe, anti-EROFS)
    if (req.file && req.file.buffer) {
      const ext = extFrom(req.file.mimetype, req.file.originalname);
      const filename = `ktp-${req.user.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const storagePath = `ktp/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(KTP_BUCKET)
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        return errorResponse(
          res,
          `Gagal menyimpan foto KTP ke Storage "${KTP_BUCKET}": ${uploadError.message}. Pastikan bucket public "${KTP_BUCKET}" sudah dibuat di Supabase Dashboard → Storage.`,
          500
        );
      }

      const { data: urlData } = supabase.storage.from(KTP_BUCKET).getPublicUrl(storagePath);
      if (!urlData?.publicUrl) {
        return errorResponse(res, 'Gagal mendapatkan URL publik foto KTP.', 500);
      }
      bodyData.id_card_url = urlData.publicUrl;
    }

    const data = await loanService.create(bodyData, req.user);
    return successResponse(res, "Pengajuan pinjaman berhasil diproses dan notifikasi terkirim!", data, 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getMyLoans = async (req, res) => {
  try {
    const data = await loanService.getByUser(req.user);
    return successResponse(res, "Berhasil mengambil data pinjaman Anda", data);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getAllLoans = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return errorResponse(res, 'Akses ditolak. Anda bukan admin, bos!', 403);
    }
    const data = await loanService.getAllLoansForAdmin();
    return successResponse(res, "Berhasil mengambil semua data antrean pinjaman (Admin)", data);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const payLoanInstallment = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loanService.payInstallment(id, req.user);
    return successResponse(res, "Pembayaran cicilan berhasil diproses!", data);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const updateLoanStatus = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return errorResponse(res, 'Akses ditolak. Anda bukan admin, bos!', 403);
    }

    const { id } = req.params;
    const { status } = req.body;

    const data = await loanService.updateStatusByAdmin(id, status, req.user.id);
    return successResponse(res, `Berhasil mengubah status pinjaman menjadi ${status.toLowerCase()}`, data);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};
