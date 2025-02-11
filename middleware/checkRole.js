module.exports = function(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        msg: 'Accès refusé - Vous n\'avez pas les permissions nécessaires' 
      });
    }
    next();
  };
};
