// FILE: routes/events.js
// Based on your original file — added approval workflow
// KEY FIX: specific routes (/featured, /admin/all, /organizer/my-events)
// MUST come BEFORE /:id — otherwise Express treats them as IDs and crashes

const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { authMiddleware, organizerMiddleware } = require('../middleware/auth');

// ════════════════════════════════════════════════════════════
// GET /api/events
// PUBLIC — returns ONLY approved events for the events list page
// CHANGED: added { status: 'approved' } to query
// ════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { category, sortBy, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // ✅ ONLY show approved events to public users
    let query = { isActive: true, status: 'approved' };

    if (category) {
      query.category = category;
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === 'price_asc') sortOptions = { price: 1 };
    else if (sortBy === 'price_desc') sortOptions = { price: -1 };
    else if (sortBy === 'rating') sortOptions = { rating: -1 };

    const events = await Event.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('organizer', 'name email');

    const total = await Event.countDocuments(query);

    res.status(200).json({
      message: 'Events fetched successfully',
      status: 200,
      data: events,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/events/featured    ← BEFORE /:id
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
// GET /api/events/search/query    ← BEFORE /:id
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
      status: 'approved', // ✅ search only approved events
    });

    res.status(200).json({ message: 'Search results', status: 200, data: events });
  } catch (error) {
    res.status(500).json({ message: 'Error searching events', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/events/admin/all    ← BEFORE /:id  ⚠️ CRITICAL ORDER
// ADMIN — see all events (pending + approved + rejected)
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
// GET /api/events/organizer/my-events    ← BEFORE /:id  ⚠️ CRITICAL ORDER
// ORGANIZER — their own events with all statuses
// Rejected events include adminNote so organizer sees the reason
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
// GET /api/events/:id    ← AFTER all specific routes
// ════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email phone')
      .populate({
        path: 'bookings',
        select: 'user numberOfSeats status',
        populate: { path: 'user', select: 'name email' },
      });

    if (!event) return res.status(404).json({ message: 'Event not found', status: 404 });

    res.status(200).json({ message: 'Event fetched successfully', status: 200, data: event });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/events
// ORGANIZER creates event — saved with status='pending'
// Admin must approve before it shows on the events page
// CHANGED: added status:'pending', removed image upload (no multer needed)
// ════════════════════════════════════════════════════════════
router.post('/', authMiddleware, organizerMiddleware, async (req, res) => {
  try {
    const {
      title, description, category, date, time,
      location, latitude, longitude, price, totalSeats, images,
    } = req.body;

    if (!title || !description || !category || !date || !time || !location || !price || !totalSeats) {
      return res.status(400).json({ message: 'Missing required fields', status: 400 });
    }

    const event = new Event({
      title,
      description,
      category,
      date:           new Date(date),
      time,
      location,
      latitude,
      longitude,
      price,
      totalSeats,
      availableSeats: totalSeats,
      images:         images || [],
      organizer:      req.user.id,       // ✅ taken from auth token — not from body
      organizerName:  req.user.name,
      status:         'pending',         // ✅ NEW — waits for admin approval
      adminNote:      '',
    });

    await event.save();

    console.log(`📋 New event: "${event.title}" | organizer: ${req.user.name} | status: pending`);

    res.status(201).json({
      message: 'Event submitted for admin approval. It will appear on the events page once approved.',
      status:  201,
      data:    event,
      event,   // ← Flutter reads response['event']
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Error creating event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/events/:id/approve
// ADMIN approves event → status='approved' → shows on events page
// ════════════════════════════════════════════════════════════
router.patch('/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        status:     'approved',
        adminNote:  '',
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
      },
      { new: true }
    ).populate('organizer', 'name email');

    if (!event) return res.status(404).json({ message: 'Event not found' });

    console.log(`✅ Approved: "${event.title}"`);

    res.status(200).json({
      message: `"${event.title}" approved — now visible on events page`,
      status:  200,
      data:    event,
      event,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error approving event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/events/:id/reject
// ADMIN rejects event with a reason
// reason saved as adminNote — organizer sees it in My Events screen
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
      {
        status:     'rejected',
        adminNote:  reason.trim(),   // ← organizer reads this in My Events
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
      },
      { new: true }
    ).populate('organizer', 'name email');

    if (!event) return res.status(404).json({ message: 'Event not found' });

    console.log(`❌ Rejected: "${event.title}" | reason: ${reason}`);

    res.status(200).json({
      message: `"${event.title}" rejected. Organizer will see the reason in My Events.`,
      status:  200,
      data:    event,
      event,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting event', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// PUT /api/events/:id  — update (organizer own event)
// ════════════════════════════════════════════════════════════
router.put('/:id', authMiddleware, organizerMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found', status: 404 });

    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this event', status: 403 });
    }

    const { title, description, date, time, location, price, totalSeats, images, isFeatured } = req.body;

    Object.assign(event, {
      title:       title       || event.title,
      description: description || event.description,
      date:        date ? new Date(date) : event.date,
      time:        time        || event.time,
      location:    location    || event.location,
      price:       price       !== undefined ? price       : event.price,
      totalSeats:  totalSeats  || event.totalSeats,
      images:      images      || event.images,
      isFeatured:  isFeatured  !== undefined ? isFeatured : event.isFeatured,
      // Reset to pending when organizer edits — needs re-approval
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

    await Event.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Event deleted successfully', status: 200 });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', status: 500, error: error.message });
  }
});

module.exports = router;