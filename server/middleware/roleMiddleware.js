const roleMiddleware = (roles) => {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const expandedUserRoles = [...userRoles];
    if (userRoles.includes('student_organizer') || userRoles.includes('organizer')) {
      if (!expandedUserRoles.includes('student')) expandedUserRoles.push('student');
    }
    if (userRoles.includes('faculty_organizer')) {
      if (!expandedUserRoles.includes('faculty')) expandedUserRoles.push('faculty');
    }
    if (expandedUserRoles.some(role => roles.includes(role))) {
      next();
    } else {
      res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
  };
};

module.exports = roleMiddleware;

