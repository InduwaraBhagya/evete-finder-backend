// ============================================================
// STEP 1: Update your Event MongoDB model
// FILE: models/Event.js
// Add 'status' field to your existing schema
// ============================================================

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  description:    { type: String, required: true },
  category:       { type: String, required: true },
  date:           { type: Date,   required: true },
  time:           { type: String, required: true },
  location:       { type: String, required: true },
  latitude:       { type: Number, default: 0 },
  longitude:      { type: Number, default: 0 },
  price:          { type: Number, default: 0 },
  isFree:         { type: Boolean, default: false },
  totalSeats:     { type: Number, default: 0 },
  availableSeats: { type: Number, default: 0 },
  isFeatured:     { type: Boolean, default: false },
  imageUrl:       { type: String, default: '' },
  organizer:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizerName:  { type: String },
  rating:         { type: Number, default: 0 },
  reviewCount:    { type: Number, default: 0 },
  isActive:       { type: Boolean, default: true },

  // ✅ NEW: Approval workflow fields
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',   // Every new event starts as pending
  },
  adminNote: {
    type: String,
    default: '',          // Admin rejection reason / message to organizer
  },
  reviewedAt: {
    type: Date,           // When admin approved/rejected
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',          // Which admin approved/rejected
  },
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);


// ============================================================
// STEP 2: Add these routes to your routes/events.js
// (Add alongside your existing routes)
// ============================================================

// ── GET /api/events/pending  (Admin only — all pending events) ─
router.get('/admin/pending', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    const events = await Event.find({ status: 'pending' })
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/events/admin/all  (Admin — all events with status) ─
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    const { status } = req.query; // ?status=pending|approved|rejected
    const query = status ? { status } : {};
    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/events/:id/approve  (Admin approves event) ──────
router.patch('/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        adminNote: req.body.note || 'Approved',
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
      },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/events/:id/reject  (Admin rejects with reason) ──
router.patch('/:id/reject', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    const { reason } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        adminNote: reason.trim(),
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
      },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/events  (Public — ONLY show approved events) ───────
// Update your existing GET / route to filter by approved:
router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 50 } = req.query;
    let query = { status: 'approved' }; // ✅ Only approved events visible to users
    if (category && category !== 'All') query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };

    const events = await Event.find(query)
      .sort({ date: 1 })
      .limit(Number(limit));

    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/events/organizer/my-events  (Organizer's own events) ─
router.get('/organizer/my-events', authMiddleware, async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});