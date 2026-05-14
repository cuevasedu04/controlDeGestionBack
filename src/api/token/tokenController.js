const winston = require("../../config/winston");
var jwt = require('jsonwebtoken')
var jwtClave = 'DGTIC-jwt_21';
var jwtTimeToken = 60 * 60 * 24; // expires in 30  hours


async function generateToken(req, res) {
    let user = "api-cdcsp-ws";
    let pass = "Abcde1";

    try {        
            var tokenData = {
                user: user,
                pass: pass
            }
            var token = jwt.sign(tokenData, jwtClave, {
                expiresIn: jwtTimeToken
            })
            res.status(200).json({ status: 200, token: token, message: "Successfully generated token" });
            
        
    }
    catch (err) {
        res.status(500).json({ status: 500, message: "Internal server error" });
    }
}

function validateToken(request, response, next) {
    // return next();
    var token = request.headers['authorization'];
    var result = { estatus: -1, mensaje: " " };

    if (!token) {
        result.mensaje = "Token de autenticación requerido";
        return response.status(401).json(result);
    }
    if (!token.includes("Bearer ")) {
        result.mensaje = "Se requiere un bearer válido";
        return response.status(401).json(result);
    }

    token = token.replace('Bearer ', '');

    jwt.verify(token, jwtClave, function (err, user) {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                winston.warn(`ERR 401: Intento de acceso con token expirado.`);
                return response.status(401).json({ 
                    estatus: -1, 
                    mensaje: "Token expirado" 
                });
            }
            winston.warn(`ERR 403: Intento de acceso con token inválido.`);
            return response.status(403).json({
                estatus: -1,
                mensaje: "Token inválido"
            });
        } 

        request.userToken = user; // Datos completos

        // LOG automático en cada petición
        winston.info(`- idUsuario: ${user.idUsuario} - ${user.nombreCompleto} - idToken: ${token.slice(-16)} - Acción: ${request.url}`);

        next(); 
    });
}

function generateTokenByUser(user) {
    try {
        var token = jwt.sign(user, jwtClave, {
            expiresIn: jwtTimeToken
        })
        return token;
    }
    catch (err) {
        throw err;
    }
}
        //desencriptar el token
function decryptToken(authHeader) {
    try {
        if (!authHeader || !authHeader.includes("Bearer-UG")) {
            return null;
        }
        var token = authHeader.replace('Bearer-UG ', '')
        var decoded = jwt.verify(token, jwtClave);
        return decoded;
    }
    catch (err) {
        return null;
    }
}

module.exports = {
    generateToken,
    validateToken,
    generateTokenByUser,
    decryptToken
}