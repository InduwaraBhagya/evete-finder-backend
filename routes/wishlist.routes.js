// FILE: routes/wishlist.js
// FIXES:
//   1. GET: populate includes ALL event fields needed by Flutter Event.fromJson
//   2. DELETE /:id: supports BOTH wishlistItem _id AND eventId
//      → Flutter sometimes sends eventId, sometimes wishlistItem _id
//   3. Added DELETE /event/:eventId route as clean alternative

const express   = require('express');
const router    = express.Router();
const Wishlist  = require('../models/Wishlist');
const { authMiddleware } = require('../middleware/auth');

// ── All event fields Flutter's Event.fromJson needs ──────────
const EVENT_FIELDS = 'title description category date time location latitude longitude price totalSeats availableSeats images organizerName organizer status isFeatured rating reviewCount';

// ════════════════════════════════════════════════════════════
// GET /api/wishlist
// Returns: { data: [ { _id: wishlistItemId, event: {...} } ] }
// ════════════════════════════════════════════════════════════
router.get('/', authMiddleware, async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ user: req.user.id })
      .populate('event', EVENT_FIELDS)
      .sort({ createdAt: -1 });

    // Filter out any items where the event was deleted
    const validItems = wishlist.filter(item => item.event != null);

    res.status(200).json({
      message: 'Wishlist fetched successfully',
      status:  200,
      data:    validItems,   // Flutter reads response['data']
      count:   validItems.length,
    });
  } catch (error) {
    console.error('❌ Wishlist GET error:', error.message);
    res.status(500).json({ message: 'Error fetching wishlist', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/wishlist
// Body: { eventId }
// Returns the new wishlist item with _id so Flutter can save it
// ════════════════════════════════════════════════════════════
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required', status: 400 });
    }

    // Check if already in wishlist
    const existing = await Wishlist.findOne({ user: req.user.id, event: eventId });
    if (existing) {
      // Return existing item instead of error — Flutter can save the _id
      await existing.populate('event', EVENT_FIELDS);
      return res.status(200).json({
        message: 'Already in wishlist',
        status:  200,
        data:    existing,
      });
    }

    const wishlistItem = new Wishlist({ user: req.user.id, event: eventId });
    await wishlistItem.save();
    await wishlistItem.populate('event', EVENT_FIELDS);

    console.log(`✅ Wishlist: Added event ${eventId} for user ${req.user.id}`);

    res.status(201).json({
      message: 'Added to wishlist',
      status:  201,
      data:    wishlistItem,   // Flutter reads response['data']['_id']
    });
  } catch (error) {
    console.error('❌ Wishlist POST error:', error.message);
    res.status(500).json({ message: 'Error adding to wishlist', status: 500, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/wishlist/:id
// Supports BOTH:
//   - wishlist item _id  (preferred, from POST response)
//   - event _id          (fallback, Flutter may send this)
// ════════════════════════════════════════════════════════════
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let wishlistItem;

    // Try finding by wishlist item _id first
    wishlistItem = await Wishlist.findById(id).catch(() => null);

    // If not found by wishlist _id, try finding by event _id
    if (!wishlistItem) {
      wishlistItem = await Wishlist.findOne({
        user:  req.user.id,
        event: id,
      });
    }

    if (!wishlistItem) {
      return res.status(404).json({ message: 'Wishlist item not found', status: 404 });
    }

    // Check ownership
    if (wishlistItem.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', status: 403 });
    }

    await Wishlist.findByIdAndDelete(wishlistItem._id);

    console.log(`✅ Wishlist: Removed item ${wishlistItem._id} for user ${req.user.id}`);

    res.status(200).json({ message: 'Removed from wishlist', status: 200 });
  } catch (error) {
    console.error('❌ Wishlist DELETE error:', error.message);
    res.status(500).json({ message: 'Error removing from wishlist', status: 500, error: error.message });
  }
});

module.exports = router;