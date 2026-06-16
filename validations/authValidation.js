export const validateRegister = (req, res, next) => {
  let { email, password, full_name } = req.body;

  // 🔥 trim biar bersih
  email = email?.trim();
  full_name = full_name?.trim();

  // email wajib
  if (!email) {
    return res.status(400).json({ message: 'Email wajib diisi' });
  }

  // password wajib
  if (!password) {
    return res.status(400).json({ message: 'Password wajib diisi' });
  }

  // full name wajib
  if (!full_name) {
    return res.status(400).json({ message: 'Full name wajib diisi' });
  }

  // 🔥 panjang nama
  if (full_name.length < 3) {
    return res.status(400).json({
      message: 'Full name minimal 3 karakter'
    });
  }

  if (full_name.length > 30) {
    return res.status(400).json({
      message: 'Full name maksimal 30 karakter'
    });
  }

  // validasi email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: 'Format email tidak valid'
    });
  }

  // 🔥 password minimal 8 karakter
  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password minimal 8 karakter'
    });
  }

  // 🔥 password harus ada:
  // huruf besar, huruf kecil, angka
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
  if (!strongPassword.test(password)) {
    return res.status(400).json({
      message: 'Password harus mengandung huruf besar, huruf kecil, dan angka'
    });
  }

  // 🔥 inject ulang biar sudah bersih
  req.body.email = email;
  req.body.full_name = full_name;

   if (!email || !password) {
    return res.status(400).json({
      message: 'Email dan password wajib diisi'
    });
  }

  next();
};