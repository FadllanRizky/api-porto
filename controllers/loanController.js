import { loanService } from '../services/loanService.js';
import { successResponse, errorResponse } from '../utils/responHandler.js';

export const createLoan = async (req, res) => {
  try {
    const bodyData = { ...req.body };

    if (req.file) {
      bodyData.id_card_url = `/uploads/${req.file.filename}`;
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