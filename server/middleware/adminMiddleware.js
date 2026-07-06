const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.roles && req.user.roles.includes('admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Administrator permissions required.' });
  }
};

module.exports = adminMiddleware;
