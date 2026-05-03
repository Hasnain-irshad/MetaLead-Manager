const mongoose = require('mongoose');

const RETRY_INTERVAL_MS = 5000;

/**
 * Attempts to connect to MongoDB with retry logic.
 * The server will NOT crash if the connection fails — it retries every 5 seconds.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in environment variables.');
    return;
  }

  // ── Connection event listeners (registered once) ──────────────────────
  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
  });

  // ── Retry loop ────────────────────────────────────────────────────────
  const connectWithRetry = async () => {
    while (true) {
      try {
        await mongoose.connect(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          dbName: 'leadbridge',
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        return; // success — exit the loop
      } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        console.log(`🔄 Retrying connection in ${RETRY_INTERVAL_MS / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      }
    }
  };

  await connectWithRetry();
}

module.exports = connectDB;
