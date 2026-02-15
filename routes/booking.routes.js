const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const { authMiddleware } = require('../middleware/auth');

// Get User's Bookings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('event', 'title description date time location price')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Bookings fetched successfully',
      status: 200,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching bookings',
      status: 500,
      error: error.message,
    });
  }
});

// Get Single Booking
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('event')
      .populate('user', 'name email');

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found',
        status: 404,
      });
    }

    // Check if user is booking owner or organizer
    if (booking.user._id.toString() !== req.user.id && booking.event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized to view this booking',
        status: 403,
      });
    }

    res.status(200).json({
      message: 'Booking fetched successfully',
      status: 200,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching booking',
      status: 500,
      error: error.message,
    });
  }
});

// Create Booking
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { eventId, numberOfSeats } = req.body;

    // Validation
    if (!eventId || !numberOfSeats || numberOfSeats < 1) {
      return res.status(400).json({
        message: 'Event ID and number of seats are required',
        status: 400,
      });
    }

    // Get event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        message: 'Event not found',
        status: 404,
      });
    }

    // Check available seats
    if (event.availableSeats < numberOfSeats) {
      return res.status(400).json({
        message: 'Not enough seats available',
        status: 400,
        data: { available: event.availableSeats },
      });
    }

    // Create booking
    const totalPrice = event.price * numberOfSeats;
    const booking = new Booking({
      user: req.user.id,
      event: eventId,
      numberOfSeats,
      totalPrice,
    });

    await booking.save();

    // Update event available seats
    event.availableSeats -= numberOfSeats;
    event.bookings.push(booking._id);
    await event.save();

    // Populate booking details
    await booking.populate('event', 'title date time location');

    res.status(201).json({
      message: 'Booking created successfully',
      status: 201,
      data: booking,
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({
      message: 'Error creating booking',
      status: 500,
      error: error.message,
    });
  }
});

// Cancel Booking
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found',
        status: 404,
      });
    }

    // Check if user owns booking
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized to cancel this booking',
        status: 403,
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Return seats to event
    const event = await Event.findById(booking.event);
    event.availableSeats += booking.numberOfSeats;
    await event.save();

    res.status(200).json({
      message: 'Booking cancelled successfully',
      status: 200,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error cancelling booking',
      status: 500,
      error: error.message,
    });
  }
});

// Get Organizer's Event Bookings
router.get('/organizer/event-bookings', authMiddleware, async (req, res) => {
  try {
    // Get organizer's events
    const events = await Event.find({ organizer: req.user.id });
    const eventIds = events.map((e) => e._id);

    // Get bookings for these events
    const bookings = await Booking.find({ event: { $in: eventIds } })
      .populate('event', 'title date time')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Event bookings fetched successfully',
      status: 200,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching event bookings',
      status: 500,
      error: error.message,
    });
  }
});

module.exports = router;
