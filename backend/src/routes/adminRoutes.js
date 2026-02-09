const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/panel", authMiddleware(["admin"]), (req, res) => {
res.json({ success: true, message: "Bienvenido al panel de administración" });
});

module.exports = router;
