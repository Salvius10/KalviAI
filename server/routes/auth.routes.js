const express = require("express");
const router = express.Router();
const { register, login, registerParent, getMe } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/register-parent", registerParent);
router.post("/login", login);
router.get("/me", protect, getMe);

module.exports = router;
