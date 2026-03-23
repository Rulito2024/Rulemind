const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.get("/diptongo", (req, res) => {
    try {
        const filePath = path.join(__dirname, "../data/actividades_diptongo.json");
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error leyendo actividades" });
    }
});

module.exports = router;