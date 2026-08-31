const acuerdoDrhDAO = require("../../DAO/acuerdoDrhDAO");
const sp = require("./spAcuerdoDrh");
const correo = require("./correoAcuerdoDrh");
const utils = require("../utils/utils");
const winston = require("../../config/winston");
const path = require("path");
const fs = require("fs");

/**
 * Lanza un aviso por correo SIN hacer esperar al usuario.
 *
 * Para cuando esto corre, el SP ya hizo COMMIT y la respuesta ya se decidió:
 * el rechazo ya quedó guardado, la cita ya se movió. Un SMTP lento o caído no
 * puede retrasar esa respuesta, y mucho menos hacer creer que la operación
 * falló. Por eso va fuera del camino de la petición y con su propia red.
 */
function avisar(hacerlo) {
    setImmediate(async () => {
        try {
            await hacerlo();
        } catch (ex) {
            winston.error(`[Controller] aviso por correo falló: ${ex.message}`);
        }
    });
}

/**
 * Resuelve al ejecutor de la petición.
 *
 * Del token se lee ÚNICAMENTE idUsuario. El rol, la unidad y el nombre se
 * cargan de la base — nunca del cuerpo de la petición ni del propio token.
 * Los stored procedures siguen siendo la autoridad sobre los permisos; aquí
 * solo se establece quién es, para pasárselo.
 *
 * Devuelve null si el token no trae idUsuario o si el usuario no está activo.
 * Quien llama responde 401 en ese caso.
 */
async function resolverEjecutor(req) {
    const idUsuario = req.userToken ? req.userToken.idUsuario : null;
    if (!idUsuario) return null;
    return await acuerdoDrhDAO.obtenerEjecutor(idUsuario);
}

function sesionInvalida(res) {
    return res.status(401).json({
        status: 401,
        message: "La identidad no corresponde a un usuario activo."
    });
}

/**
 * Devuelve quién es el usuario según el servidor.
 *
 * Es la prueba de que toda la cadena funciona: si lo que responde coincide con
 * la cuenta con la que se inició sesión en el SCG, entonces el token se está
 * verificando y la identidad se está resolviendo contra la base.
 */
async function consultarSesion(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        return res.status(200).json({
            status: 200,
            message: "OK",
            model: {
                idUsuario: ejecutor.idUsuario,
                idUsuarioRol: ejecutor.idUsuarioRol,
                rol: ejecutor.rol,
                correo: ejecutor.correo,
                nombreCompleto: ejecutor.nombreCompleto,
                idUnidadResponsable: ejecutor.idUnidadResponsable,
                unidadResponsable: ejecutor.unidadResponsable,
                tipoEnlace: ejecutor.tipoEnlace
            }
        });
    } catch (ex) {
        winston.error(`[Controller] consultarSesion excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * Catálogos del sistema.
 *
 * Devuelve los seis catálogos que alimentan los formularios. El desplegable de
 * unidades ya viene recortado al alcance de quien pregunta, así que se puede
 * pintar tal cual.
 */
async function consultarCatalogos(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const data = await acuerdoDrhDAO.obtenerCatalogos(ejecutor.idUsuario);

        if (data.rechazo) {
            winston.warn(`[Controller] consultarCatalogos rechazo: ${data.rechazo.message} | usuario=${ejecutor.idUsuario}`);
            return sp.responder(res, data.rechazo, () => ({}));
        }

        return res.status(200).json({
            status: 200,
            message: "Catálogos obtenidos correctamente.",
            model: data.catalogos
        });
    } catch (ex) {
        winston.error(`[Controller] consultarCatalogos excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * Lista de acuerdos, con filtros opcionales.
 *
 * Filtros que acepta en el cuerpo: busqueda, idStatus, fechaInicio, fechaFin.
 * La identidad NO se acepta en el cuerpo: el alcance por unidad lo decide el SP
 * a partir del idUsuario del token.
 */
async function consultarAcuerdos(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body || {};
        const data = await acuerdoDrhDAO.consultarAcuerdos(postData, ejecutor.idUsuario);

        if (data.rechazo) {
            winston.warn(`[Controller] consultarAcuerdos rechazo: ${data.rechazo.message} | usuario=${ejecutor.idUsuario}`);
            return sp.responder(res, data.rechazo, () => []);
        }

        return res.status(200).json({
            status: 200,
            message: "Consulta de acuerdos exitosa.",
            model: data.acuerdos
        });
    } catch (ex) {
        winston.error(`[Controller] consultarAcuerdos excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * Forma común del `model` de respuesta para las cuatro acciones de escritura.
 *
 * `idAcuerdoOrigen` solo trae valor en REABRIR modo NUEVO: es el acuerdo
 * concluido del que este es continuación. En las demás va en null, que es
 * información útil —"este acuerdo no continúa a ninguno"— y no un hueco.
 */
function datosAcuerdo(r) {
    return {
        idAcuerdo: r.idAcuerdo !== undefined ? r.idAcuerdo : null,
        folio: r.folio !== undefined ? r.folio : null,
        idStatusAcuerdo: r.idStatusAcuerdo !== undefined ? r.idStatusAcuerdo : null,
        idAcuerdoOrigen: r.idAcuerdoOrigen !== undefined ? r.idAcuerdoOrigen : null,
        urgente: r.urgente !== undefined ? r.urgente : 0
    };
}

/** Ejecuta una acción de SP_GESTIONAR_ACUERDO y responde. */
async function ejecutarAccionAcuerdo(req, res, accion, etiqueta) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const respuesta = await acuerdoDrhDAO.gestionarAcuerdo(accion, postData, ejecutor, sp.ipDe(req));

        // El rechazo del FADRH se avisa por correo. A diferencia del rechazo
        // de documento, este SP no devuelve `correoDestino`, así que los
        // destinatarios se resuelven aquí a partir del acuerdo.
        if (accion === 'RECHAZAR' && Number(respuesta.status) === 200 &&
            !/^Error/i.test(respuesta.message || '')) {
            avisar(async () => {
                const d = await acuerdoDrhDAO.destinatariosDeAcuerdo(
                    respuesta.idAcuerdo || sp.entero(postData.idAcuerdo));
                if (!d) return;
                correo.acuerdoRechazado({
                    para: d.para,
                    copia: d.copia,
                    folio: respuesta.folio || d.folio,
                    descripcion: d.descripcionEjecutiva,
                    motivo: sp.texto(postData.motivo),
                    revisor: ejecutor.nombreCompleto
                });
            });
        }

        return sp.responder(res, respuesta, datosAcuerdo);
    } catch (ex) {
        winston.error(`[Controller] ${etiqueta} excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * Registrar un acuerdo nuevo (FADRH).
 * Nace en 1. Registrado y pasa automáticamente a 2. En revisión.
 */
async function registrarAcuerdo(req, res) {
    return ejecutarAccionAcuerdo(req, res, 'REGISTRAR', 'registrarAcuerdo');
}

/**
 * Actualizar la cabecera de un acuerdo.
 *
 * Todos los campos salvo idAcuerdo son opcionales: el SP hace COALESCE, así que
 * lo que no se manda conserva su valor.
 *
 * NO se puede cambiar la unidad responsable: el folio lleva su prefijo y
 * cambiarla lo dejaría mintiendo. Tampoco procede sobre un acuerdo Concluido:
 * hay que reabrirlo primero.
 */
async function actualizarAcuerdo(req, res) {
    return ejecutarAccionAcuerdo(req, res, 'ACTUALIZAR', 'actualizarAcuerdo');
}

/**
 * Reabrir un acuerdo concluido.
 *
 * En modo NUEVO la respuesta trae `idAcuerdo` del NUEVO acuerdo y
 * `idAcuerdoOrigen` del anterior: son dos acuerdos distintos y conviene no
 * confundirlos al pintar la respuesta.
 */
async function reabrirAcuerdo(req, res) {
    return ejecutarAccionAcuerdo(req, res, 'REABRIR', 'reabrirAcuerdo');
}

/**
 * Registrar un acuerdo URGENTE: una reunión que ya ocurrió fuera del sistema.
 *
 * El acuerdo NACE EN 5. Celebrado, saltándose los estatus 1 a 4, con
 * fechaCelebracion, fechaInicioReunion y fechaFinReunion iguales a `fechaReal`.
 * Esas fechas no son adorno: `fechaInicioReunion` es lo que permite capturar el
 * FIDRH retroactivamente.
 *
 * El folio lleva el año de `fechaReal`, no el de hoy, y `urgente` lo fija el SP
 * en 1 — el cliente no lo decide.
 */
async function registrarAcuerdoUrgente(req, res) {
    return ejecutarAccionAcuerdo(req, res, 'REGISTRAR_URGENTE', 'registrarAcuerdoUrgente');
}

/**
 * Rechazar un acuerdo y devolverlo a la dirección con un motivo.
 *
 * Exclusiva de la DRH y su contacto operativo — al revés que registrar. El
 * motivo es obligatorio: es lo que la dirección necesita para corregir.
 *
 * El acuerdo NO se cancela ni se borra: queda en 3. Rechazado esperando
 * corrección, y al actualizarlo regresa solo a 2. En revisión.
 */
async function rechazarAcuerdo(req, res) {
    return ejecutarAccionAcuerdo(req, res, 'RECHAZAR', 'rechazarAcuerdo');
}

/* ────────────────────────────────────────────────────────────────
 * MÓDULO 2 — Agenda y celebración
 *
 * EL ORDEN DEL FLUJO, que explica las precondiciones de cada acción:
 *   PROGRAMAR          cualquier estatus salvo 5 y 6 -> guarda fecha, puede autorizar
 *   REPROGRAMAR        exige 4. Autorizado           -> cambia la fecha
 *   INICIAR_REUNION    exige 4. Autorizado           -> NO cambia el estatus
 *   FINALIZAR_REUNION  exige reunión iniciada        -> ÚNICO paso a 5. Celebrado
 *   CANCELAR           cualquier estatus salvo 5 y 6 -> conserva el estatus
 * ──────────────────────────────────────────────────────────────── */

/**
 * Forma común del `model` de las cinco acciones del módulo.
 *
 * `idAcuerdo` se hace eco del que pidió el cliente porque este SP devuelve
 * `folio` pero NO `idAcuerdo`: sin esto una respuesta exitosa saldría con
 * idAcuerdo en null junto a un folio válido.
 */
function datosCelebracion(r, idAcuerdoSolicitado) {
    const v = (x, alterno) => (x !== undefined && x !== null ? x : alterno);
    return {
        idAcuerdo: v(r.idAcuerdo, idAcuerdoSolicitado !== undefined ? idAcuerdoSolicitado : null),
        folio: v(r.folio, null),
        idStatusAcuerdo: v(r.idStatusAcuerdo, null),

        // Desde el 28/08/2026 PROGRAMAR ya no lo devuelve en 1: o se agenda y
        // el acuerdo queda Autorizado, o el SP rechaza la operación. Se
        // conserva por compatibilidad con las demás acciones del módulo.
        autorizacionBloqueada: v(r.autorizacionBloqueada, 0),

        fechaCelebracionPrevia: v(r.fechaCelebracionPrevia, null),
        fechaCelebracionNueva: v(r.fechaCelebracionNueva, null),

        // El SP solo señala que hay que avisar al Director; disparar el correo
        // es trabajo del backend y queda pendiente.
        requiereNotificacion: v(r.requiereNotificacion, 0),
        correoDestino: v(r.correoDestino, null),
        tema: v(r.tema, null),
        descripcionEjecutiva: v(r.descripcionEjecutiva, null)
    };
}

/** Ejecuta una acción del módulo 2 y responde. */
async function ejecutarAccionCelebracion(req, res, accion, etiqueta) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const respuesta = await acuerdoDrhDAO.gestionarCelebracion(accion, postData, ejecutor, sp.ipDe(req));

        // Agendar, mover o cancelar una reunión son cosas que la dirección no
        // puede enterarse entrando al sistema por casualidad. Iniciar y
        // finalizar la reunión no avisan: ambas ocurren con la gente presente.
        const avisoDeCita = {
            PROGRAMAR: 'programada',
            REPROGRAMAR: 'reprogramada',
            CANCELAR: 'cancelada'
        }[accion];

        if (avisoDeCita && Number(respuesta.status) === 200 &&
            !/^Error/i.test(respuesta.message || '')) {
            avisar(async () => {
                const d = await acuerdoDrhDAO.destinatariosDeAcuerdo(
                    respuesta.idAcuerdo || sp.entero(postData.idAcuerdo));
                correo.citaDeAcuerdo({
                    tipo: avisoDeCita,
                    para: respuesta.correoDestino || (d && d.para),
                    copia: d ? d.copia : [],
                    folio: respuesta.folio || (d && d.folio),
                    tema: respuesta.tema || (d && d.tema),
                    descripcion: respuesta.descripcionEjecutiva || (d && d.descripcionEjecutiva),
                    fecha: respuesta.fechaCelebracionNueva || respuesta.fechaCelebracionPrevia,
                    fechaPrevia: respuesta.fechaCelebracionPrevia,
                    motivo: sp.texto(postData.motivo)
                });
            });
        }

        return sp.responder(res, respuesta, (r) => datosCelebracion(r, sp.entero(postData.idAcuerdo)));
    } catch (ex) {
        winston.error(`[Controller] ${etiqueta} excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * PROGRAMAR — asignar la fecha y hora de celebración.
 *
 * Autorizar y agendar son EL MISMO ACTO: la DRH revisa el FADRH y, si quedó
 * bien, le pone fecha ahí mismo y el acuerdo pasa a 4. Autorizado.
 *
 * Si al acuerdo le queda algún documento pendiente o rechazado, el SP RECHAZA
 * la operación y no escribe la fecha: no tiene sentido reunirse a firmar un
 * oficio que se sabe que está mal. Basta con que uno solo de varios no esté
 * aprobado. Un acuerdo sin documentos se agenda sin obstáculo.
 *
 * Corregido el 28/08/2026; antes guardaba la fecha igual y solo avisaba con
 * `autorizacionBloqueada`. Ver mapa §2 y §3.3.
 */
async function programarCelebracion(req, res) {
    return ejecutarAccionCelebracion(req, res, 'PROGRAMAR', 'programarCelebracion');
}

/**
 * REPROGRAMAR — cambiar la fecha de una cita ya autorizada.
 *
 * Exige estatus 4 y una cita existente: no se reprograma lo que nunca se
 * programó. El motivo es obligatorio. No revisa documentos ni desautoriza.
 */
async function reprogramarCelebracion(req, res) {
    return ejecutarAccionCelebracion(req, res, 'REPROGRAMAR', 'reprogramarCelebracion');
}

/**
 * INICIAR_REUNION — abrir la sesión y habilitar la captura del FIDRH.
 *
 * >>> NO CAMBIA EL ESTATUS <<<. El acuerdo sigue en 4. Lo único que hace es
 * sellar `fechaInicioReunion`, y ese sello es la llave del módulo 3: hasta que
 * existe, las instrucciones se rechazan.
 *
 * Llamarlo dos veces no rompe nada: devuelve la hora del primer sello.
 */
async function iniciarReunion(req, res) {
    return ejecutarAccionCelebracion(req, res, 'INICIAR_REUNION', 'iniciarReunion');
}

/**
 * FINALIZAR_REUNION — cerrar la sesión.
 *
 * >>> ÚNICO PUNTO DEL SISTEMA QUE MUEVE UN ACUERDO A 5. CELEBRADO <<<, salvo
 * REGISTRAR_URGENTE, que documenta una reunión ya ocurrida fuera del sistema.
 * El estatus 5 es a su vez la precondición para concluir el acuerdo.
 */
async function finalizarReunion(req, res) {
    return ejecutarAccionCelebracion(req, res, 'FINALIZAR_REUNION', 'finalizarReunion');
}

/**
 * CANCELAR — el acuerdo ya no se va a llevar a cabo.
 *
 * NO cambia el estatus, y es deliberado: `scg_cat_status_acuerdo` es un catálogo
 * compartido y no se le inventa un estatus "Cancelado". El acuerdo conserva el
 * suyo y se marca con `cancelado` / `motivoCancelacion` / `fechaCancelacion`.
 *
 * Es un punto final: a partir de aquí ninguna acción de agenda lo acepta.
 */
async function cancelarCelebracion(req, res) {
    return ejecutarAccionCelebracion(req, res, 'CANCELAR', 'cancelarCelebracion');
}

/**
 * Agenda de celebraciones en un rango de fechas.
 *
 * Es la pantalla que da sentido al módulo: la DRH abre el día y ve a quién le
 * toca atender. El alcance lo decide el SP desde el token, no el cliente.
 */
async function consultarAgenda(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const data = await acuerdoDrhDAO.consultarAgenda(req.body || {}, ejecutor.idUsuario);

        if (data.rechazo) {
            winston.warn(`[Controller] consultarAgenda rechazo: ${data.rechazo.message} | usuario=${ejecutor.idUsuario}`);
            return sp.responder(res, data.rechazo, () => []);
        }

        return res.status(200).json({
            status: 200,
            message: "Agenda de celebraciones obtenida correctamente.",
            model: data.agenda
        });
    } catch (ex) {
        winston.error(`[Controller] consultarAgenda excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/* ────────────────────────────────────────────────────────────────
 * MÓDULO 3 — Instrucciones y seguimiento
 * ──────────────────────────────────────────────────────────────── */

/**
 * REGISTRAR — capturar una instrucción del FIDRH.
 *
 * Requiere que la DRH haya iniciado la reunión: hasta que existe
 * `fechaInicioReunion`, el SP responde que no se pueden capturar instrucciones.
 * Ese sello lo pone /acuerdoDrh/iniciarReunion.
 */
async function registrarInstruccion(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.registrarInstruccion(postData, ejecutor, sp.ipDe(req));
        return sp.responder(res, r, (x) => ({
            idInstruccion: x.idInstruccion !== undefined ? x.idInstruccion : null
        }));
    } catch (ex) {
        winston.error(`[Controller] registrarInstruccion excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * ACTUALIZAR_PLAZO — fijar o corregir la fecha de compromiso.
 *
 * La rama de éxito del SP devuelve solo `status` y `message`, así que el `model`
 * va en null a propósito y no como objeto vacío: no hay nada que leer de aquí.
 */
async function actualizarPlazoInstruccion(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.actualizarPlazoInstruccion(postData, ejecutor, sp.ipDe(req));
        return sp.responder(res, r, () => null);
    } catch (ex) {
        winston.error(`[Controller] actualizarPlazoInstruccion excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * ACTUALIZAR_AVANCE — mover el semáforo de una instrucción.
 *
 * Su respuesta lleva dos campos que ninguna otra acción del módulo trae:
 *   idStatusAcuerdo      estatus del acuerdo DESPUÉS de la operación
 *   conclusionBloqueada  1 = todo quedó concluido, pero el acuerdo NO cerró
 *                        porque la reunión aún no se finaliza. Es accionable
 *                        para la interfaz, no un error.
 */
async function actualizarAvanceInstruccion(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.actualizarAvanceInstruccion(postData, ejecutor, sp.ipDe(req));
        return sp.responder(res, r, (x) => ({
            idInstruccion: sp.entero(postData.idInstruccion),
            idStatusAcuerdo: x.idStatusAcuerdo !== undefined ? x.idStatusAcuerdo : null,
            conclusionBloqueada: x.conclusionBloqueada !== undefined ? x.conclusionBloqueada : 0
        }));
    } catch (ex) {
        winston.error(`[Controller] actualizarAvanceInstruccion excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/** Cabecera del acuerdo y sus instrucciones — alimenta la pantalla de seguimiento. */
async function consultarInstrucciones(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const data = await acuerdoDrhDAO.consultarInstrucciones(req.body || {}, ejecutor.idUsuario);

        if (data.rechazo) {
            winston.warn(`[Controller] consultarInstrucciones rechazo: ${data.rechazo.message} | usuario=${ejecutor.idUsuario}`);
            return sp.responder(res, data.rechazo, () => ({}));
        }

        return res.status(200).json({
            status: 200,
            message: "Instrucciones del acuerdo obtenidas correctamente.",
            model: { acuerdo: data.acuerdo, instrucciones: data.instrucciones }
        });
    } catch (ex) {
        winston.error(`[Controller] consultarInstrucciones excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/* ────────────────────────────────────────────────────────────────
 * Tablero e historial
 * ──────────────────────────────────────────────────────────────── */

/**
 * Tablero de estadísticas.
 *
 * Resumen transversal: cruza acuerdos, sus instrucciones y el catálogo de
 * direcciones. El alcance lo resuelve el SP desde el token; los roles 8 y 9 solo
 * ven su dirección y pedir otra se rechaza.
 */
async function consultarDashboard(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const data = await acuerdoDrhDAO.consultarDashboard(req.body || {}, ejecutor.idUsuario);

        if (data.rechazo) {
            winston.warn(`[Controller] consultarDashboard rechazo: ${data.rechazo.message} | usuario=${ejecutor.idUsuario}`);
            return sp.responder(res, data.rechazo, () => null);
        }

        return res.status(200).json({
            status: 200,
            message: "Estadísticas del tablero obtenidas correctamente.",
            model: data.dashboard
        });
    } catch (ex) {
        winston.error(`[Controller] consultarDashboard excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * Bitácora de un acuerdo.
 *
 * Cero movimientos NO es un error: es un acuerdo sin historia todavía. El
 * rechazo —no existe, no tiene acceso— sí llega con status y message.
 */
async function consultarHistorial(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const data = await acuerdoDrhDAO.consultarHistorial(req.body || {}, ejecutor.idUsuario);

        if (data.rechazo) {
            winston.warn(`[Controller] consultarHistorial rechazo: ${data.rechazo.message} | usuario=${ejecutor.idUsuario}`);
            return sp.responder(res, data.rechazo, () => []);
        }

        return res.status(200).json({
            status: 200,
            message: "Historial del acuerdo obtenido correctamente.",
            model: data.historial
        });
    } catch (ex) {
        winston.error(`[Controller] consultarHistorial excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/* ────────────────────────────────────────────────────────────────
 * ADSCRIPCIONES — exclusivas del rol 1 (administrador)
 * ──────────────────────────────────────────────────────────────── */

/** Quién está adscrito a qué, y quiénes pueden asignarse. */
async function consultarAdscripciones(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const data = await acuerdoDrhDAO.consultarAdscripciones(req.body || {}, ejecutor.idUsuario);

        if (data.rechazo) {
            winston.warn(`[Controller] consultarAdscripciones rechazo: ${data.rechazo.message} | usuario=${ejecutor.idUsuario}`);
            return sp.responder(res, data.rechazo, () => null);
        }

        return res.status(200).json({
            status: 200,
            message: "Adscripciones obtenidas correctamente.",
            model: { adscripciones: data.adscripciones, asignables: data.asignables }
        });
    } catch (ex) {
        winston.error(`[Controller] consultarAdscripciones excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/** Asignar o reactivar una adscripción. */
async function asignarAdscripcion(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.asignarAdscripcion(postData, ejecutor);
        return sp.responder(res, r, (x) => ({
            idEnlace: x.idEnlace !== undefined ? x.idEnlace : null,
            idUnidadResponsable: x.idUnidadResponsable !== undefined ? x.idUnidadResponsable : null,
            idUsuario: x.idUsuario !== undefined ? x.idUsuario : null,
            tipoEnlace: x.tipoEnlace !== undefined ? x.tipoEnlace : null,
            esTitular: x.esTitular !== undefined ? x.esTitular : 0
        }));
    } catch (ex) {
        winston.error(`[Controller] asignarAdscripcion excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/** Desactivar una adscripción (baja lógica, con efecto inmediato). */
async function desactivarAdscripcion(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.desactivarAdscripcion(postData, ejecutor);
        return sp.responder(res, r, (x) => ({
            idEnlace: x.idEnlace !== undefined ? x.idEnlace : null,
            idUsuario: x.idUsuario !== undefined ? x.idUsuario : null
        }));
    } catch (ex) {
        winston.error(`[Controller] desactivarAdscripcion excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/* ────────────────────────────────────────────────────────────────
 * MÓDULO 4 — Documentos
 *
 * El archivo viaja en base64 dentro de `documento`, con la misma forma que usa
 * controlDeGestion para los asuntos:
 *     documento: { fileName: "oficio.pdf", fileEncode64: "JVBERi0x..." }
 * El backend lo escribe en disco y le pasa al SP el nombre, la ruta y el
 * tamaño reales — nunca los que diga el cliente.
 * ──────────────────────────────────────────────────────────────── */

/** Forma común del `model` de las cuatro acciones de escritura del módulo. */
function datosDocumento(r) {
    const v = (x) => (x !== undefined && x !== null ? x : null);
    return {
        idDocumento: v(r.idDocumento),
        idAcuerdo: v(r.idAcuerdo),
        folio: v(r.folio),
        statusDocumento: v(r.statusDocumento),
        idStatusAcuerdo: v(r.idStatusAcuerdo),
        autorizacionDisparada: r.autorizacionDisparada !== undefined ? r.autorizacionDisparada : 0
    };
}

/** Adjuntar un documento a un acuerdo. Queda PENDIENTE de revisión. */
async function registrarDocumento(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.registrarDocumento(postData, ejecutor, sp.ipDe(req));
        return sp.responder(res, r, datosDocumento);
    } catch (ex) {
        winston.error(`[Controller] registrarDocumento excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/** Reenviar corregido un documento rechazado. Devuelve el acuerdo a En revisión. */
async function reemplazarDocumento(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.reemplazarDocumento(postData, ejecutor, sp.ipDe(req));
        return sp.responder(res, r, datosDocumento);
    } catch (ex) {
        winston.error(`[Controller] reemplazarDocumento excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * Aprobar o rechazar un documento.
 *
 * Rechazar exige motivo y dispara notificación; aprobar el último pendiente
 * puede autorizar el acuerdo.
 */
async function revisarDocumento(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.revisarDocumento(postData, ejecutor, sp.ipDe(req));

        // El SP señala el rechazo con `requiereNotificacion`; aquí se cumple.
        // Se copia también al resto de la dirección: si el Enlace subió el
        // documento, su Director tiene que enterarse de que lo devolvieron.
        if (Number(r.requiereNotificacion) === 1 && r.motivoRechazo) {
            avisar(async () => {
                const d = await acuerdoDrhDAO.destinatariosDeAcuerdo(r.idAcuerdo);
                correo.documentoRechazado({
                    para: r.correoDestino || (d && d.para),
                    copia: d ? d.copia : [],
                    folio: r.folio,
                    documento: postData.nombreDocumento || null,
                    motivo: r.motivoRechazo,
                    revisor: ejecutor.nombreCompleto
                });
            });
        }

        return sp.responder(res, r, (x) => Object.assign(datosDocumento(x), {
            requiereNotificacion: x.requiereNotificacion !== undefined ? x.requiereNotificacion : 0,
            correoDestino: x.correoDestino !== undefined ? x.correoDestino : null,
            motivoRechazo: x.motivoRechazo !== undefined ? x.motivoRechazo : null
        }));
    } catch (ex) {
        winston.error(`[Controller] revisarDocumento excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/** Retirar un documento (baja lógica; el archivo se conserva en disco). */
async function eliminarDocumento(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body;
        if (!postData || !Object.keys(postData).length) {
            return res.status(200).json(utils.postDataInvalido(postData));
        }

        const r = await acuerdoDrhDAO.eliminarDocumento(postData, ejecutor, sp.ipDe(req));
        return sp.responder(res, r, datosDocumento);
    } catch (ex) {
        winston.error(`[Controller] eliminarDocumento excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/** Los documentos de un acuerdo, con el conteo por estatus. */
async function consultarDocumentos(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const data = await acuerdoDrhDAO.consultarDocumentos(req.body || {}, ejecutor.idUsuario);

        if (data.rechazo) {
            winston.warn(`[Controller] consultarDocumentos rechazo: ${data.rechazo.message} | usuario=${ejecutor.idUsuario}`);
            return sp.responder(res, data.rechazo, () => ({}));
        }

        return res.status(200).json({
            status: 200,
            message: "Documentos del acuerdo obtenidos correctamente.",
            model: { acuerdo: data.acuerdo, documentos: data.documentos }
        });
    } catch (ex) {
        winston.error(`[Controller] consultarDocumentos excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * Descargar o ver un documento.
 *
 * NO se sirve la ruta que mande el cliente: se pide el `idDocumento`, se
 * consulta el acuerdo al que pertenece —lo que aplica el alcance por unidad— y
 * de ahí sale la ruta. Aceptar la ruta del cliente permitiría pedir cualquier
 * archivo del servidor, incluidos los de otras unidades.
 */
async function verDocumento(req, res) {
    try {
        const ejecutor = await resolverEjecutor(req);
        if (!ejecutor) return sesionInvalida(res);

        const postData = req.body || {};
        const idDocumento = sp.entero(postData.idDocumento);
        if (!idDocumento || !sp.entero(postData.idAcuerdo)) {
            return res.status(200).json({
                status: 400,
                message: "Se requieren idAcuerdo e idDocumento."
            });
        }

        // El alcance lo aplica el SP: si no puede ver ese acuerdo, no llega aquí.
        const data = await acuerdoDrhDAO.consultarDocumentos(postData, ejecutor.idUsuario);
        if (data.rechazo) {
            return sp.responder(res, data.rechazo, () => null);
        }

        const doc = (data.documentos || []).find((d) => Number(d.idDocumento) === idDocumento);
        if (!doc) {
            return res.status(200).json({
                status: 404,
                message: "El documento no existe o ya fue retirado."
            });
        }

        const ruta = path.resolve('./src', doc.ruta);
        if (!fs.existsSync(ruta)) {
            winston.warn(`verDocumento - archivo ausente en disco: ${doc.ruta}`);
            return res.status(200).json({
                status: 404,
                message: "El archivo no se encuentra en el servidor."
            });
        }

        const ext = path.extname(ruta).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';

        res.contentType(contentType);
        return res.sendFile(ruta);
    } catch (ex) {
        winston.error(`[Controller] verDocumento excepción: ${ex.message}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

module.exports = {
    resolverEjecutor,
    sesionInvalida,
    consultarSesion,
    consultarCatalogos,
    consultarAcuerdos,
    consultarDashboard,
    consultarHistorial,
    consultarAdscripciones,
    asignarAdscripcion,
    desactivarAdscripcion,
    registrarDocumento,
    reemplazarDocumento,
    revisarDocumento,
    eliminarDocumento,
    consultarDocumentos,
    verDocumento,
    registrarAcuerdo,
    actualizarAcuerdo,
    reabrirAcuerdo,
    registrarAcuerdoUrgente,
    rechazarAcuerdo,
    programarCelebracion,
    reprogramarCelebracion,
    iniciarReunion,
    finalizarReunion,
    cancelarCelebracion,
    consultarAgenda,
    registrarInstruccion,
    actualizarPlazoInstruccion,
    actualizarAvanceInstruccion,
    consultarInstrucciones
};
