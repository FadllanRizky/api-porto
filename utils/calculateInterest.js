/**
 * Utility untuk menghitung rincian pinjaman (Flat Rate)
 * @param {number} amount - Jumlah pinjaman pokok
 * @param {number} interestRate - Persentase bunga (default 5%)
 * @param {number} tenorMonths - Durasi tenor dalam bulan (default 6)
 * @returns {object} - Hasil rincian kalkulasi
 */
export const calculateLoan = (amount, interestRate = 5, tenorMonths = 6) => {
  const finalAmount = Number(amount || 0);
  const finalTenor = parseInt(tenorMonths || 6);
  const finalRate = Number(interestRate || 5);

  // Hitung Pokok per bulan
  const principalPerMonth = finalAmount / finalTenor;
  // Hitung Bunga per bulan
  const interestPerMonth = (finalAmount * (finalRate / 100)) / finalTenor;
  // Total cicilan bulanan (di-round bulat)
  const monthlyPayment = Math.round(principalPerMonth + interestPerMonth);

  return {
    loan_amount: finalAmount,
    tenure_month: finalTenor,
    interest_rate: finalRate,
    monthly_payment: monthlyPayment,
    total_payment: monthlyPayment * finalTenor
  };
};