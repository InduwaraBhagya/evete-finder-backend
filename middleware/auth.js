const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'No token provided',
        status: 401,
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      message: 'Invalid or expired token',
      status: 403,
    });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      message: 'Admin access required',
      status: 403,
    });
  }
  next();
};

const organizerMiddleware = (req, res, next) => {
  if (req.user?.role !== 'organizer' && req.user?.role !== 'admin') {
    return res.status(403).json({
      message: 'Organizer access required',
      status: 403,
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  organizerMiddleware,
};
