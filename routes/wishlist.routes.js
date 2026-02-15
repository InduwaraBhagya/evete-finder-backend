const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const { authMiddleware } = require('../middleware/auth');

// Get User's Wishlist
router.get('/', authMiddleware, async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ user: req.user.id })
      .populate('event', 'title description category date time location price availableSeats images')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Wishlist fetched successfully',
      status: 200,
      data: wishlist,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching wishlist',
      status: 500,
      error: error.message,
    });
  }
});

// Add to Wishlist
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        message: 'Event ID is required',
        status: 400,
      });
    }

    // Check if already in wishlist
    const existing = await Wishlist.findOne({ user: req.user.id, event: eventId });
    if (existing) {
      return res.status(400).json({
        message: 'Event already in wishlist',
        status: 400,
      });
    }

    const wishlistItem = new Wishlist({
      user: req.user.id,
      event: eventId,
    });

    await wishlistItem.save();
    await wishlistItem.populate('event', 'title description category price');

    res.status(201).json({
      message: 'Added to wishlist',
      status: 201,
      data: wishlistItem,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error adding to wishlist',
      status: 500,
      error: error.message,
    });
  }
});

// Remove from Wishlist
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const wishlistItem = await Wishlist.findById(req.params.id);

    if (!wishlistItem) {
      return res.status(404).json({
        message: 'Wishlist item not found',
        status: 404,
      });
    }

    if (wishlistItem.user.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized to delete this item',
        status: 403,
      });
    }

    await Wishlist.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: 'Removed from wishlist',
      status: 200,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error removing from wishlist',
      status: 500,
      error: error.message,
    });
  }
});

module.exports = router;
