// ============================================================
// FILE 1: models/Event.js
// Complete Event schema with Cloudinary image + approval fields
// ============================================================

const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ── Cloudinary config ─────────────────────────────────────────
// Add these to your .env file:
//   CLOUDINARY_CLOUD_NAME=your_cloud_name
//   CLOUDINARY_API_KEY=your_api_key
//   CLOUDINARY_API_SECRET=your_api_secret
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer-Cloudinary storage ─────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'event_finder/events',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 500, crop: 'fill', quality: 'auto' }],
  },
});

// Upload middleware — use in route: upload.single('image')
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ── Event Schema ──────────────────────────────────────────────
const eventSchema = new mongoose.Schema({
  title:          { type: String, required: true, trim: true },
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

  // Cloudinary image URL — saved after upload
  imageUrl:       { type: String, default: '' },

  // For backward compat — array of image URLs
  images:         [{ type: String }],

  organizer:      {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', required: true
  },
  organizerName:  { type: String, default: '' },
  rating:         { type: Number, default: 0 },
  reviewCount:    { type: Number, default: 0 },
  isActive:       { type: Boolean, default: true },

  // ── Approval workflow ──────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',   // NEW events start as pending — not visible to public
  },
  adminNote: {
    type: String,
    default: '',          // Admin rejection reason — shown to organizer in app
  },
  reviewedAt: { type: Date },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

const Event = mongoose.model('Event', eventSchema);
module.exports = { Event, upload };


// ============================================================
// FILE 2: routes/events.js
// COMPLETE routes file — replace your existing one with this
// ============================================================

const express    = require('express');
const router     = express.Router();
const { Event, upload } = require('../models/Event');
const authMiddleware = require('../middleware/auth'); // your existing auth middleware

// Helper: delete image from Cloudinary using its URL
async function deleteCloudinaryImage(imageUrl) {
  if (!imageUrl || !imageUrl.includes('cloudinary.com')) return;
  try {
    // Extract public_id from URL
    // URL format: https://res.cloudinary.com/<cloud>/image/upload/v123/<folder>/<id>.ext
    const parts   = imageUrl.split('/');
    const file    = parts[parts.length - 1];              // e.g. "abc123.jpg"
    const folder  = parts[parts.length - 2];              // e.g. "events"
    const publicId = `event_finder/${folder}/${file.split('.')[0]}`;
    const cloudinary = require('cloudinary').v2;
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
}


// ════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ════════════════════════════════════════════════════════════════

// GET /api/events
// Returns ONLY approved events — pending/rejected are hidden from public
router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 50 } = req.query;

    // ✅ CRITICAL: only show approved events to users
    const query = { status: 'approved', isActive: true };

    if (category && category !== 'All') {
      query.category = category;
    }
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .sort({ date: 1 })
      .limit(Number(limit));

    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/:id — single event (anyone can view approved events)
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════════════
// ORGANIZER ROUTES (auth required, organizer role)
// ════════════════════════════════════════════════════════════════

// POST /api/events (or /api/organizer/events — match AppConfig.organizerEventsEndpoint)
// Creates event with status='pending' — uploaded image goes to Cloudinary
// upload.single('image') handles the multipart file
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const body = req.body;

    // Parse numeric fields (they come as strings from multipart)
    const eventData = {
      title:          body.title,
      description:    body.description,
      category:       body.category,
      date:           new Date(body.date),
      time:           body.time,
      location:       body.location,
      latitude:       parseFloat(body.latitude)       || 0,
      longitude:      parseFloat(body.longitude)      || 0,
      price:          parseFloat(body.price)          || 0,
      isFree:         body.isFree === 'true',
      totalSeats:     parseInt(body.totalSeats)       || 0,
      availableSeats: parseInt(body.availableSeats)   || 0,
      isFeatured:     body.isFeatured === 'true',
      organizer:      body.organizer,
      organizerName:  body.organizerName || '',
      isActive:       true,
      status:         'pending',   // Always starts as pending — admin must approve
    };

    // If image was uploaded, Cloudinary URL is in req.file.path
    if (req.file) {
      eventData.imageUrl = req.file.path;       // Cloudinary URL
      eventData.images   = [req.file.path];     // Also populate images array
      console.log('✅ Image uploaded to Cloudinary:', req.file.path);
    } else {
      eventData.imageUrl = '';
      eventData.images   = [];
      console.log('ℹ️ No image uploaded — event saved without image');
    }

    const event = new Event(eventData);
    await event.save();

    console.log(`📋 New event created: "${event.title}" | status: pending`);

    res.status(201).json({
      success: true,
      message: 'Event submitted for admin approval',
      event,
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/organizer/my-events
// Returns ALL events by this organizer (pending + approved + rejected)
// Organizer sees status + adminNote for rejected events
router.get('/organizer/my-events', authMiddleware, async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/events/:id — update event (organizer updates own event)
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Only the organizer or admin can edit
    if (event.organizer.toString() !== req.user.id &&
        req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updates = { ...req.body };

    // Parse numeric fields
    if (updates.latitude)  updates.latitude  = parseFloat(updates.latitude);
    if (updates.longitude) updates.longitude = parseFloat(updates.longitude);
    if (updates.price)     updates.price     = parseFloat(updates.price);
    if (updates.totalSeats) updates.totalSeats = parseInt(updates.totalSeats);
    if (updates.availableSeats) updates.availableSeats = parseInt(updates.availableSeats);

    // Handle new image upload
    if (req.file) {
      // Delete old image from Cloudinary
      await deleteCloudinaryImage(event.imageUrl);
      updates.imageUrl = req.file.path;
      updates.images   = [req.file.path];
    }

    // Reset to pending if organizer edits — needs re-approval
    if (req.user.role !== 'admin') {
      updates.status    = 'pending';
      updates.adminNote = '';
    }

    const updated = await Event.findByIdAndUpdate(
      req.params.id, updates, { new: true });
    res.json({ success: true, event: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════════════
// ADMIN ROUTES (auth required, admin role only)
// ════════════════════════════════════════════════════════════════

// GET /api/events/admin/all
// Returns all events regardless of status — for admin dashboard
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }
    const { status } = req.query;
    const query = status ? { status } : {};

    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/events/admin/pending
// Returns only pending events — for admin notification badge
router.get('/admin/pending', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }
    const events = await Event.find({ status: 'pending' })
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: events.length, events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/events/:id/approve
// Admin approves event → status='approved' → appears on public events page
router.patch('/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        status:     'approved',
        adminNote:  req.body.note || 'Approved',
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
      },
      { new: true }
    ).populate('organizer', 'name email');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log(`✅ Event approved: "${event.title}" by admin ${req.user.id}`);

    // TODO: Send push notification to organizer here
    // e.g. await sendNotification(event.organizer._id, 'Event approved!', ...)

    res.json({
      success: true,
      message: `"${event.title}" approved and is now live`,
      event,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/events/:id/reject
// Admin rejects event with a reason → saved as adminNote
// Organizer sees the reason in their "My Events" screen
router.patch('/:id/reject', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }

    const { reason } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        message: 'Please provide a rejection reason (min 5 characters)'
      });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        status:     'rejected',
        adminNote:  reason.trim(),   // ← This is shown to organizer in app
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
      },
      { new: true }
    ).populate('organizer', 'name email');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log(`❌ Event rejected: "${event.title}" | Reason: ${reason}`);
    console.log(`   Organizer: ${event.organizer?.email} will see reason in My Events`);

    // TODO: Send push notification to organizer here
    // e.g. await sendNotification(event.organizer._id, 'Event rejected', reason)

    res.json({
      success: true,
      message: `"${event.title}" rejected. Organizer notified via app.`,
      event,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/events/:id
// Admin or organizer (own event) can delete
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.organizer.toString() !== req.user.id &&
        req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete image from Cloudinary
    await deleteCloudinaryImage(event.imageUrl);

    await Event.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;