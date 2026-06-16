import 'dotenv/config'; // Tetap paling atas
import app from '../src/app.js';

// Langsung export aplikasi Express-nya, Vercel yang akan handle sisanya
export default app;