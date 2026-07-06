const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (req.user && req.user.roles && req.user.roles.some(role => roles.includes(role))) {
      next();
    } else {
      res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
  };
};

module.exports = roleMiddleware;
