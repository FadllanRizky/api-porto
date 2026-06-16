import express from 'express';
import cors from 'cors';
import path from 'path';

// 🔥 ROUTES
import authRoutes from '../routes/authRoute.js';
import categoryRoutes from '../routes/categoryRoute.js';
import productRoutes from '../routes/productRoute.js';
import loanRoutes from '../routes/loanRoute.js'; 
import adminRoute from '../routes/adminRoute.js';
import chatRoute from '../routes/chatRoute.js';
import transactionRoutes from '../routes/transactionRoute.js';
import shippingRegionRoutes from '../routes/shippingRegionRoute.js';
import uploadRoutes from '../routes/uploadRoute.js';

const app = express();

// ================== CORS ==================
const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:5174', // Cadangan kalau port lokal geser
  process.env.FRONTEND_URL // 👈 Menampung alamat Vercel lu nanti boskuh
];

app.use(cors({
  origin: function (origin, callback) {
    // Mengizinkan request tanpa origin (seperti Postman atau internal system)
    if (!origin) return callback(null, true);
    
    // Jika origin ada di dalam daftar, izinkan!
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    } else {
      return callback(new Error('Ditolak oleh sistem keamanan CORS Boskuh!'));
    }
  },
  credentials: true
}));
// ================== BODY PARSER ==================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== STATIC FILE ==================
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ================== HEALTH CHECK ==================
app.get('/', (req, res) => {
  res.json({
    message: '🚀 API Running',
    version: '1.0.0'
  });
});

// ================== ROUTES ==================
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/admin', adminRoute);
app.use('/api/chat', chatRoute);
app.use('/api/transactions', transactionRoutes);
app.use('/api/shipping-regions', shippingRegionRoutes);
app.use('/api/upload', uploadRoutes);

// ================== ERROR HANDLER ==================
app.use((err, req, res, next) => {
  console.error('❌ ERROR:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// ================== 404 ==================
app.use((req, res) => {
  res.status(404).json({
    message: 'Route tidak ditemukan'
  });
});

// ================== RUN SERVER ==================
// Hanya jalankan app.listen jika di komputer lokal (development)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

export default app;

export default app;