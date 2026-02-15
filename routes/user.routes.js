const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get User by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        status: 404,
      });
    }

    res.status(200).json({
      message: 'User fetched successfully',
      status: 200,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching user',
      status: 500,
      error: error.message,
    });
  }
});

module.exports = router;
