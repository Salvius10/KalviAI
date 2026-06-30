const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized - No token" });
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔐 Decoded token:", decoded); // debug line
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

const restrictTo = (...roles) => (req, res, next) => {
  console.log("👤 User role:", req.user.role, "| Required:", roles); // debug line
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden - Insufficient role" });
  }
  next();
};

module.exports = { protect, restrictTo };