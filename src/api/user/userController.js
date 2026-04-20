
const userDAO = require("../../DAO/userDAO");
const token = require("../token/tokenController");

const utils = require("../utils/utils");
const email = require("../utils/email");

const config = require("../../config/config");


async function logIn(req, res) {
    try {
        const postData = req.body;
        const clientIp = getClientIp(req);

        if (Object.keys(postData).length !== 0) {
            postData.ip = clientIp;
            console.log(postData);
            
            let data = await userDAO.logIn(postData);
            if (data.status == 200) {
                data.model.tokenWs = token.generateTokenByUser(data.model);
            }
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * 
 * @param {*} req 
 * @param {*} res 
 */
async function createUser(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {

            let data = await userDAO.createUser(postData);                
            /* if (data.status == 200) {
                email.sendNotification(1,data.model);
            }    */      
            return res.status(200).json(data);            
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function getUsuariosAdmin(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {
            let data = await userDAO.getUsuariosAdmin(postData);                                 
            return res.status(200).json(data);            
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}


/**
 * 
 * @param {*} req 	
 * @param {*} res 
 */
async function confirmEmail(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {
                 
            let data = await userDAO.confirmEmail(postData);
            
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * 
 * @param {*} req 
 * @param {*} res 
 */
async function getUserByHash(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {    
            let data = await userDAO.getUserByHash(postData);
            
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
    recibe correo electronico por cambiar la contraseña si 200 es que encontro el correo y genera el hash 
    data model trae el correo y el hash
 * 
 * @param {*} req 
 * @param {*} res 
 */
async function resetPasswordRequest(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {
            let data = await userDAO.resetPasswordRequest(postData);
            if (data.status == 200) {
                email.sendNotification(2,data.model);
            }
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 *  recibe el ID usuario producto de la consulta de usuario por hash, el hash y la nueva password
 * 
 * @param {*} req 
 * @param {*} res 
 */
async function updatePassword(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {   
            let data = await userDAO.updatePassword(postData);                                    
            return res.status(data.status).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * Actualiza un usuario existente
 * 
 * @param {*} req 
 * @param {*} res 
 */
async function updateUser(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {   
            let data = await userDAO.updateUser(postData);                                    
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * activa un usuario existente
 * 
 * @param {*} req 
 * @param {*} res 
 */
async function activateUser(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {   
            let data = await userDAO.activateUser(postData);                                    
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function getUserlog(req, res) {
    try {
        const postData = req.body;
        
        // Obtener datos del token (disponibles después de validateToken)
        console.log("idUsuarioModifica:", req.idUsuarioModifica);
        console.log("idToken:", req.idToken);
        
        if (Object.keys(postData).length !== 0) {   
            let data = await userDAO.getUserlog(postData);                                    
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
    
}
async function toggleNotificaciones(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {
            let data = await userDAO.toggleNotificaciones(postData);
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.invalidPostData(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

module.exports = {
    createUser,
    confirmEmail,
    logIn,
    getUserByHash,
    resetPasswordRequest,
    updatePassword,
    updateUser,
    activateUser,
    getUsuariosAdmin,
    getUserlog,
    toggleNotificaciones
}

function getClientIp(req) {
    let ip = req.headers['x-forwarded-for'];
    if (ip) {
        // Puede ser una lista de IPs separadas por coma
        ip = ip.split(',')[0].trim();
    } else {
        ip = req.socket.remoteAddress;
    }
    // Si es IPv6 localhost
    if (ip === '::1') return '127.0.0.1';
    // Si es IPv6-mapeado a IPv4
    if (ip && ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
    return ip;
}

function getClientIp(req) {
    let ip = req.headers['x-forwarded-for'];
    if (ip) {
        // Puede ser una lista de IPs separadas por coma
        ip = ip.split(',')[0].trim();
    } else {
        ip = req.socket.remoteAddress;
    }
    // Si es IPv6 localhost
    if (ip === '::1') return '127.0.0.1';
    // Si es IPv6-mapeado a IPv4
    if (ip && ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
    return ip;
}