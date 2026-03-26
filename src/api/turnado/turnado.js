const { Router } = require("express");
const router = Router();
const controller = require("./turnadoController");
const token = require("../token/tokenController");


router.post("/consultarTurnados", token.validateToken, controller.consultarTurnados);
router.post("/contestarTurnado", token.validateToken, controller.contestarTurnado);
router.post("/rechazarTurnado", token.validateToken, controller.rechazarTurnado);
router.post("/consultarDetalleTurnado", token.validateToken, controller.consultarDetalleTurnado);
router.post("/verTurnado", token.validateToken, controller.verTurnado);
router.post("/asignarComisionado", token.validateToken, controller.asignarComisionado);
router.post("/obtenerComisionados", token.validateToken, controller.obtenerComisionados);


module.exports = router;

