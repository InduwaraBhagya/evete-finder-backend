// FILE: routes/events.js

const express    = require('express');
const router     = express.Router();
const Event      = require('../models/Event');
const Booking    = require('../models/Booking');
const User       = require('../models/User');   // ✅ NEW: to fetch organizerName
const { authMiddleware, organizerMiddleware } = require('../middleware/auth');

// ── Cloudinary + Multer setup ─────────────────────────────────
const cloudinary            = require('cloudinary').v2;
const multer                = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('☁️  Cloudinary config check:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME  || '❌ MISSING',
  api_key:    process.env.CLOUDINARY_API_KEY     ? '✅ set' : '❌ MISSING',
  api_secret: process.env.CLOUDINARY_API_SECRET  ? '✅ set' : '❌ MISSING',
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'event_finder/events',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 800, height: 500, crop: 'fill', quality: 'auto' }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ✅ Wrap upload so errors return JSON instead of silent server crash
const uploadSingle = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('❌ Cloudinary/Multer error:', err.message);
      return res.status(500).json({
        message: `Image upload failed: ${err.message}`,
        status:  500,
      });
    }
    next();
  });
};

// ════════════════════════════════════════════════════════════
// GET /api/events  — PUBLIC, approved only
// ════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { category, sortBy, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true, status: 'approved' };
    if (category) query.category = category;

    let sortOptions = { createdAt: -1 };
    if (sortBy === 'price_asc')  sortOptions = { price: 1 };
    if (sortBy === 'price_desc') sortOptions = { price: -1 };
    if (sortBy === 'rating')     sortOptions = { rating: -1 };

    const events = await Event.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('organizer', 'name email');

    const total = await Event.countDocuments(query);

    res.status(200).json({
      message: 'Events fetched successfully',
      status:  200,
      data:    events,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/events/featured  ← BEFORE /:id
// ════════════════════════════════════════════════════════════
router.get('/featured', async (req, res) => {
  try {
    const events = await Event.find({ isFeatured: true, isActive: true, status: 'approved' })
      .limit(6)
      .populate('organizer', 'name email');
    res.status(200).json({ message: 'Featured events fetched successfully', status: 200, data: events });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching featured events', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/events/search/query  ← BEFORE /:id
// ════════════════════════════════════════════════════════════
router.get('/search/query', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Search query required', status: 400 });

    const events = await Event.find({
      $or: [
        { title:       { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { location:    { $regex: q, $options: 'i' } },
        { category:    { $regex: q, $options: 'i' } },
      ],
      isActive: true,
      status: 'approved',
    });

    res.status(200).json({ message: 'Search results', status: 200, data: events });
  } catch (error) {
    res.status(500).json({ message: 'Error searching events', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/events/admin/all  ← BEFORE /:id
// ════════════════════════════════════════════════════════════
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

    res.status(200).json({ message: 'All events fetched', status: 200, data: events, events });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/events/organizer/my-events  ← BEFORE /:id
// ════════════════════════════════════════════════════════════
router.get('/organizer/my-events', authMiddleware, async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id })
      .sort({ createdAt: -1 });
    res.status(200).json({ message: 'Your events fetched', status: 200, data: events, events });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching your events', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/events/:id  ← AFTER all specific routes
// ════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email phone')
      .populate({
        path:     'bookings',
        select:   'user numberOfSeats status',
        populate: { path: 'user', select: 'name email' },
      });

    if (!event) return res.status(404).json({ message: 'Event not found', status: 404 });
    res.status(200).json({ message: 'Event fetched successfully', status: 200, data: event });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/events  — CREATE EVENT
// ✅ FIX 1: uploadSingle wrapper catches Cloudinary errors as JSON
// ✅ FIX 2: organizerName fetched from User model (req.user.name is undefined from JWT)
// ════════════════════════════════════════════════════════════
router.post('/', authMiddleware, organizerMiddleware, uploadSingle, async (req, res) => {
  try {
    console.log('📥 POST /api/events');
    console.log('📦 Body:', req.body);
    console.log('🖼️  File:', req.file ? req.file.path : 'none');

    const {
      title, description, category, date, time,
      location, latitude, longitude, price, totalSeats,
    } = req.body;

    if (!title || !description || !category || !date || !time || !location || !price || !totalSeats) {
      return res.status(400).json({ message: 'Missing required fields', status: 400 });
    }

    // ✅ FIX: req.user.name is undefined because JWT only stores id + role
    // Fetch full user from DB to get name
    const userDoc = await User.findById(req.user.id).select('name email');
    const organizerName = userDoc?.name || req.user.name || req.user.email || 'Organizer';
    console.log('👤 organizerName:', organizerName);

    const imageUrl = req.file ? req.file.path : '';
    console.log('☁️  Cloudinary URL:', imageUrl || 'no image');

    const event = new Event({
      title,
      description,
      category,
      date:           new Date(date),
      time,
      location,
      latitude:       parseFloat(latitude)  || 0,
      longitude:      parseFloat(longitude) || 0,
      price:          parseFloat(price),
      totalSeats:     parseInt(totalSeats),
      availableSeats: parseInt(totalSeats),
      images:         imageUrl ? [imageUrl] : [],
      organizer:      req.user.id,
      organizerName,                          // ← from DB lookup
      status:         'pending',
      adminNote:      '',
    });

    await event.save();
    console.log(`✅ Saved: "${event.title}" | organizer: ${organizerName} | image: ${imageUrl || 'none'}`);

    res.status(201).json({
      message: 'Event submitted for admin approval.',
      status:  201,
      data:    event,
      event,
    });
  } catch (error) {
    console.error('❌ Create event error:', error.message);
    res.status(500).json({ message: 'Error creating event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/events/:id/approve
// ════════════════════════════════════════════════════════════
router.patch('/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', adminNote: '', reviewedAt: new Date(), reviewedBy: req.user.id },
      { new: true }
    ).populate('organizer', 'name email');

    if (!event) return res.status(404).json({ message: 'Event not found' });

    console.log(`✅ Approved: "${event.title}"`);
    res.status(200).json({
      message: `"${event.title}" approved — now visible on events page`,
      status:  200, data: event, event,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error approving event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/events/:id/reject
// ════════════════════════════════════════════════════════════
router.patch('/:id/reject', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }

    const { reason } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ message: 'Please provide a rejection reason (min 5 characters)' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', adminNote: reason.trim(), reviewedAt: new Date(), reviewedBy: req.user.id },
      { new: true }
    ).populate('organizer', 'name email');

    if (!event) return res.status(404).json({ message: 'Event not found' });

    console.log(`❌ Rejected: "${event.title}" | reason: ${reason}`);
    res.status(200).json({
      message: `"${event.title}" rejected. Organizer will see reason in My Events.`,
      status:  200, data: event, event,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PUT /api/events/:id — organizer updates own event
// ════════════════════════════════════════════════════════════
router.put('/:id', authMiddleware, organizerMiddleware, uploadSingle, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found', status: 404 });

    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this event', status: 403 });
    }

    const { title, description, date, time, location, price, totalSeats, isFeatured } = req.body;

    if (req.file) event.images = [req.file.path];

    Object.assign(event, {
      title:       title       || event.title,
      description: description || event.description,
      date:        date ? new Date(date) : event.date,
      time:        time        || event.time,
      location:    location    || event.location,
      price:       price       !== undefined ? parseFloat(price) : event.price,
      totalSeats:  totalSeats  ? parseInt(totalSeats) : event.totalSeats,
      isFeatured:  isFeatured  !== undefined ? isFeatured : event.isFeatured,
      status:      'pending',
      adminNote:   '',
    });

    await event.save();
    res.status(200).json({ message: 'Event updated — resubmitted for approval', status: 200, data: event });
  } catch (error) {
    res.status(500).json({ message: 'Error updating event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/events/:id
// ════════════════════════════════════════════════════════════
router.delete('/:id', authMiddleware, organizerMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found', status: 404 });

    if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this event', status: 403 });
    }

    if (event.images && event.images.length > 0) {
      try {
        const imageUrl = event.images[0];
        if (imageUrl.includes('cloudinary.com')) {
          const parts    = imageUrl.split('/');
          const filename = parts[parts.length - 1].split('.')[0];
          await cloudinary.uploader.destroy(`event_finder/events/${filename}`);
        }
      } catch (e) {
        console.error('Cloudinary delete error:', e.message);
      }
    }

    await Event.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Event deleted successfully', status: 200 });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', status: 500, error: error.message });
  }
});

module.exports = router;