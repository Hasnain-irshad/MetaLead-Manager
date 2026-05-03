require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 4000;

// Start the HTTP server immediately so the process stays alive,
// then connect to MongoDB (with built-in retry logic).
app.listen(PORT, () => {
  console.log(`LeadBridge running on port ${PORT}`);
});

// connectDB retries internally and never throws, so the server stays up
// even if MongoDB is temporarily unreachable.
connectDB().catch((err) => {
  console.error('Unexpected error in connectDB:', err);
});
