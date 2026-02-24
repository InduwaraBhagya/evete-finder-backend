// FILE: models/Wishlist.js
// No changes needed — model is correct

const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure unique user-event pairs (no duplicates)
wishlistSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);