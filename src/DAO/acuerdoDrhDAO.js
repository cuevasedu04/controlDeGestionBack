const db = require("../config/database");
const winston = require("../config/winston");
const sp = require("../api/acuerdoDrh/spAcuerdoDrh");
const utils = require("../api/utils/utils");
const path = require("path");
const fs = require("fs");

/**
 * Carga al usuario que ejecuta la petición desde la BASE, no desde el token.
 *
 * El token dice qué idUsuario es; de ahí en adelante todo sale de la base en
 * cada petición. Cuesta una consulta, y a cambio dar de baja a alguien o
 * cambiarle el rol surte efecto de inmediato, sin esperar a que expire el JWT.
 *
 * La unidad sale de sadrh_tbl_enlace_operativo_acuerdo, que es determinista
 * gracias al índice único uq_enlace_adscripcion_activa: un usuario no puede
 * tener dos adscripciones activas a la vez.
 */
async function obtenerEjecutor(idUsuario) {
    try {
        const sql = `
            SELECT u.idUsuario,
                   u.idUsuarioRol,
                   r.rol,
                   u.correo,
                   TRIM(CONCAT(u.nombre, ' ',
                               COALESCE(u.primerApellido, ''), ' ',
                               COALESCE(u.segundoApellido, ''))) AS nombreCompleto,
                   e.idUnidadResponsable,
                   e.tipoEnlace,
                   ur.unidadResponsable
              FROM scg_tbl_usuario u
              LEFT JOIN scg_cat_usuario_rol r
                     ON r.idUsuarioRol = u.idUsuarioRol
              LEFT JOIN sadrh_tbl_enlace_operativo_acuerdo e
                     ON e.idUsuario = u.idUsuario AND e.activo = 1
              LEFT JOIN scg_cat_unidad_responsable ur
                     ON ur.idUnidadResponsable = e.idUnidadResponsable
             WHERE u.idUsuario = ? AND u.activo = 1
             LIMIT 1`;

        const filas = await db.query(sql, [idUsuario]);
        return filas && filas.length ? JSON.parse(JSON.stringify(filas[0])) : null;
    } catch (ex) {
        winston.error(`obtenerEjecutor - Excepción: ${ex.message} | idUsuario=${idUsuario}`);
        throw ex;
    }
}

/**
 * SP_OBTENER_CATALOGOS_SISTEMA( _idUsuarioConsulta ) — 6 conjuntos de resultados.
 *
 * Los seis filtran `activo = 1`: ofrecer opciones dadas de baja hacía que el
 * usuario eligiera un tema y recibiera "el tema no existe o está inactivo".
 *
 * `unidadesResponsables` viene filtrado por rol: los roles 8 y 9 reciben SOLO
 * su propia unidad, que es la única en la que SP_GESTIONAR_ACUERDO les dejará
 * registrar. Los roles 6 y 7 reciben las seis. Por eso el desplegable de unidad
 * se puede construir directo con este conjunto, sin filtrar del lado del
 * cliente — y por eso la respuesta ya NO es igual para todos: es cacheable por
 * unidad, no de forma global.
 */
async function obtenerCatalogos(idUsuario) {
    try {
        const result = await db.query('CALL SP_OBTENER_CATALOGOS_SISTEMA(?)', [idUsuario]);
        const primero = result[0] || [];

        // El SP responde de dos formas distintas y hay que distinguirlas por la
        // PRESENCIA de la columna `status`, no por la posición del conjunto.
        // Leer result[0] a ciegas metería un rechazo disfrazado de catálogo vacío.
        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        return {
            catalogos: {
                unidadesResponsables: sp.filas(result[0]),
                estatusAcuerdo: sp.filas(result[1]),
                semaforosAvance: sp.filas(result[2]),
                prioridades: sp.filas(result[3]),
                temas: sp.filas(result[4]),
                tiposDocumento: sp.filas(result[5])
            }
        };
    } catch (ex) {
        winston.error(`obtenerCatalogos - Excepción: ${ex.message} | idUsuario=${idUsuario}`);
        throw ex;
    }
}

/**
 * Los tres modos con que se puede pedir la lista respecto de los cancelados.
 *
 * Cualquier otra cosa —incluido no mandar nada— cae en 'NO', que es como se
 * comportaba el SP antes de tener el parámetro. Se normaliza aquí además de en
 * la base: el SP ya falla cerrado, pero un valor raro que llegue del cliente no
 * tiene por qué viajar hasta allá.
 */
const MODOS_CANCELADOS = ['NO', 'TAMBIEN', 'SOLO'];

/**
 * SP_CONSULTAR_ACUERDOS( _busqueda, _idStatus, _fechaInicio, _fechaFin,
 *                        _idUsuarioConsulta, _cancelados )
 *
 * El SP filtra por unidad según el rol de quien consulta: los roles 8 y 9 solo
 * ven su dirección; la DRH y su contacto operativo ven todo. El idUsuario sale
 * del token, nunca del cuerpo, así que el alcance no se puede falsear desde el
 * cliente.
 *
 * `_cancelados` se agregó el 06/09/2026, al final de la firma. Un acuerdo
 * cancelado estaba escondido en TODAS las pantallas, incluida la Bitácora, que
 * es el archivo; ahora la Bitácora puede pedirlos. Quien no lo mande sigue sin
 * verlos, que es lo que el tablero y la bandeja necesitan: ahí se lista trabajo
 * pendiente, y un acuerdo cancelado ya no lo es.
 */
async function consultarAcuerdos(postData, idUsuario) {
    try {
        const modo = MODOS_CANCELADOS.includes(String(postData.cancelados || '').toUpperCase())
            ? String(postData.cancelados).toUpperCase()
            : 'NO';

        const result = await db.query(
            'CALL SP_CONSULTAR_ACUERDOS(?, ?, ?, ?, ?, ?)',
            [
                sp.texto(postData.busqueda),
                sp.entero(postData.idStatus),
                sp.texto(postData.fechaInicio),
                sp.texto(postData.fechaFin),
                idUsuario,
                modo
            ]
        );

        const primero = result[0] || [];

        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        return { acuerdos: sp.filas(primero) };
    } catch (ex) {
        winston.error(`consultarAcuerdos - Excepción: ${ex.message} | idUsuario=${idUsuario}`);
        throw ex;
    }
}

/**
 * SP_GESTIONAR_ACUERDO — módulo 1, las cuatro acciones de escritura.
 *
 * SP_GESTIONAR_ACUERDO( _accion, _idAcuerdo, _idUnidadResponsable, _idTema,
 *   _idPrioridad, _descripcionEjecutiva, _urgente, _acuerdoTUAF,
 *   _contenidoOficio, _fechaReal, _modoReapertura, _motivo, _idUsuarioEjecuta,
 *   _usuarioEjecuta, _ipOrigen )
 *
 * `_contenidoOficio` se agregó el 28/08/2026, después de `_acuerdoTUAF`: es la
 * descripción breve del oficio a firmar, que el FADRH capturaba desde siempre
 * pero no tenía dónde guardarse.
 *
 * El ejecutor y su nombre salen de la BASE, nunca del cuerpo: el nombre se
 * firma en la bitácora y aceptarlo del cliente permitiría firmar como otro.
 *
 * El SP abre su propia transacción, así que aquí NO se envuelve el CALL en otra:
 * un START TRANSACTION dentro de otra abierta hace COMMIT implícito de la
 * anterior.
 */
async function gestionarAcuerdo(accion, p, ejecutor, ipOrigen) {
    try {
        const result = await db.query(
            'CALL SP_GESTIONAR_ACUERDO(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                accion,
                sp.entero(p.idAcuerdo),
                sp.entero(p.idUnidadResponsable),
                sp.entero(p.idTema),
                sp.entero(p.idPrioridad),
                sp.texto(p.descripcionEjecutiva),
                p.urgente === null || p.urgente === undefined ? null : (p.urgente ? 1 : 0),
                p.acuerdoTUAF === null || p.acuerdoTUAF === undefined ? null : (p.acuerdoTUAF ? 1 : 0),
                sp.texto(p.contenidoOficio),
                sp.texto(p.fechaReal),
                sp.texto(p.modoReapertura),
                sp.texto(p.motivo),
                ejecutor.idUsuario,
                ejecutor.nombreCompleto,
                ipOrigen,
                // Para cuándo se necesita resuelto. Desde el 01/09/2026 el SP
                // deriva de aquí la prioridad, así que `idPrioridad` solo se
                // usa cuando NO viene esta fecha —los acuerdos de antes.
                sp.texto(p.fechaCumplimiento),
                // La prioridad fijada a mano, si quien captura decidió que la
                // fecha no la refleja. Gana sobre la fecha; null la deja
                // automática. En ACTUALIZAR, null significa «no la cambies»:
                // para soltarla está la acción AJUSTAR_PRIORIDAD.
                sp.entero(p.prioridadManual)
            ]
        );

        const respuesta = sp.respuestaEscritura(result);

        if (Number(respuesta.status) !== 200 || /^Error/i.test(respuesta.message || '')) {
            winston.warn(`gestionarAcuerdo ${accion} - ${respuesta.status} | ${respuesta.message} | usuario=${ejecutor.idUsuario}`);
        }

        return respuesta;
    } catch (ex) {
        winston.error(`gestionarAcuerdo ${accion} - Excepción: ${ex.message} | usuario=${ejecutor.idUsuario}`);
        throw ex;
    }
}

/**
 * SP_GESTIONAR_CELEBRACION_ACUERDO — módulo 2, agenda y celebración.
 *
 * SP_GESTIONAR_CELEBRACION_ACUERDO( _accion, _idAcuerdo, _fechaCelebracion,
 *   _motivo, _idUsuarioEjecuta, _usuarioEjecuta, _ipOrigen )
 *
 * Cinco acciones: PROGRAMAR, REPROGRAMAR, CANCELAR, INICIAR_REUNION y
 * FINALIZAR_REUNION. Las cinco son exclusivas de la DRH (rol 6) y su contacto
 * operativo (rol 7); ese filtro lo aplica el SP y aquí no se duplica.
 *
 * La acción se pasa como literal desde cada controlador y NUNCA desde el cuerpo
 * de la petición: si viniera del cliente, esto sería un endpoint genérico y las
 * rutas con verbo perderían su razón de ser.
 */
async function gestionarCelebracion(accion, p, ejecutor, ipOrigen) {
    try {
        const result = await db.query(
            'CALL SP_GESTIONAR_CELEBRACION_ACUERDO(?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                accion,
                sp.entero(p.idAcuerdo),
                sp.texto(p.fechaCelebracion),
                sp.texto(p.motivo),
                ejecutor.idUsuario,
                ejecutor.nombreCompleto,
                ipOrigen,
                // Dónde y cómo se celebra. Los dos son opcionales: una cita
                // puede quedar agendada antes de saber en qué sala, y exigir
                // el lugar para poder agendar convertiría un dato útil en un
                // obstáculo. Se completan después con REPROGRAMAR.
                sp.texto(p.modalidad),
                sp.texto(p.lugar)
            ]
        );

        const respuesta = sp.respuestaEscritura(result);

        if (Number(respuesta.status) !== 200 || /^Error/i.test(respuesta.message || '')) {
            winston.warn(`gestionarCelebracion ${accion} - ${respuesta.status} | ${respuesta.message} | acuerdo=${p.idAcuerdo} | usuario=${ejecutor.idUsuario}`);
        }

        return respuesta;
    } catch (ex) {
        winston.error(`gestionarCelebracion ${accion} - Excepción: ${ex.message} | acuerdo=${p.idAcuerdo}`);
        throw ex;
    }
}

/**
 * SP_CONSULTAR_AGENDA_CELEBRACIONES( _fechaInicio, _fechaFin,
 *                                    _idUnidadResponsable, _idUsuarioConsulta )
 *
 * La agenda NO muestra: acuerdos sin fecha de celebración, los cancelados
 * —conservan su fecha a propósito, y el SP los excluye con `cancelado = 0`— ni
 * los dados de baja.
 *
 * El alcance lo resuelve el SP a partir del idUsuario del token: los roles 8 y 9
 * solo ven su unidad y pedir otra se rechaza.
 */
async function consultarAgenda(postData, idUsuario) {
    try {
        const result = await db.query(
            'CALL SP_CONSULTAR_AGENDA_CELEBRACIONES(?, ?, ?, ?)',
            [
                sp.texto(postData.fechaInicio),
                sp.texto(postData.fechaFin),
                sp.entero(postData.idUnidadResponsable),
                idUsuario
            ]
        );

        const primero = result[0] || [];

        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        return { agenda: sp.filas(primero) };
    } catch (ex) {
        winston.error(`consultarAgenda - Excepción: ${ex.message} | usuario=${idUsuario}`);
        throw ex;
    }
}

/* ────────────────────────────────────────────────────────────────
 * MÓDULO 3 — Instrucciones y seguimiento
 *
 * SP_GESTIONAR_INSTRUCCION_ACUERDO( _accion, _idAcuerdo, _idInstruccion,
 *   _origen, _instruccion, _fechaCompromiso, _idAvance, _especificarAvance,
 *   _requiereReunion, _motivoNoAtendido, _idUsuarioEjecuta, _usuarioEjecuta,
 *   _ipOrigen )
 *
 * PERMISOS — las tres acciones del mismo SP no son del mismo rol.
 *   REGISTRAR          -> roles 8 y 9 (Director adscrito / Enlace operativo)
 *   ACTUALIZAR_AVANCE  -> roles 8 y 9
 *   ACTUALIZAR_PLAZO   -> roles 6, 7, 8 y 9
 *
 * El plazo lo fijaban SOLO la DRH y su contacto operativo, con el argumento de
 * que lo pone quien va a exigir el cumplimiento. El equipo lo cambió en la
 * demostración del 01/09/2026: el Director y su Enlace también, porque son
 * quienes saben en cuánto pueden cumplir. Sigue acotado a su propia unidad y
 * todo cambio queda en la bitácora con quién lo hizo.
 *
 * Los roles 8 y 9 quedan además acotados a su propia unidad.
 *
 * Los parámetros que cada acción no usa van en null explícito y comentados por
 * posición: son trece y confundir dos de ellos no da error de sintaxis, solo un
 * comportamiento equivocado.
 * ──────────────────────────────────────────────────────────────── */

/** Ejecuta el SP del módulo 3 y devuelve su fila de respuesta. */
async function llamarInstruccion(accion, parametros, ejecutor) {
    const result = await db.query(
        'CALL SP_GESTIONAR_INSTRUCCION_ACUERDO(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        parametros
    );

    const respuesta = sp.respuestaEscritura(result);

    if (Number(respuesta.status) !== 200 || /^Error/i.test(respuesta.message || '')) {
        winston.warn(`${accion} - ${respuesta.status} | ${respuesta.message} | usuario=${ejecutor.idUsuario}`);
    }

    return respuesta;
}

/**
 * REGISTRAR — capturar una instrucción del FIDRH.
 *
 * El origen SIEMPRE es FIDRH y lo fija el servidor: el FADRH no genera
 * instrucciones y el default de la columna sigue siendo 'FADRH', así que se
 * manda explícito.
 *
 * Requiere que la DRH haya iniciado la reunión: hasta que existe
 * `fechaInicioReunion`, el SP lo rechaza.
 *
 * ACEPTA PLAZO, y es opcional. Si en la reunión se acordó fecha, se guarda con
 * la instrucción; si no, la instrucción nace sin ella y se le pone después con
 * ACTUALIZAR_PLAZO.
 *
 * No siempre fue así. Hasta el 04/09/2026 se mandaba null a propósito: el SP lo
 * habría recibido, pero ACTUALIZAR_PLAZO estaba reservada a los roles 6 y 7, y
 * como REGISTRAR solo la ejecutan los 8 y 9, dejar pasar `fechaCompromiso` le
 * habría permitido al Director ponerse su propia fecha — justo lo que la regla
 * impedía. Esa regla desapareció el 01/09/2026, cuando el equipo decidió que el
 * Director y su Enlace también fijan plazos.
 */
async function registrarInstruccion(p, ejecutor, ipOrigen) {
    try {
        return await llamarInstruccion('registrarInstruccion', [
            'REGISTRAR',
            sp.entero(p.idAcuerdo),
            null,                       // _idInstruccion
            'FIDRH',                    // _origen: lo fija el servidor
            sp.texto(p.instruccion),
            // _fechaCompromiso — SE MANDA desde el 04/09/2026.
            //
            // Iba en null a propósito: el SP lo aceptaba de los roles 8 y 9
            // pero fijarlo era de la DRH, así que mandarlo habría abierto por
            // el endpoint lo que el negocio cerraba.
            //
            // Dejó de serlo el 01/09, cuando el equipo decidió que el Director
            // también fija plazos. Con la misma persona autorizada para las dos
            // cosas, separarlas obligaba a capturar la instrucción y volver a
            // abrirla para ponerle la fecha: dos pasos para una decisión.
            //
            // Sigue siendo OPCIONAL. Una instrucción puede quedar sin plazo si
            // en la reunión no se acordó, y para eso está ACTUALIZAR_PLAZO.
            sp.texto(p.fechaCompromiso),
            null, null, null, null,     // avance, especificar, requiereReunion, motivoNoAtendido
            ejecutor.idUsuario,
            ejecutor.nombreCompleto,
            ipOrigen
        ], ejecutor);
    } catch (ex) {
        winston.error(`registrarInstruccion - Excepción: ${ex.message} | acuerdo=${p.idAcuerdo}`);
        throw ex;
    }
}

/**
 * ACTUALIZAR_PLAZO — fijar o corregir la fecha de compromiso.
 *
 * De la DRH, su contacto operativo, el Director y su Enlace. Desde el
 * 01/09/2026: el plazo lo pone quien va a exigir el cumplimiento Y quien sabe
 * en cuánto puede cumplir.
 *
 * Sigue haciendo falta aunque el plazo ya se pueda fijar al capturar: es la vía
 * para CORREGIRLO después, y para ponérselo a las que se capturaron sin él.
 *
 * Detecta la redundancia: reenviar el mismo plazo responde "ya tiene registrado
 * ese mismo plazo" en 200. No falló, simplemente no cambió nada.
 */
async function actualizarPlazoInstruccion(p, ejecutor, ipOrigen) {
    try {
        return await llamarInstruccion('actualizarPlazoInstruccion', [
            'ACTUALIZAR_PLAZO',
            null,                       // _idAcuerdo: se deduce de la instrucción
            sp.entero(p.idInstruccion),
            null,                       // _origen
            null,                       // _instruccion
            sp.texto(p.fechaCompromiso),
            null, null, null, null,     // avance, especificar, requiereReunion, motivoNoAtendido
            ejecutor.idUsuario,
            ejecutor.nombreCompleto,
            ipOrigen
        ], ejecutor);
    } catch (ex) {
        winston.error(`actualizarPlazoInstruccion - Excepción: ${ex.message} | instruccion=${p.idInstruccion}`);
        throw ex;
    }
}

/**
 * ACTUALIZAR_AVANCE — mover el semáforo de una instrucción.
 *
 * Exclusiva del Director adscrito y su Enlace, acotada a su unidad: quien
 * responde por el avance es quien lo reporta.
 *
 * >>> ES LA ACCIÓN QUE PUEDE CERRAR UN ACUERDO <<<. Tres salidas, todas en 200:
 *   a) quedan instrucciones fuera de Concluido -> estatus sin cambio
 *   b) todas concluidas Y el acuerdo en 5. Celebrado -> pasa a 6. Concluido
 *   c) todas concluidas pero el acuerdo NO celebrado -> el avance SÍ se guarda,
 *      el acuerdo no concluye y `conclusionBloqueada` llega en 1
 *
 * Y la simetría: si una instrucción deja de estar concluida y el acuerdo estaba
 * Concluido, regresa a Celebrado.
 */
async function actualizarAvanceInstruccion(p, ejecutor, ipOrigen) {
    try {
        return await llamarInstruccion('actualizarAvanceInstruccion', [
            'ACTUALIZAR_AVANCE',
            null,                       // _idAcuerdo: se deduce de la instrucción
            sp.entero(p.idInstruccion),
            null,                       // _origen
            null,                       // _instruccion
            null,                       // _fechaCompromiso: el plazo no se toca aquí
            sp.entero(p.idAvance),
            sp.texto(p.especificarAvance),
            p.requiereReunion === null || p.requiereReunion === undefined ? null : (p.requiereReunion ? 1 : 0),
            sp.texto(p.motivoNoAtendido),
            ejecutor.idUsuario,
            ejecutor.nombreCompleto,
            ipOrigen
        ], ejecutor);
    } catch (ex) {
        winston.error(`actualizarAvanceInstruccion - Excepción: ${ex.message} | instruccion=${p.idInstruccion}`);
        throw ex;
    }
}

/**
 * SP_CONSULTAR_INSTRUCCIONES_ACUERDO( _idAcuerdo, _idUsuarioConsulta )
 *
 * Devuelve dos conjuntos: la cabecera del acuerdo y sus instrucciones. Es lo
 * que alimenta la pantalla de seguimiento.
 */
async function consultarInstrucciones(postData, idUsuario) {
    try {
        const result = await db.query(
            'CALL SP_CONSULTAR_INSTRUCCIONES_ACUERDO(?, ?)',
            [sp.entero(postData.idAcuerdo), idUsuario]
        );

        const primero = result[0] || [];

        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        return {
            acuerdo: (primero && primero[0]) ? JSON.parse(JSON.stringify(primero[0])) : null,
            instrucciones: sp.filas(result[1])
        };
    } catch (ex) {
        winston.error(`consultarInstrucciones - Excepción: ${ex.message} | acuerdo=${postData.idAcuerdo}`);
        throw ex;
    }
}

/**
 * SP_OBTENER_DASHBOARD_ESTADISTICAS( _idUnidadResponsable, _idUsuarioConsulta,
 *                                    _fechaInicio, _fechaFin )
 *
 * CUATRO CONJUNTOS, y el orden importa porque el driver los entrega por
 * posición. El cuarto se agregó AL FINAL el 04/09/2026, como decía este mismo
 * comentario que había que hacerlo: mover uno rompería a cualquier consumidor.
 *   1. resumenAcuerdos       totales por estatus. UNA fila.
 *   2. resumenInstrucciones  semáforo agregado y vencidas. UNA fila.
 *   3. desglosePorDireccion  una fila POR CADA dirección activa.
 *   4. movimientoPeriodo     los hechos del rango pedido. UNA fila.
 *   5. tiemposPorTramo       cuánto tarda cada tramo. TRES filas.
 *   6. avancePorDireccion    el semáforo de cada dirección. UNA fila por
 *                           (dirección, avance) con cuenta mayor que cero.
 *
 * El tercero incluye las direcciones con CERO acuerdos, con todo en cero: sale
 * de un LEFT JOIN desde el catálogo y no desde los acuerdos, porque que una
 * dirección no haya registrado nada es justamente el dato que la DRH querría
 * ver.
 *
 * EL PERIODO SOLO TOCA EL CUARTO. Los tres primeros son inventario —cuántos hay
 * HOY en cada estado— y recortarlos por un rango sería mentir: en un «reporte
 * de septiembre», decir «4 por revisar» daría a entender que había cuatro en
 * septiembre, cuando son los cuatro que están esperando ahora mismo. Un
 * inventario es la foto del momento en que se mira.
 *
 * EL QUINTO MEZCLA LAS DOS LECTURAS, y las separa por columna. `cuantos`,
 * `diasPromedio` y `diasMaximo` son de lo que YA cruzó el tramo dentro del
 * corte; `esperando` y `diasDelMasViejo` son de lo que está detenido HOY. La
 * segunda es la que mueve a actuar —«ocho llevan esperando, el más viejo 23
 * días»— y la primera la que se presenta. Deja fuera cancelados y urgentes:
 * un urgente nace Celebrado y nunca recorrió los dos primeros tramos, así que
 * promediarlo haría ver el proceso más rápido de lo que es.
 *
 * El cuarto cuenta por FECHA DEL HECHO, decisión del usuario el 04/09/2026:
 * cada cifra se corta por su propia fecha, no por la de registro del acuerdo.
 * Sin eso no se puede comparar lo que entró contra lo que salió, que es la
 * cifra que dice si el rezago crece. Sale de la bitácora, que es donde viven
 * las fechas de autorización, rechazo y conclusión — la tabla del acuerdo no
 * tiene columna para ninguna de las tres.
 *
 * Los tres primeros excluyen cancelados, de modo que la suma del desglose
 * cuadra con el primer conjunto y con lo que devuelve consultarAcuerdos. El
 * cuarto NO los excluye, y es a propósito: un acuerdo cancelado en octubre sí
 * se registró en septiembre, y el movimiento cuenta hechos, no lo que sigue
 * vivo. Por eso trae su propia cifra de `cancelados`.
 *
 * El rol 1 Admin queda rechazado: administra el sistema, no opera dentro de él.
 */
async function consultarDashboard(postData, idUsuario) {
    try {
        const result = await db.query(
            'CALL SP_OBTENER_DASHBOARD_ESTADISTICAS(?, ?, ?, ?)',
            [
                sp.entero(postData.idUnidadResponsable),
                idUsuario,
                // En null cubren toda la historia, que es como se pedía antes
                // de que existiera el periodo: quien no mande fechas sigue
                // recibiendo lo mismo que recibía.
                sp.texto(postData.fechaInicio),
                sp.texto(postData.fechaFin),
            ]
        );

        // En caso de rechazo el SP devuelve UN solo conjunto con status y
        // message, no los cuatro.
        const primero = result[0] || [];

        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        // Los agregados de UNA fila se entregan como objeto y no como arreglo
        // de un elemento, para que el cliente no tenga que hacer [0] sobre algo
        // que nunca va a tener más de un renglón.
        return {
            dashboard: {
                resumenAcuerdos: (result[0] && result[0][0]) ? JSON.parse(JSON.stringify(result[0][0])) : {},
                resumenInstrucciones: (result[1] && result[1][0]) ? JSON.parse(JSON.stringify(result[1][0])) : {},
                desglosePorDireccion: sp.filas(result[2]),
                movimientoPeriodo: (result[3] && result[3][0]) ? JSON.parse(JSON.stringify(result[3][0])) : {},
                tiemposPorTramo: sp.filas(result[4]),
                // Trae el NOMBRE y el COLOR del catálogo en cada fila, no
                // solo el id: así el nombre y el color se cambian en la base
                // y la pantalla los toma sin tocar código. Y viene por filas
                // en vez de por columnas fijas porque `scg_cat_avance` es un
                // catálogo y puede ganar una quinta.
                avancePorDireccion: sp.filas(result[5])
            }
        };
    } catch (ex) {
        winston.error(`consultarDashboard - Excepción: ${ex.message} | usuario=${idUsuario}`);
        throw ex;
    }
}

/**
 * SP_CONSULTAR_HISTORIAL_ACUERDO( _idAcuerdo, _idUsuarioConsulta )
 *
 * La bitácora completa de un acuerdo: quién hizo qué, cuándo, desde qué IP y con
 * qué transición de estatus.
 *
 * DOS COSAS QUE ESTE ENDPOINT SÍ DEVUELVE Y LOS DEMÁS NO:
 *   1. Acuerdos CANCELADOS y dados de baja. La lista y la agenda los excluyen;
 *      aquí no, y es deliberado: esto es auditoría, y un acuerdo cancelado es
 *      precisamente uno de los que hay que poder auditar.
 *   2. Un conjunto VACÍO cuando el acuerdo existe pero no tiene movimientos.
 *      Cero filas NO es un error: es un acuerdo sin historia todavía.
 */
async function consultarHistorial(postData, idUsuario) {
    try {
        const result = await db.query(
            'CALL SP_CONSULTAR_HISTORIAL_ACUERDO(?, ?)',
            [sp.entero(postData.idAcuerdo), idUsuario]
        );

        const primero = result[0] || [];

        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        return { historial: sp.filas(primero) };
    } catch (ex) {
        winston.error(`consultarHistorial - Excepción: ${ex.message} | acuerdo=${postData.idAcuerdo}`);
        throw ex;
    }
}

/* ────────────────────────────────────────────────────────────────
 * ADSCRIPCIONES — administración
 *
 * Los tres endpoints más sensibles del módulo, y conviene decir por qué:
 * `sadrh_tbl_enlace_operativo_acuerdo` es la única fuente desde la que los SPs
 * resuelven la unidad de quien ejecuta. Todo el aislamiento por unidad descansa
 * sobre su contenido, y estos son los únicos que la escriben. La puerta de cada
 * módulo está blindada; esta es la pared.
 *
 * PERMISOS: rol 1 (administrador) y nadie más, ni siquiera la DRH. Lo aplica el
 * SP.
 *
 * PENDIENTE CONOCIDO: ninguno de los dos SPs de escritura recibe `ipOrigen`, así
 * que la bitácora de adscripciones no registra desde dónde se hizo el cambio.
 * Conviene cerrarlo antes de que existan usuarios reales.
 * ──────────────────────────────────────────────────────────────── */

/**
 * SP_CONSULTAR_ADSCRIPCIONES( _idUnidadResponsable, _idUsuarioConsulta )
 *
 * DOS CONJUNTOS, y el orden importa:
 *   1. adscripciones  vigentes primero, luego el histórico (`activo = 0`)
 *   2. asignables     usuarios de rol SADRH con su `unidadActual`
 *
 * El segundo evita un rechazo previsible: asignar no admite a alguien que ya
 * tiene adscripción activa en otra unidad, y con `unidadActual` a la vista la
 * pantalla lo puede advertir antes de intentarlo.
 */
async function consultarAdscripciones(postData, idUsuario) {
    try {
        const result = await db.query(
            'CALL SP_CONSULTAR_ADSCRIPCIONES(?, ?)',
            [sp.entero(postData.idUnidadResponsable), idUsuario]
        );

        const primero = result[0] || [];

        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        return {
            adscripciones: sp.filas(result[0]),
            asignables: sp.filas(result[1])
        };
    } catch (ex) {
        winston.error(`consultarAdscripciones - Excepción: ${ex.message} | usuario=${idUsuario}`);
        throw ex;
    }
}

/**
 * SP_ASIGNAR_ENLACE_OPERATIVO( _idUnidadResponsable, _idUsuario, _tipoEnlace,
 *                              _esTitular, _idUsuarioRegistra, _ipOrigen )
 *
 * DOS CAMINOS, ambos exitosos y distinguibles por el mensaje:
 *   - no existía fila para ese par unidad/usuario -> "Adscripción asignada"
 *   - ya existía (activa o no)                    -> "Adscripción reactivada"
 * Nunca duplica: hay UNIQUE sobre (idUnidadResponsable, idUsuario).
 *
 * Y la regla que hace determinista todo el aislamiento: un usuario NO puede
 * tener dos adscripciones activas. Si ya está en otra unidad, el SP rechaza
 * nombrándola. Sin esa regla, el LIMIT 1 con que los SPs resuelven la unidad
 * elegiría una al azar.
 */
async function asignarAdscripcion(p, ejecutor, ipOrigen) {
    try {
        const result = await db.query(
            'CALL SP_ASIGNAR_ENLACE_OPERATIVO(?, ?, ?, ?, ?, ?)',
            [
                sp.entero(p.idUnidadResponsable),
                sp.entero(p.idUsuario),
                sp.texto(p.tipoEnlace),
                p.esTitular ? 1 : 0,
                ejecutor.idUsuario,
                sp.texto(ipOrigen)
            ]
        );

        const respuesta = sp.respuestaEscritura(result);

        if (Number(respuesta.status) !== 200 || /^Error/i.test(respuesta.message || '')) {
            winston.warn(`asignarAdscripcion - ${respuesta.status} | ${respuesta.message} | ejecuta=${ejecutor.idUsuario}`);
        }

        return respuesta;
    } catch (ex) {
        winston.error(`asignarAdscripcion - Excepción: ${ex.message} | ejecuta=${ejecutor.idUsuario}`);
        throw ex;
    }
}

/**
 * SP_DESACTIVAR_ENLACE_OPERATIVO( _idEnlace, _idUsuarioModifica, _ipOrigen )
 *
 * Baja lógica: la fila se conserva con `activo = 0`, así se puede reconstruir
 * por qué unidades pasó una persona.
 *
 * >>> EFECTO INMEDIATO SOBRE TODO EL MÓDULO <<<: al quedar sin unidad, ese
 * usuario pasa a fail-closed en los SPs acotados por unidad. No hay que cerrar
 * sesión ni esperar a que expire nada; la unidad se resuelve en cada llamada.
 *
 * Llamarlo dos veces responde "ya estaba desactivada" en 200 y NO escribe en la
 * bitácora: no falló, simplemente no cambió nada.
 */
async function desactivarAdscripcion(p, ejecutor, ipOrigen) {
    try {
        const result = await db.query(
            'CALL SP_DESACTIVAR_ENLACE_OPERATIVO(?, ?, ?)',
            [sp.entero(p.idEnlace), ejecutor.idUsuario, sp.texto(ipOrigen)]
        );

        const respuesta = sp.respuestaEscritura(result);

        if (Number(respuesta.status) !== 200 || /^Error/i.test(respuesta.message || '')) {
            winston.warn(`desactivarAdscripcion - ${respuesta.status} | ${respuesta.message} | ejecuta=${ejecutor.idUsuario}`);
        }

        return respuesta;
    } catch (ex) {
        winston.error(`desactivarAdscripcion - Excepción: ${ex.message} | enlace=${p.idEnlace}`);
        throw ex;
    }
}

/* ────────────────────────────────────────────────────────────────
 * MÓDULO 4 — Documentos
 *
 * SP_GESTIONAR_DOCUMENTO_ACUERDO( _accion, _idAcuerdo, _idDocumento,
 *   _idTipoDocumento, _firmaRequerida, _nombre, _ruta, _size, _antecedente,
 *   _nuevoEstatus, _motivoRechazo, _idUsuarioEjecuta, _usuarioEjecuta,
 *   _ipOrigen )
 *
 * EL SP SOLO GUARDA METADATOS. Recibe `nombre`, `ruta` y `size` ya calculados:
 * escribir el archivo en disco es trabajo del backend. Eso es exactamente lo
 * que faltaba en SADRH y lo que aquí se resuelve reusando la mecánica de
 * controlDeGestion (`utils.ensureDirectoryExistsSync` + `utils.writeFile`), la
 * misma con la que el sistema guarda los documentos de los asuntos.
 *
 * DÓNDE VIVEN LOS ARCHIVOS
 *   disco  ./src/documentos/AcuerdosDrh/Acuerdo-{idAcuerdo}/{nombre}
 *   BD     documentos/AcuerdosDrh/Acuerdo-{idAcuerdo}/{nombre}
 * La ruta que se guarda es RELATIVA a ./src, igual que la de los asuntos, para
 * que `verDocumento` la resuelva del mismo modo y mover la carpeta del proyecto
 * no invalide lo guardado.
 *
 * Se usa el idAcuerdo y no el folio —que es lo que usan los asuntos— porque el
 * folio de un acuerdo reabierto en modo NUEVO cambia, y el id no.
 * ──────────────────────────────────────────────────────────────── */

const CARPETA_BASE = 'documentos/AcuerdosDrh';

/**
 * Escribe el archivo en disco y devuelve sus metadatos.
 *
 * Si un archivo con el mismo nombre ya existe en la carpeta del acuerdo, se le
 * antepone una marca de tiempo en vez de sobrescribirlo: dos documentos
 * distintos pueden llamarse igual, y perder el primero en silencio sería peor
 * que tener dos nombres parecidos.
 */
async function guardarArchivo(idAcuerdo, documento) {
    const carpetaDisco = path.resolve(`./src/${CARPETA_BASE}/Acuerdo-${idAcuerdo}`);
    utils.ensureDirectoryExistsSync(carpetaDisco);

    let nombre = String(documento.fileName || 'documento').replace(/[\\/:*?"<>|]/g, '_');
    if (fs.existsSync(path.join(carpetaDisco, nombre))) {
        const ext = path.extname(nombre);
        nombre = `${path.basename(nombre, ext)}_${Date.now()}${ext}`;
    }

    const contenido = Buffer.from(documento.fileEncode64, 'base64');

    await utils.writeFile({
        fileName: path.join(carpetaDisco, nombre),
        base64: contenido
    });

    return {
        nombre: nombre,
        ruta: `${CARPETA_BASE}/Acuerdo-${idAcuerdo}/${nombre}`,
        size: contenido.length
    };
}

/** Ejecuta el SP del módulo 4 y devuelve su fila de respuesta. */
async function llamarDocumento(accion, parametros, ejecutor) {
    const result = await db.query(
        'CALL SP_GESTIONAR_DOCUMENTO_ACUERDO(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        parametros
    );

    const respuesta = sp.respuestaEscritura(result);

    if (Number(respuesta.status) !== 200 || /^Error/i.test(respuesta.message || '')) {
        winston.warn(`${accion} - ${respuesta.status} | ${respuesta.message} | usuario=${ejecutor.idUsuario}`);
    }

    return respuesta;
}

/**
 * REGISTRAR — adjuntar un documento. Queda PENDIENTE de revisión.
 *
 * El archivo se escribe ANTES del CALL porque el SP necesita su ruta y su
 * tamaño. Si el SP rechaza, el archivo se borra: dejarlo sería basura que nadie
 * podría alcanzar, porque la fila que lo referencia nunca existió.
 */
async function registrarDocumento(p, ejecutor, ipOrigen) {
    let guardado = null;
    try {
        if (!p.documento || !p.documento.fileEncode64) {
            return { status: 200, message: 'Error. Falta el archivo del documento.' };
        }

        guardado = await guardarArchivo(sp.entero(p.idAcuerdo), p.documento);

        const respuesta = await llamarDocumento('registrarDocumento', [
            'REGISTRAR',
            sp.entero(p.idAcuerdo),
            null,                       // _idDocumento
            sp.entero(p.idTipoDocumento),
            sp.texto(p.firmaRequerida),
            guardado.nombre,
            guardado.ruta,
            guardado.size,
            sp.texto(p.antecedente),
            null,                       // _nuevoEstatus
            null,                       // _motivoRechazo
            ejecutor.idUsuario,
            ejecutor.nombreCompleto,
            ipOrigen
        ], ejecutor);

        if (Number(respuesta.status) !== 200 || /^Error/i.test(respuesta.message || '')) {
            utils.unlinkFile(guardado.ruta);
        }

        return respuesta;
    } catch (ex) {
        if (guardado) utils.unlinkFile(guardado.ruta);
        winston.error(`registrarDocumento - Excepción: ${ex.message} | acuerdo=${p.idAcuerdo}`);
        throw ex;
    }
}

/**
 * REEMPLAZAR — reenviar corregido un documento RECHAZADO.
 *
 * Actualiza la MISMA fila y devuelve el acuerdo a "En revisión". El archivo
 * anterior NO se borra del disco: es la evidencia de lo que se rechazó, y la
 * fila ya solo apunta al nuevo.
 */
async function reemplazarDocumento(p, ejecutor, ipOrigen) {
    let guardado = null;
    try {
        if (!p.documento || !p.documento.fileEncode64) {
            return { status: 200, message: 'Error. Falta el archivo del documento.' };
        }

        guardado = await guardarArchivo(sp.entero(p.idAcuerdo), p.documento);

        const respuesta = await llamarDocumento('reemplazarDocumento', [
            'REEMPLAZAR',
            null,                       // _idAcuerdo: se deduce del documento
            sp.entero(p.idDocumento),
            sp.entero(p.idTipoDocumento),
            null,                       // _firmaRequerida
            guardado.nombre,
            guardado.ruta,
            guardado.size,
            sp.texto(p.antecedente),
            null, null,
            ejecutor.idUsuario,
            ejecutor.nombreCompleto,
            ipOrigen
        ], ejecutor);

        if (Number(respuesta.status) !== 200 || /^Error/i.test(respuesta.message || '')) {
            utils.unlinkFile(guardado.ruta);
        }

        return respuesta;
    } catch (ex) {
        if (guardado) utils.unlinkFile(guardado.ruta);
        winston.error(`reemplazarDocumento - Excepción: ${ex.message} | documento=${p.idDocumento}`);
        throw ex;
    }
}

/**
 * REVISAR — aprobar o rechazar. Rechazar exige motivo y dispara notificación.
 * Aprobar el último pendiente puede autorizar el acuerdo.
 */
async function revisarDocumento(p, ejecutor, ipOrigen) {
    try {
        return await llamarDocumento('revisarDocumento', [
            'REVISAR',
            null,
            sp.entero(p.idDocumento),
            null, null, null, null, null, null,
            sp.texto(p.nuevoEstatus),
            sp.texto(p.motivoRechazo),
            ejecutor.idUsuario,
            ejecutor.nombreCompleto,
            ipOrigen
        ], ejecutor);
    } catch (ex) {
        winston.error(`revisarDocumento - Excepción: ${ex.message} | documento=${p.idDocumento}`);
        throw ex;
    }
}

/**
 * ELIMINAR — retirar un documento (baja lógica).
 *
 * El archivo NO se borra del disco a propósito: la fila se conserva con
 * `activo = 0` y la bitácora deja constancia. Borrar el archivo dejaría un
 * registro de auditoría apuntando a la nada.
 */
async function eliminarDocumento(p, ejecutor, ipOrigen) {
    try {
        return await llamarDocumento('eliminarDocumento', [
            'ELIMINAR',
            null,
            sp.entero(p.idDocumento),
            null, null, null, null, null, null, null, null,
            ejecutor.idUsuario,
            ejecutor.nombreCompleto,
            ipOrigen
        ], ejecutor);
    } catch (ex) {
        winston.error(`eliminarDocumento - Excepción: ${ex.message} | documento=${p.idDocumento}`);
        throw ex;
    }
}

/**
 * SP_CONSULTAR_DOCUMENTOS_ACUERDO( _idAcuerdo, _idUsuarioConsulta )
 *
 * Creado el 27/08/2026: las cuatro acciones del módulo eran de escritura y no
 * había forma de VER los documentos de un acuerdo, así que REVISAR exigía un
 * idDocumento que nadie podía conocer.
 *
 * Dos conjuntos: el contexto del acuerdo con el conteo por estatus, y los
 * documentos activos.
 */
async function consultarDocumentos(postData, idUsuario) {
    try {
        const result = await db.query(
            'CALL SP_CONSULTAR_DOCUMENTOS_ACUERDO(?, ?)',
            [sp.entero(postData.idAcuerdo), idUsuario]
        );

        const primero = result[0] || [];

        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        return {
            acuerdo: (primero && primero[0]) ? JSON.parse(JSON.stringify(primero[0])) : null,
            documentos: sp.filas(result[1])
        };
    } catch (ex) {
        winston.error(`consultarDocumentos - Excepción: ${ex.message} | acuerdo=${postData.idAcuerdo}`);
        throw ex;
    }
}

/**
 * A quién se le avisa de lo que pasa con un acuerdo.
 *
 * Los SPs resuelven `correoDestino` como el correo de quien REGISTRÓ el
 * acuerdo, y eso se queda corto: si el Enlace lo registró y le rechazan un
 * documento, su Director nunca se entera. Aquí se agrega a la copia el resto
 * de la gente adscrita a esa dirección —Director y Enlace—, que es lo que
 * haría cualquier oficina.
 *
 * Devuelve `{ para, copia, folio, descripcionEjecutiva, tema }`. Si el acuerdo
 * no existe devuelve null; nunca lanza, porque solo alimenta un aviso.
 */
async function destinatariosDeAcuerdo(idAcuerdo) {
    try {
        const id = sp.entero(idAcuerdo);
        if (!id) return null;

        // Ojo: para un SELECT plano `db.query` devuelve las filas DIRECTAMENTE,
        // no envueltas en conjuntos como en un CALL. Leerlo con result[0][0]
        // devuelve siempre null.
        const datos = await db.query(`
            SELECT a.folio, a.descripcionEjecutiva, a.idUnidadResponsable,
                   t.tema, reg.correo AS correoRegistra
              FROM sadrh_tbl_acuerdo a
              LEFT JOIN scg_tbl_usuario reg ON reg.idUsuario = a.idUsuarioRegistra
              LEFT JOIN scg_cat_tema    t   ON t.idTema      = a.idTema
             WHERE a.idAcuerdo = ? AND a.activo = 1
             LIMIT 1`, [id]);

        const cab = datos && datos.length ? datos[0] : null;
        if (!cab) return null;

        // Director y Enlace vigentes de esa dirección.
        const gente = await db.query(`
            SELECT u.correo
              FROM sadrh_tbl_enlace_operativo_acuerdo e
              INNER JOIN scg_tbl_usuario u ON u.idUsuario = e.idUsuario
             WHERE e.idUnidadResponsable = ?
               AND e.activo = 1
               AND u.activo = 1
               AND u.idUsuarioRol IN (8, 9)`, [cab.idUnidadResponsable]);

        const dela = (gente || []).map((x) => x.correo).filter(Boolean);
        const para = cab.correoRegistra || dela[0] || null;

        return {
            para: para,
            copia: dela.filter((c) => c !== para),
            folio: cab.folio,
            tema: cab.tema,
            descripcionEjecutiva: cab.descripcionEjecutiva
        };
    } catch (ex) {
        winston.error(`destinatariosDeAcuerdo - Excepción: ${ex.message} | acuerdo=${idAcuerdo}`);
        return null;
    }
}

/**
 * A quién se le avisa, pero con `idUsuario` además del correo.
 *
 * El buzón necesita ids, no direcciones. Se resuelve aparte de
 * `destinatariosDeAcuerdo` porque aquel sirve al correo y este al buzón, y
 * mezclarlos obligaría a que uno cargara datos que no usa.
 *
 * Devuelve la lista COMPLETA de a quién avisar: quien registró el acuerdo más
 * el Director y el Enlace vigentes de su dirección, sin repetir. Cada uno
 * recibe su propia fila en el buzón, porque leer es cosa de cada quien.
 */
async function usuariosANotificar(idAcuerdo) {
    try {
        const id = sp.entero(idAcuerdo);
        if (!id) return [];

        const filas = await db.query(`
            SELECT DISTINCT u.idUsuario
              FROM sadrh_tbl_acuerdo a
              INNER JOIN scg_tbl_usuario u
                      ON u.idUsuario = a.idUsuarioRegistra
             WHERE a.idAcuerdo = ? AND a.activo = 1 AND u.activo = 1

            UNION

            SELECT DISTINCT u.idUsuario
              FROM sadrh_tbl_acuerdo a
              INNER JOIN sadrh_tbl_enlace_operativo_acuerdo e
                      ON e.idUnidadResponsable = a.idUnidadResponsable AND e.activo = 1
              INNER JOIN scg_tbl_usuario u
                      ON u.idUsuario = e.idUsuario AND u.activo = 1
             WHERE a.idAcuerdo = ? AND a.activo = 1
               AND u.idUsuarioRol IN (8, 9)`, [id, id]);

        return (filas || []).map((x) => x.idUsuario).filter(Boolean);
    } catch (ex) {
        winston.error(`usuariosANotificar - Excepción: ${ex.message} | acuerdo=${idAcuerdo}`);
        return [];
    }
}

/**
 * Deja un aviso en el buzón de alguien.
 *
 * Igual que el correo: nunca lanza. Un buzón que falla no puede tumbar la
 * operación que lo originó, que ya está guardada.
 */
async function registrarNotificacion(idUsuarioDestino, idAcuerdo, tipo, titulo, mensaje) {
    try {
        const result = await db.query(
            'CALL SP_REGISTRAR_NOTIFICACION(?, ?, ?, ?, ?)',
            [sp.entero(idUsuarioDestino), sp.entero(idAcuerdo),
             sp.texto(tipo), sp.texto(titulo), sp.texto(mensaje)]
        );
        const r = sp.respuestaEscritura(result);
        if (Number(r.status) !== 200 || /^Error/i.test(r.message || '')) {
            winston.warn(`registrarNotificacion - ${r.message} | destino=${idUsuarioDestino}`);
        }
        return r;
    } catch (ex) {
        winston.error(`registrarNotificacion - Excepción: ${ex.message} | destino=${idUsuarioDestino}`);
        return null;
    }
}

/** El buzón de quien pregunta. El SP no acepta buzón ajeno. */
async function consultarNotificaciones(postData, idUsuario) {
    try {
        const result = await db.query(
            'CALL SP_CONSULTAR_NOTIFICACIONES(?, ?)',
            [postData && postData.soloSinLeer ? 1 : 0, idUsuario]
        );

        const primero = result[0] || [];
        if (sp.esRechazoDeConsulta(primero)) {
            return { rechazo: JSON.parse(JSON.stringify(primero[0])) };
        }

        const conteo = (sp.filas(result[0]) || [])[0] || {};
        return {
            total: Number(conteo.total) || 0,
            sinLeer: Number(conteo.sinLeer) || 0,
            notificaciones: sp.filas(result[1])
        };
    } catch (ex) {
        winston.error(`consultarNotificaciones - Excepción: ${ex.message} | usuario=${idUsuario}`);
        throw ex;
    }
}

/** Marca una notificación como leída, o todas si no se manda id. */
async function marcarNotificacionLeida(postData, idUsuario) {
    try {
        const result = await db.query(
            'CALL SP_MARCAR_NOTIFICACION_LEIDA(?, ?)',
            [sp.entero(postData && postData.idNotificacion), idUsuario]
        );
        return sp.respuestaEscritura(result);
    } catch (ex) {
        winston.error(`marcarNotificacionLeida - Excepción: ${ex.message} | usuario=${idUsuario}`);
        throw ex;
    }
}

module.exports = {
    obtenerEjecutor,
    destinatariosDeAcuerdo,
    usuariosANotificar,
    registrarNotificacion,
    consultarNotificaciones,
    marcarNotificacionLeida,
    obtenerCatalogos,
    consultarAcuerdos,
    gestionarAcuerdo,
    gestionarCelebracion,
    consultarAgenda,
    registrarInstruccion,
    actualizarPlazoInstruccion,
    actualizarAvanceInstruccion,
    consultarInstrucciones,
    consultarDashboard,
    consultarHistorial,
    consultarAdscripciones,
    asignarAdscripcion,
    desactivarAdscripcion,
    registrarDocumento,
    reemplazarDocumento,
    revisarDocumento,
    eliminarDocumento,
    consultarDocumentos
};
