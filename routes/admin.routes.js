const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get Dashboard Stats
router.get('/dashboard/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEvents = await Event.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const totalRevenue = await Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]);

    res.status(200).json({
      message: 'Dashboard stats',
      status: 200,
      data: {
        totalUsers,
        totalEvents,
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching stats',
      status: 500,
      error: error.message,
    });
  }
});

// Get All Users (Admin only)
router.get('/users/list', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password');

    res.status(200).json({
      message: 'Users fetched successfully',
      status: 200,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching users',
      status: 500,
      error: error.message,
    });
  }
});

// Get All Events (Admin only)
router.get('/events/list', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const events = await Event.find().populate('organizer', 'name email');

    res.status(200).json({
      message: 'Events fetched successfully',
      status: 200,
      data: events,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching events',
      status: 500,
      error: error.message,
    });
  }
});

// Deactivate User (Admin only)
router.put('/users/:id/deactivate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'User deactivated successfully',
      status: 200,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error deactivating user',
      status: 500,
      error: error.message,
    });
  }
});

// Feature Event (Admin only)
router.put('/events/:id/feature', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, { isFeatured: true }, { new: true });

    if (!event) {
      return res.status(404).json({
        message: 'Event not found',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'Event featured successfully',
      status: 200,
      data: event,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error featuring event',
      status: 500,
      error: error.message,
    });
  }
});

module.exports = router;
