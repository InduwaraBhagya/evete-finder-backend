const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
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
    numberOfSeats: {
      type: Number,
      required: true,
      min: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['confirmed', 'pending', 'cancelled'],
      default: 'confirmed',
    },
    paymentId: {
      type: String,
      default: null,
    },
    qrCode: {
      type: String,
      default: null,
    },
    bookingRef: {
      type: String,
      unique: true,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Generate booking reference before saving
bookingSchema.pre('save', function(next) {
  if (!this.bookingRef) {
    this.bookingRef = 'BK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
