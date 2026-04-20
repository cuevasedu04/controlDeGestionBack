const { Router } = require("express");
const router = Router();
const controller = require("./userController");
const token = require("../token/tokenController");

/*
*   Servicio para registro de usuarios.
*   Endpoint http://168.255.101.89:9051/usuario/registrarUsuario
*   Endpoint http://localhost:9051/usuario/registrarUsuario
*   status: 
*   message: 
*   postData: {correo, contrasena , ...}
*/
// router.post("/logIn", token.validateToken, controller.logIn);
router.post("/registrarUsuario", token.validateToken, controller.createUser);
router.post("/getUsuariosAdmin", token.validateToken, controller.getUsuariosAdmin);


/*
*   Servicio para registro de usuarios.
*   Endpoint http://168.255.101.89:9051/usuario/logIn
*   Endpoint http://localhost:9051/usuario/logIn
*   status: 
*   message: 
*   postData: {correo, contrasena , ...}
*/
router.post("/logIn", controller.logIn); //no se necesita validar el token para iniciar sesion, si no no deja

/*
*   Servicio para registro de usuarios.
*   Endpoint http://168.255.101.89:9051/usuario/verificarCorreo
*   Endpoint http://localhost:9051/usuario/verificarCorreo
*   status: 
*   message: 
*   postData: {correo, contrasena , ...}
*/
router.post("/verificarCorreo"/* , token.validateToken */, controller.confirmEmail);


/*Servicio para el registro de enlaces estatales. 
Request: http://localhost:9051/usuario/consultarUsuarioPorHash
Response:
    status:
    message:
Model:{}
*/
router.post("/consultarUsuarioPorHash", token.validateToken, controller.getUserByHash);

/*Servicio para el registro de enlaces estatales. 
Request: http://localhost:9051/usuario/solicitarRestablecerContrasena
Response:
    status:
    message:
Model:{}
*/
router.post("/solicitarRestablecerContrasena", token.validateToken, controller.resetPasswordRequest);

/*Servicio para el registro de enlaces estatales. 
Request: http://localhost:9051/usuario/actualizarContrasena
Response:
    status:
    message:
Model:{}
*/
router.post("/actualizarContrasena", token.validateToken, controller.updatePassword);

/*Servicio para actualizar usuario 
Request: http://localhost:9051/usuario/actualizarUsuario
Response:
    status:
    message:
Model:{}
*/
router.post("/actualizarUsuario", token.validateToken, controller.updateUser);

/*Servicio para activar usuario 
Request: http://localhost:9051/usuario/activarUsuario
Response:
    status:
    message:
Model:{}
*/

router.post("/activarUsuario", token.validateToken, controller.activateUser)
router.post("/getUserlog", token.validateToken, controller.getUserlog)
router.post("/toggleNotificaciones", token.validateToken, controller.toggleNotificaciones)
router.post("/actualizarVersionVista", token.validateToken, controller.actualizarVersionVista)


/**
 * ----------------------------------------
 * ----------------EXPORTS-----------------
 */
module.exports = router;