const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { authMiddleware, organizerMiddleware } = require('../middleware/auth');

// Get All Events
router.get('/', async (req, res) => {
  try {
    const { category, sortBy, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true };

    if (category) {
      query.category = category;
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === 'price_asc') {
      sortOptions = { price: 1 };
    } else if (sortBy === 'price_desc') {
      sortOptions = { price: -1 };
    } else if (sortBy === 'rating') {
      sortOptions = { rating: -1 };
    }

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
    res.status(500).json({
      message: 'Error fetching events',
      status: 500,
      error: error.message,
    });
  }
});

// Get Featured Events
router.get('/featured', async (req, res) => {
  try {
    const events = await Event.find({ isFeatured: true, isActive: true })
      .limit(6)
      .populate('organizer', 'name email');

    res.status(200).json({
      message: 'Featured events fetched successfully',
      status: 200,
      data: events,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching featured events',
      status: 500,
      error: error.message,
    });
  }
});

// Get Single Event
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email phone')
      .populate({
        path: 'bookings',
        select: 'user numberOfSeats status',
        populate: { path: 'user', select: 'name email' },
      });

    if (!event) {
      return res.status(404).json({
        message: 'Event not found',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'Event fetched successfully',
      status: 200,
      data: event,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching event',
      status: 500,
      error: error.message,
    });
  }
});

// Create Event (Organizer only)
router.post('/', authMiddleware, organizerMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      date,
      time,
      location,
      latitude,
      longitude,
      price,
      totalSeats,
      images,
    } = req.body;

    // Validation
    if (!title || !description || !category || !date || !time || !location || !price || !totalSeats) {
      return res.status(400).json({
        message: 'Missing required fields',
        status: 400,
      });
    }

    const event = new Event({
      title,
      description,
      category,
      date: new Date(date),
      time,
      location,
      latitude,
      longitude,
      price,
      totalSeats,
      availableSeats: totalSeats,
      images: images || [],
      organizer: req.user.id,
      organizerName: req.user.name,
    });

    await event.save();

    res.status(201).json({
      message: 'Event created successfully',
      status: 201,
      data: event,
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      message: 'Error creating event',
      status: 500,
      error: error.message,
    });
  }
});

// Update Event (Organizer only)
router.put('/:id', authMiddleware, organizerMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        message: 'Event not found',
        status: 404,
      });
    }

    // Check if user is event organizer
    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized to update this event',
        status: 403,
      });
    }

    const { title, description, date, time, location, price, totalSeats, images, isFeatured } = req.body;

    Object.assign(event, {
      title: title || event.title,
      description: description || event.description,
      date: date ? new Date(date) : event.date,
      time: time || event.time,
      location: location || event.location,
      price: price !== undefined ? price : event.price,
      totalSeats: totalSeats || event.totalSeats,
      images: images || event.images,
      isFeatured: isFeatured !== undefined ? isFeatured : event.isFeatured,
    });

    await event.save();

    res.status(200).json({
      message: 'Event updated successfully',
      status: 200,
      data: event,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating event',
      status: 500,
      error: error.message,
    });
  }
});

// Delete Event (Organizer only)
router.delete('/:id', authMiddleware, organizerMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        message: 'Event not found',
        status: 404,
      });
    }

    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized to delete this event',
        status: 403,
      });
    }

    await Event.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: 'Event deleted successfully',
      status: 200,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting event',
      status: 500,
      error: error.message,
    });
  }
});

// Search Events
router.get('/search/query', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        message: 'Search query required',
        status: 400,
      });
    }

    const events = await Event.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ],
      isActive: true,
    });

    res.status(200).json({
      message: 'Search results',
      status: 200,
      data: events,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error searching events',
      status: 500,
      error: error.message,
    });
  }
});

module.exports = router;
