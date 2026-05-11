const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User schema — supports admin and agent roles.
 * Agents receive leads via round-robin assignment.
 * Admins manage the dashboard and can reassign leads.
 */
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    
    role: {
      type: String,
      enum: ['admin', 'agent'],
      default: 'agent'
    },
    leadTypes: [{
      type: String
    }],
    active: {
      type: Boolean,
      default: true
    },
    workStatus: {
      type: String,
      enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
      default: 'AVAILABLE'
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

/**
 * Pre-save hook — hash password only when it's new or modified.
 * Skips if the value is already a bcrypt hash (starts with $2).
 */
UserSchema.pre('save', async function (next) {
  try {
    // Primary password hashing
    if (this.isModified('password')) {
      if (!this.password.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Compare a candidate password against the stored hash.
 */
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
