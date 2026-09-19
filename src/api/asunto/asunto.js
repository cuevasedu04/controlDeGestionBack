const { Router } = require("express");
const router = Router();
const controller = require("./asuntoController");
const token = require("../token/tokenController");

router.post("/registrarAsunto", token.validateToken, controller.registrarAsunto);
router.post("/consultarAsuntosUR", token.validateToken, controller.consultarAsuntosUR);
router.post("/consultarDetalleAsunto", token.validateToken, controller.consultarDetalleAsunto);
router.post("/consultarExpedienteAsunto", token.validateToken, controller.consultarExpedienteAsunto);
router.post("/consultarTurnados", token.validateToken, controller.consultarTurnados);
router.post("/turnarAsunto", token.validateToken, controller.turnarAsunto);
router.post("/reemplazarDocumento", token.validateToken, controller.reemplazarDocumento);
router.post("/agregarAnexos", token.validateToken, controller.agregarAnexos);
router.post("/eliminarDocumento", token.validateToken, controller.eliminarDocumento);
router.post("/concluirAsunto", token.validateToken, controller.concluirAsunto);
router.post("/editarAsunto", token.validateToken, controller.editarAsunto);
router.post("/consultarHistorial", token.validateToken, controller.consultarHistorial);
router.post("/descargarExpediente", token.validateToken, controller.descargarExpediente);
router.post("/descargarExpedientesMasivo", token.validateToken, controller.descargarExpedientesMasivo);
router.post("/verDocumento", token.validateToken, controller.verDocumento);
router.post("/listarDocumentos", token.validateToken, controller.listarDocumentos);
router.post("/cancelarAsunto", token.validateToken, controller.cancelarAsunto);
router.post("/guardarComentarioDocumento", token.validateToken, controller.guardarComentarioDocumento);
router.post("/consultarComentariosDocumentos", token.validateToken, controller.consultarComentariosDocumentos);

module.exports = router;

