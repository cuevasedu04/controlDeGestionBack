const { Router } = require("express");
const router = Router();
const controller = require("./acuerdoDrhController");
const token = require("../token/tokenController");

// Sesión
router.post("/consultarSesion",     token.validateToken, controller.consultarSesion);

// Catálogos y consultas
router.post("/consultarCatalogos",  token.validateToken, controller.consultarCatalogos);
router.post("/consultarAcuerdos",   token.validateToken, controller.consultarAcuerdos);
// La lista detrás de una cifra de «Movimientos» del reporte. Solo lee.
router.post("/consultarAcuerdosPorMovimiento", token.validateToken, controller.consultarAcuerdosPorMovimiento);

// Acuerdos — módulo 1
router.post("/registrarAcuerdo",        token.validateToken, controller.registrarAcuerdo);
router.post("/actualizarAcuerdo",       token.validateToken, controller.actualizarAcuerdo);
router.post("/reabrirAcuerdo",          token.validateToken, controller.reabrirAcuerdo);
router.post("/registrarAcuerdoUrgente", token.validateToken, controller.registrarAcuerdoUrgente);
router.post("/rechazarAcuerdo",         token.validateToken, controller.rechazarAcuerdo);
router.post("/ajustarPrioridad",        token.validateToken, controller.ajustarPrioridad);

// Celebración y agenda — módulo 2
router.post("/programarCelebracion",   token.validateToken, controller.programarCelebracion);
router.post("/reprogramarCelebracion", token.validateToken, controller.reprogramarCelebracion);
router.post("/iniciarReunion",         token.validateToken, controller.iniciarReunion);
router.post("/finalizarReunion",       token.validateToken, controller.finalizarReunion);
router.post("/cancelarCelebracion",    token.validateToken, controller.cancelarCelebracion);
router.post("/consultarAgenda",        token.validateToken, controller.consultarAgenda);

// Instrucciones y seguimiento — módulo 3
router.post("/registrarInstruccion",   token.validateToken, controller.registrarInstruccion);
router.post("/actualizarPlazo",        token.validateToken, controller.actualizarPlazoInstruccion);
router.post("/actualizarAvance",       token.validateToken, controller.actualizarAvanceInstruccion);
router.post("/consultarInstrucciones", token.validateToken, controller.consultarInstrucciones);

// Tablero e historial
router.post("/consultarDashboard",     token.validateToken, controller.consultarDashboard);
router.post("/consultarHistorial",     token.validateToken, controller.consultarHistorial);

// Adscripciones — administración, rol 1
router.post("/consultarAdscripciones", token.validateToken, controller.consultarAdscripciones);
router.post("/asignarAdscripcion",     token.validateToken, controller.asignarAdscripcion);
router.post("/desactivarAdscripcion",  token.validateToken, controller.desactivarAdscripcion);

// Documentos — módulo 4
router.post("/registrarDocumento",     token.validateToken, controller.registrarDocumento);
router.post("/reemplazarDocumento",    token.validateToken, controller.reemplazarDocumento);
router.post("/revisarDocumento",       token.validateToken, controller.revisarDocumento);
router.post("/eliminarDocumento",      token.validateToken, controller.eliminarDocumento);
router.post("/consultarDocumentos",    token.validateToken, controller.consultarDocumentos);
router.post("/verDocumento",           token.validateToken, controller.verDocumento);

// Buzón — el de QUIEN PREGUNTA; no se recibe destinatario por parámetro.
router.post("/consultarNotificaciones", token.validateToken, controller.consultarNotificaciones);
router.post("/marcarNotificacionLeida", token.validateToken, controller.marcarNotificacionLeida);

module.exports = router;
