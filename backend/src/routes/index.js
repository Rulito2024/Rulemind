const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const profesorRoutes = require("./profesorRoutes");
const alumnoRoutes = require("./alumnoRoutes");
const adminRoutes = require("./adminRoutes");

router.use("/auth", authRoutes);
router.use("/profesor", profesorRoutes);
router.use("/alumno", alumnoRoutes);
router.use("/admin", adminRoutes);

module.exports = router;




