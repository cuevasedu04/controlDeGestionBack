const db = require("../config/database");
const utils  = require("../api/utils/utils");

async function logIn(postData) {
    let response = {};
    try {
        let cryptPassw = await utils.encriptarContrasena(postData.password);
        let sql = `CALL SP_LOGIN (?,?,?)`;
        let result = await db.query(sql, [postData.email, cryptPassw, postData.ip ]);
        console.log(cryptPassw);
        
        response = JSON.parse(JSON.stringify(result[0][0]));

        if(response.status == 200){
            response.model = JSON.parse(JSON.stringify(result[1][0]));
            const versionActual = process.env.VERSION_ACTUAL_SISTEMA || '';
            response.model.versionActualSistema = versionActual;
            response.model.mostrarModalVersion = response.model.versionSistema !== versionActual;
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}


async function createUser(postData) {
    let response = {};

    try {

        let sql = `CALL SP_REGISTRAR_USUARIO (
            ?,?,?,?,?, 
            ?,?,?,?,?, 
            ?,?
        )`;
        let encryptPassword = await utils.encriptarContrasena(postData.contrasena);        
        let result = await db.query(sql, [
            postData.idUsuarioRol, 
            postData.idDependencia, 
            postData.nombre, 
            postData.primerApellido, 
            postData.segundoApellido, 
            postData.telefono || null, 
            postData.correo, 
            encryptPassword,
            postData.contrasena, 
            postData.usuarioNombre, 
            postData.biografia || '', 
            postData.idUsuarioModifica, 
        ]);
        response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}
async function getUsuariosAdmin(postData) {
    let response = {};

    try {

        let sql = `CALL SP_OBTENER_USUARIO (
            ?
        )`;
        let result = await db.query(sql, [
            postData.idUsuario || 0
        ]);
        response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status == 200) {
            if (postData.idUsuario !=0) {
               
                response.model = {
                    userData: result[2][0],
                    stats: result[3],
                    mods: result[4]
                };
            } else {
                response.model = JSON.parse(JSON.stringify(result[1]));
            }
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}


async function confirmEmail(postData) {
    let response = {};
    try {
        let sql = `CALL erde_SP_CONFIRM__EMAIL (
            ?
        )`;
        let result = await db.query(sql, [postData.hashCode]);
        response = JSON.parse(JSON.stringify(result[0][0]));
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function getUserByHash(postData) {
    let response = {};
    try {

        let sql = `CALL erde_SP_GET_USER_BY_HASH (
            ?
        )`;

        let result = await db.query(sql, [postData.hashCode]);
        response = JSON.parse(JSON.stringify(result[0][0]));
        
        if (response.status == 200) {    
            response.model = JSON.parse(JSON.stringify(result[1][0]));        
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function resetPasswordRequest(postData) {
    let response = {};
    try {

        let sql = `CALL erde_SP_GET_HASH_USUARIO (?)`;

        let result = await db.query(sql, [postData.email]);
        response = JSON.parse(JSON.stringify(result[0][0]));
        
        if (response.status == 200) {    
            response.model = JSON.parse(JSON.stringify(result[1][0]));        
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}


async function updatePassword(postData) {
    let response = {};
    try {

        let sql = `CALL erde_SP_UPDATE_PASSWORD (?,?,?)`;
        let encryptPassword = await utils.encriptarContrasena(postData.password);
        let result = await db.query(sql, [postData.userId,postData.hashCode,encryptPassword]);
        
        response = JSON.parse(JSON.stringify(result[0][0]));
        
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function updateUser(postData) {
    let response = {};
    try {
        let cryptPassw = await utils.encriptarContrasena(postData.contrasena);
        let sql = `CALL SP_ACTUALIZAR_USUARIO (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        let result = await db.query(sql, [
            postData.idUsuario,
            postData.idUsuarioRol,
            postData.idDependencia,
            postData.nombre,
            postData.primerApellido,
            postData.segundoApellido,
            postData.telefono || null,
            postData.correo,
            postData.usuarioNombre,
            postData.biografia || null,
            postData.idUsuarioModifica,
            cryptPassw,
            postData.contrasena,
            postData.pass

        ]);
        
        response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function activateUser(postData) {
    let response = {};
    try {
        let sql = `CALL SP_ACTIVAR_DESACTIVAR_USUARIO (?,?)`;
        let result = await db.query(sql, [
            postData.idUsuario,
            postData.idUsuarioModifica
        ]);
        
        response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}


async function getUserlog(postData){

        let response = {};
    try {
        let sql = `CALL SP_GET_LOG_USUARIO (?,?,?)`;
        let result = await db.query(sql, [
            postData.fechaInicio ||  null,
            postData.fechaFin || null,
            postData.limit || null
        ]);
        
        response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }

}

async function actualizarVersionVista(postData) {
    try {
        const sql = `CALL SP_ACTUALIZAR_VERSION_VISTA(?, ?)`;
        const result = await db.query(sql, [postData.idUsuario, postData.versionNueva]);
        return JSON.parse(JSON.stringify(result[0][0]));
    } catch (ex) {
        throw ex;
    }
}

async function toggleNotificaciones(postData) {
    try {
        const sql = `CALL SP_TOGGLE_NOTIFICACIONES(?)`;
        const result = await db.query(sql, [postData.idUsuario]);

        let response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
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
    toggleNotificaciones,
    actualizarVersionVista
}
