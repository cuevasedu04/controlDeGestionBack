const { Router } = require("express");
const router = Router();
const controller = require("./acuerdoController");
const token = require("../token/tokenController");

// FADRH
router.post("/registrarAcuerdo",       token.validateToken, controller.registrarAcuerdo);
router.post("/agregarItemAcuerdo",     token.validateToken, controller.agregarItemAcuerdo);
router.post("/consultarAcuerdosUR",    token.validateToken, controller.consultarAcuerdosUR);
router.post("/consultarDetalleAcuerdo",token.validateToken, controller.consultarDetalleAcuerdo);

// FIDRH
router.post("/registrarInstruccionDRH",token.validateToken, controller.registrarInstruccionDRH);

// Seguimiento / liga
router.post("/registrarSeguimiento",   token.validateToken, controller.registrarSeguimientoItem);
router.post("/concluirItem",           token.validateToken, controller.concluirItemAcuerdo);
router.post("/consultarLiga",          token.validateToken, controller.consultarLigaSeguimiento);

// Programación
router.post("/programarHorario",       token.validateToken, controller.programarHorarioAcuerdo);
router.post("/consultarProgramacion",  token.validateToken, controller.consultarProgramacion);

module.exports = router;
