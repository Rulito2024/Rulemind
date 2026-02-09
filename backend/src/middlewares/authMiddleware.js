const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware que valida el token y los roles permitidos
function authMiddleware(rolesPermitidos = []) {
return (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
    return res.status(401).json({ success: false, message: "Token requerido" });
    }

    try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

// Si hay roles permitidos y el rol del user no está en la lista → denegado
    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(decoded.role)) {
        return res.status(403).json({ success: false, message: "Acceso denegado" });
    }

    next();
    } catch (err) {
    return res.status(403).json({ success: false, message: "Token inválido o expirado" });
    }
};
}

module.exports = authMiddleware;