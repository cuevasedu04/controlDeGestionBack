const db = require("../config/database");
const utils = require("../api/utils/utils");
const path = require("path");
const email = require("../api/utils/email");
const winston = require("../config/winston");

function sanitizarFecha(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    if (typeof valor === 'string' && /^00\d{2}-/.test(valor)) {
        valor = '20' + valor.slice(2);
    }
    return valor;
}

async function registrarAsunto(postData) {
    let response = {};
    let resultFileBD3 = null;
    try {
        // Validación mínima antes de llamar al SP
        if (!postData.idUsuarioRegistra) {
            winston.warn(`registrarAsunto - Intento con idUsuarioRegistra nulo | noOficio: ${postData.noOficio}`);
            return { status: 400, message: 'Sesión de usuario no válida. Por favor recarga la página e intenta de nuevo.' };
        }

        // Sanitizar fechas — convierte '' a null y corrige año 00XX→20XX
        const fechaDocumento   = sanitizarFecha(postData.fechaDocumento);
        const fechaRecepcion   = sanitizarFecha(postData.fechaRecepcion);
        const fechaCumplimiento = sanitizarFecha(postData.fechaCumplimiento);

        const sql = `CALL SP_REGISTRAR_ASUNTO (
            ?,?,?,?,?,?,
            ?,?,?,?,?,?,
            ?,?,?,?,?,?,
            ?,?,?,?,?,?
        )`;

        const result = await db.query(sql, [
            postData.idTipoDocumento,
            postData.noOficio,
            postData.esVolante   ? 1 : 0,
            postData.numeroVolante  || null,
            postData.esGuia      ? 1 : 0,
            postData.numeroGuia  || null,
            fechaDocumento,
            fechaRecepcion,
            postData.remitenteNombre,
            postData.remitenteCargo,
            postData.remitenteDependencia,
            postData.dirigidoA,
            postData.dirigidoACargo,
            postData.dirigidoADependencia,
            postData.descripcionAsunto,
            postData.idTema,
            fechaCumplimiento,
            postData.idMedio,
            postData.idPrioridad,
            postData.idUsuarioRegistra,
            postData.usuarioRegistra,
            postData.idUnidadAdministrativa,
            postData.unidadAdministrativa,
            postData.observaciones || null
        ]);

        if (result[0]?.[0]?.status == 200) {

            response = { ...result[0][0] };
            response.model = result[1]?.[0] || {};
            response.docP = null;
            response.anexosResponse = [];

            const folio = response.model?.folio;
            const idAsunto = response.model?.idAsunto;

            if (folio) {
                const directorioAsunto = path.resolve(`./src/documentos/Asuntos/Asunto-${folio}`);
                utils.ensureDirectoryExistsSync(directorioAsunto);
                const directoryBd = `documentos/Asuntos/Asunto-${folio}`;

                // Procesar documento principal
                if (postData.documento) {
                    const sqlDocumentosAsunto = `CALL SP_REGISTRAR_DOCUMENTO_ASUNTO(?,?,?,?,?,?)`;
                    const finalFileDocPrincipal = {
                        fileName: `${directorioAsunto}/${postData.documento.fileName}`,
                        fileNameBd: `${directoryBd}/${postData.documento.fileName}`,
                        base64: Buffer.from(postData.documento.fileEncode64, 'base64')
                    };

                    const responseDP = await utils.writeFile(finalFileDocPrincipal);
                    if (responseDP.status === 200) {
                        resultFileBD3 = await db.query(sqlDocumentosAsunto, [
                            idAsunto,
                            postData.documento.tipoDocumento,
                            postData.documento.fileName,
                            finalFileDocPrincipal.fileNameBd,
                            postData.documento.size,
                            postData.idUsuarioRegistra
                        ]);
                        response.docP = resultFileBD3;
                    } else {
                        console.warn("No se pudo escribir el documento principal.");
                    }
                } else {
                    console.warn("Falta documento principal.");
                }

                // Procesar anexos
                if (Array.isArray(postData.anexos) && postData.anexos.length > 0) {
                    const directorioAnexos = path.resolve(`${directorioAsunto}/Anexos`);
                    utils.ensureDirectoryExistsSync(directorioAnexos);
                    const directoryBdAnexos = `${directoryBd}/Anexos`;

                    const anexosResult = await almacenaListaArchivos(
                        postData.anexos,
                        directorioAnexos,
                        directoryBdAnexos,
                        postData.idUsuarioRegistra,
                        idAsunto
                    );

                    response.anexosResponse = anexosResult;
                }

				/* aqui evaluamos si postData.autoturnar = 1 entonces llamamos a la funcion de turnar el asunto con el la lista de un elemento de turnado conforme los parametrois que pide 				 
				turnar asunto esta aquí en este mismo archivo 
				*/
				/* if(postData.autoturnar == 1 ){
					const turnado = {
						idAsunto: idAsunto,
						idUnidadResponsable: postData.id ,
						idInstruccion: ,
						idUsuarioAsigna: ,
						idTurnadoPadre: null
					}
					postData.listaTurnados = [turnado]
				} */
            }
        } else {
            const spStatus  = result[0]?.[0]?.status;
            const spMessage = result[0]?.[0]?.message;
            winston.warn(`registrarAsunto - SP retornó error: status=${spStatus} | message=${spMessage} | noOficio=${postData.noOficio} | idUsuarioRegistra=${postData.idUsuarioRegistra}`);
            response = { status: spStatus, message: spMessage };
        }

        return response;
    } catch (ex) {
        winston.error(`registrarAsunto - Excepción JS: ${ex.message || ex} | noOficio=${postData.noOficio} | idUsuarioRegistra=${postData.idUsuarioRegistra} | stack=${ex.stack || ''}`);
        return {
            status: -1,
            message: "Ocurrió un error interno, contactar a soporte técnico.",
            error: { level: "error", timestamp: new Date().toISOString() }
        };
    }
}




async function consultarAsuntosUR(postData) {
    let response = {};
    try {

        let sql = `CALL SP_CONSULTAR_ASUNTOS_REGISTRADOS_UR (
            ?,?
        )`;

        let result = await db.query(sql, [postData.idUnidadAdministrativa || 0, postData.soloRegistrados ?? 1]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function consultarDetalleAsunto(postData) {
    let response = {};
    try {

        let sql = `CALL SP_CONSULTAR_DETALLE_ASUNTO (
            ?
        )`;

        let result = await db.query(sql, [postData.idAsunto]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function consultarExpedienteAsunto(postData) {
    let response = {};
    try {

        let sql = `CALL SP_CONSULTAR_EXPEDIENTE_ASUNTO (
            ?
        )`;

        let result = await db.query(sql, [postData.idAsunto]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
            response.model = {
                documentos: JSON.parse(JSON.stringify(result[1])),

                /* documento: JSON.parse(JSON.stringify(result[1][0])), */
                anexos: JSON.parse(JSON.stringify(result[2])),
                respuestas: JSON.parse(JSON.stringify(result[3])),
                mensajes: JSON.parse(JSON.stringify(result[4]))
            }
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function consultarTurnados(postData) {
    let response = {};
    try {

        let sql = `CALL SP_CONSULTAR_TURNADOS (
            ?
        )`;

        let result = await db.query(sql, [postData.idAsunto]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}
// Devuelve el conjunto de idTurnado (entre idAsuntos dados) que pertenecen a idUnidadResponsable.
// Se usa para filtrar, al descargar el expediente en zip, las subcarpetas "Turnado-{idTurnado}"
// que no correspondan al área del usuario que descarga.
async function obtenerIdTurnadosPermitidos(idAsuntos, idUnidadResponsable) {
    if (!Array.isArray(idAsuntos) || idAsuntos.length === 0 || !idUnidadResponsable) {
        return [];
    }
    const sql = `SELECT idTurnado FROM scg_tbl_turnado WHERE idAsunto IN (?) AND idUnidadResponsable = ? AND activo = 1`;
    const result = await db.query(sql, [idAsuntos, idUnidadResponsable]);
    return result.map((r) => r.idTurnado);
}

async function consultarHistorial(postData) {
    let response = {};
    try {

        let sql = `CALL SP_OBTENER_HISTORIAL_COMPLETO_TURNADOS (
            ?
        )`;

        let result = await db.query(sql, [postData.idAsunto]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
                response.model = {
                    asuntoRegistrado: JSON.parse(JSON.stringify(result[1][0])),
                    turnados: result[2].map(turnado => ({
                        ...turnado,
                        fases: JSON.parse(turnado.fases)// <-- Aquí haces la conversión
                    }))
                };
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function turnarAsunto(postData) {
    let response = {};
    try {
        const sql = `CALL SP_TURNAR_ASUNTO (
            ?,?,?,?,?,?
        )`;

        const listaTurnados = Array.isArray(postData.listaTurnados)
            ? postData.listaTurnados
            : [postData];

        for (const element of listaTurnados) {
            if (element.idTurnado) {
                continue;
            }
            const result = await db.query(sql, [
                element.idAsunto,
                element.idUnidadResponsable,
                element.idInstruccion,
                element.idUsuarioAsigna,
                element.idTurnadoPadre || null,
                element.mensajeTurnado || element.mensaje || null
            ]);

            // Validar respuesta del procedimiento almacenado
            if (result[0]?.[0]?.status == 200) {
                response = { ...result[0][0] };

                const { correos, folio, noOficio, responsables, tema, prioridad, descripcion } = result[0][0];
                if (correos) {
                    email.enviarNotificacionTurnado({ correos, folio, noOficio, responsables, tema, prioridad, descripcion });
                }
            } else {
                response = { status: 500, message: 'Error en la ejecución del procedimiento almacenado.' };
                return;
            }
        }
        return response;
    } catch (ex) {
        console.error("Error en turnarAsunto:", ex);
        return {
            status: -1,
            message: "Ocurrió un error interno, contactar a soporte técnico.",
            error: {
                level: "error",
                timestamp: new Date().toISOString()
            }
        };
    }
}
async function reemplazarDocumento(postData) {
    let response = {};
    try {
        const sql = `CALL SP_REEMPLAZAR_DOCUMENTO_ASUNTO (?, ?, ?, ?, ?, ?, ?)`;

        const directorioAsunto = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.folio}`);
        utils.ensureDirectoryExistsSync(directorioAsunto);
        const directoryBd = `documentos/Asuntos/Asunto-${postData.folio}`;

        // Validar que venga el documento
        if (!postData.documento) {
            console.warn("Falta documento principal.");
            return {
                status: 400,
                message: "No se proporcionó el documento principal a reemplazar."
            };
        }

        const finalFileDocPrincipal = {
            fileName: `${directorioAsunto}/${postData.documento.fileName}`,
            fileNameBd: `${directoryBd}/${postData.documento.fileName}`,
            base64: Buffer.from(postData.documento.fileEncode64, 'base64')
        };

        // Guardar el archivo
        const responseDP = await utils.writeFile(finalFileDocPrincipal);

        if (responseDP.status !== 200) {
            console.warn("No se pudo guardar el nuevo documento.");
            return {
                status: 500,
                message: "Error al guardar el nuevo documento en el servidor."
            };
        }

        // Llamar al procedimiento almacenado
        const resultFileBD3 = await db.query(sql, [
            postData.idAsunto,
            postData.documento.tipoDocumento,
            postData.documento.fileName,
            finalFileDocPrincipal.fileNameBd,
            postData.documento.size,
            postData.idUsuarioRegistra,
            postData.idDocumentoReemplazo,


        ]);

        if (Array.isArray(resultFileBD3) && resultFileBD3[0]?.[0]) {
            response = resultFileBD3[0][0];
            if (response.status == 200 && postData.urlReemplazo) {
                if (postData.urlReemplazo !== finalFileDocPrincipal.fileNameBd) {
                    await utils.unlinkFile(postData.urlReemplazo);
                }
            }
        } else {
            console.warn("Respuesta inesperada del procedimiento almacenado.");
            response = {
                status: -1,
                message: "No se pudo obtener una respuesta válida del SP."
            };
        }

        return response;
    } catch (ex) {
        console.error("Error al Reemplazar documento:", ex);
        return {
            status: -1,
            message: "Ocurrió un error interno, contactar a soporte técnico.",
            error: {
                level: "error",
                timestamp: new Date().toISOString()
            }
        };
    }
}
async function eliminarDocumento(postData) {
    let response = {};
    try {
        const sql = `CALL SP_ELIMINAR_DOCUMENTO_ASUNTO (?,?)`;


        // Llamar al procedimiento almacenado
        const resultDeleteBD = await db.query(sql, [
            postData.idDocumentAsunto,
            postData.idUsuarioModifica
        ]);
        const resultInfo = resultDeleteBD?.[0]?.[0]; // Primer result set: status y message
        const resultRuta = resultDeleteBD?.[1]?.[0]; // Segundo result set: model

        if (Array.isArray(resultDeleteBD) && resultDeleteBD[0]?.[0]) {
            response.status = resultInfo.status;
            response.message = resultInfo.message;
            response.model = resultRuta?.model || null;

            if (response.status == 200 && response.model && response.model !== "/") {
                try {
                    await utils.unlinkFile(response.model);
                } catch (unlinkErr) {
                    console.warn("No se pudo eliminar el archivo:", unlinkErr);
                }
            }
        } else {
            console.warn("Respuesta inesperada del procedimiento almacenado.");
            response = {
                status: -1,
                message: "No se pudo obtener una respuesta válida del SP."
            };
        }
        return response;
    } catch (ex) {
        console.error("Error al eliminar el documento:", ex);
        return {
            status: -1,
            message: "Ocurrió un error interno, contactar a soporte técnico.",
            error: {
                level: "error",
                timestamp: new Date().toISOString()
            }
        };
    }
}
async function agregarAnexos(postData) {
    let response = {};
    try {
        const directorioAnexos = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.folio}/Anexos`);
        utils.ensureDirectoryExistsSync(directorioAnexos);
        const directoryBdAnexos = `documentos/Asuntos/Asunto-${postData.folio}/Anexos`;

        if (Array.isArray(postData.anexos) && postData.anexos.length > 0) {
            const anexosResult = await almacenaListaArchivos(
                postData.anexos,
                directorioAnexos,
                directoryBdAnexos,
                postData.idUsuarioRegistra,
                postData.idAsunto
            );
            response = anexosResult[0];
        } else {
            response = [];
        }

        return response;
    } catch (ex) {
        console.error("Error al agregar los documentos:", ex);
        return {
            status: -1,
            message: "Ocurrió un error interno, contactar a soporte técnico.",
            error: {
                level: "error",
                timestamp: new Date().toISOString()
            }
        };
    }
}
async function agregarAntecedentes(postData) {
    let response = {};
    try {
        const directorioAntecedentes = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.folio}/Antecedentes`);
        utils.ensureDirectoryExistsSync(directorioAntecedentes);
        const directoryBdAntecedentes = `documentos/Asuntos/Asunto-${postData.folio}/Antecedentes`;

        if (Array.isArray(postData.antecedentes) && postData.antecedentes.length > 0) {
            const antecedentesResult = await almacenaListaArchivos(
                postData.antecedentes,
                directorioAntecedentes,
                directoryBdAntecedentes,
                postData.idUsuarioRegistra,
                postData.idAsunto
            );
            response = antecedentesResult[0];
        } else {
            response = [];
        }

        return response;
    } catch (ex) {
        console.error("Error al agregar los antecedentes:", ex);
        return {
            status: -1,
            message: "Ocurrió un error interno, contactar a soporte técnico."
        };
    }
}
async function concluirAsunto(postData) {
    let response = {};
    const archivosGuardados = [];
	let documentosResult = [];

    try {
        // 1. Validar documentos solo si noRequiereDocumento NO es true
        if (postData.requiereDocumento) {
            if (!Array.isArray(postData.documentos) || postData.documentos.length === 0) {
                return {
                    status: 404,
                    message: "Faltan documentos para concluir el asunto."
                };
            }

            // 2. Guardar documentos
            const directorioConclusion = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.folio}/Conclusion`);
            utils.ensureDirectoryExistsSync(directorioConclusion);
            const directoryBdConclusion = `documentos/Asuntos/Asunto-${postData.folio}/Conclusion`;

            const documentosResult = await almacenaListaArchivos(
                postData.documentos,
                directorioConclusion,
                directoryBdConclusion,
                postData.idUsuarioRegistra,
                postData.idAsunto
            );

            // Verificar guardado
            for (const doc of documentosResult) {
                if (doc.error) {
                    throw new Error(`Error al guardar documento: ${doc.mensaje || 'Sin mensaje detallado'}`);
                }
                archivosGuardados.push(doc.rutaCompleta); // guardamos la ruta por si hay que borrarlos
            }
        }

        // 3. Ejecutar SP para concluir
        const sql = `CALL SP_CONCLUIR_ASUNTO (?, ?)`;
        const result = await db.query(sql, [
            postData.idAsunto,
            postData.idUsuarioRegistra
        ]);
        const spResponse = JSON.parse(JSON.stringify(result[0][0]));

        // 4. Si SP falla → rollback: eliminar los documentos guardados
        if (spResponse.status !== 200) {
            for (const ruta of archivosGuardados) {
                try { fs.unlinkSync(ruta); } catch (e) { /* ignoramos si falla el borrado */ }
            }
            return spResponse;
        }

        // 5. OK → respondemos éxito + documentos si se guardaron
        response = {
            status: 200,
            message: "Asunto concluido correctamente",
            model: {
                ...spResponse,
                documentos: postData.noRequiereDocumento ? [] : documentosResult
            }
        };

        return response;

    } catch (ex) {
        // rollback si ya había guardado algo
        for (const ruta of archivosGuardados) {
            try { fs.unlinkSync(ruta); } catch (e) { }
        }
        return {
            status: 500,
            message: `Error interno: ${ex.message}`
        };
    }
}

async function editarAsunto(postData) {
    let response = {};
    try {

        let sql = `CALL SP_EDITAR_ASUNTO (        
        ?,?,?,?,?,
        ?,?,?,?,?,
        ?,?,?,?,?
        )`;
        const result = await db.query(sql, [
            postData.idAsunto,
            postData.idTipoDocumento,
            postData.idTema,
            postData.noOficio,
            postData.idMedio,
            postData.observaciones,
            postData.descripcionAsunto,
            postData.idUsuarioModifica,
            postData.fechaCumplimiento,
            postData.fechaDocumento,
            postData.remitenteNombre,
            postData.remitenteCargo,
            postData.remitenteDependencia,
            postData.dirigidoA,
            postData.dirigidoACargo
        ]);
        response = JSON.parse(JSON.stringify(result[0][0]));
        return response;

    } catch (ex) {
        throw ex;
    }
}

/**
 * Edicion completa de la informacion general de un asunto.
 *
 * Hermana de editarAsunto, no su reemplazo: el SP viejo se queda intacto.
 * Este llama a SP_EDITAR_ASUNTO_COMPLETO, que ademas de guardar
 * dirigidoADependencia -que el viejo perdia- deja rastro en la bitacora.
 *
 * Quien puede editar lo decide el SP, no este DAO: hoy los roles 1 y 2.
 */
async function editarAsuntoCompleto(postData) {
    let response = {};
    try {
        if (!postData.idUsuarioModifica) {
            winston.warn(`editarAsuntoCompleto - Intento con idUsuarioModifica nulo | asunto: ${postData.idAsunto}`);
            return { status: 400, message: 'Sesion de usuario no valida. Por favor recarga la pagina e intenta de nuevo.' };
        }

        let sql = `CALL SP_EDITAR_ASUNTO_COMPLETO (
            ?,?,?,?,?,
            ?,?,?,?,?,
            ?,?,?,?,?,
            ?,?,?,?,?,
            ?,?,?
        )`;

        let result = await db.query(sql, [
            postData.idAsunto,
            postData.idTipoDocumento,
            postData.noOficio,
            postData.esVolante,
            postData.numeroVolante,
            postData.esGuia,
            postData.numeroGuia,
            sanitizarFecha(postData.fechaDocumento),
            sanitizarFecha(postData.fechaRecepcion),
            postData.remitenteNombre,
            postData.remitenteCargo,
            postData.remitenteDependencia,
            postData.dirigidoA,
            postData.dirigidoACargo,
            postData.dirigidoADependencia,
            postData.descripcionAsunto,
            postData.idTema,
            sanitizarFecha(postData.fechaCumplimiento),
            postData.idMedio,
            postData.idPrioridad,
            postData.observaciones,
            postData.idUsuarioModifica,
            postData.ipOrigen
        ]);

        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        } else {
            winston.warn(`editarAsuntoCompleto - ${response.status} | ${response.message} | asunto=${postData.idAsunto} | usuario=${postData.idUsuarioModifica}`);
        }
        return response;
    } catch (ex) {
        winston.error(`editarAsuntoCompleto - Excepcion: ${ex.message} | asunto=${postData.idAsunto}`);
        throw ex;
    }
}

async function cancelarAsunto(postData) {
    let response = {};
    try {

        const sql = `CALL SP_CANCELAR_ASUNTO (?, ?)`;
        const result = await db.query(sql, [
            postData.idAsunto,
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







/**
 * Comentario de revisión de un documento del expediente (principal o anexo).
 *
 * Es UN comentario por documento y se sobrescribe al editarlo. Mandar el
 * texto vacío lo borra. Quién puede escribirlo lo decide el SP —hoy solo el
 * rol 2, Gestor—, no este DAO: así la regla vive en un solo lugar.
 */
async function guardarComentarioDocumento(postData) {
    let response = {};
    try {
        if (!postData.idUsuario) {
            winston.warn(`guardarComentarioDocumento - Intento con idUsuario nulo | documento: ${postData.idDocumentoAsunto}`);
            return { status: 400, message: 'Sesión de usuario no válida. Por favor recarga la página e intenta de nuevo.' };
        }

        let sql = `CALL SP_GUARDAR_COMENTARIO_DOCUMENTO (
            ?, ?, ?
        )`;

        let result = await db.query(sql, [
            postData.idDocumentoAsunto,
            postData.comentarioRevision,
            postData.idUsuario
        ]);

        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        } else {
            winston.warn(`guardarComentarioDocumento - ${response.status} | ${response.message} | documento=${postData.idDocumentoAsunto} | usuario=${postData.idUsuario}`);
        }
        return response;
    } catch (ex) {
        winston.error(`guardarComentarioDocumento - Excepción: ${ex.message} | documento=${postData.idDocumentoAsunto}`);
        throw ex;
    }
}

/**
 * Los comentarios de TODOS los documentos de un asunto, de una sola llamada.
 * El front los cruza contra el expediente por idDocumentoAsunto.
 *
 * Va aparte de consultarExpedienteAsunto a propósito: así no se tocó
 * SP_CONSULTAR_EXPEDIENTE_ASUNTO, que ya funciona.
 */
async function consultarComentariosDocumentos(postData) {
    let response = {};
    try {

        let sql = `CALL SP_CONSULTAR_COMENTARIOS_DOCUMENTOS (
            ?
        )`;

        let result = await db.query(sql, [postData.idAsunto]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

/**
 * Buscador de asuntos para el modal del alcance: oficio, descripcion,
 * volante o folio.
 *
 * Busca en el servidor y no en el navegador porque la tabla ronda los 6,700
 * asuntos y el modal no necesita traerlos todos.
 */
async function buscarAsuntos(postData) {
    let response = {};
    try {

        let sql = `CALL SP_BUSCAR_ASUNTOS (
            ?, ?, ?
        )`;

        let result = await db.query(sql, [
            postData.termino,
            postData.idExcluir || null,
            postData.limite || 50
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

/**
 * Alcance entre asuntos, en un solo procedimiento con parametro de accion
 * —el patron que ya usa SADRH con SP_GESTIONAR_ACUERDO—.
 *
 *   CONSULTAR    devuelve las dos direcciones: de donde viene y que lo continua
 *   VINCULAR     enlaza este asunto con su origen
 *   DESVINCULAR  quita el enlace
 *
 * Quien puede escribir lo decide el SP, no este DAO: hoy los roles 1 y 2.
 */
async function gestionarAlcance(postData) {
    let response = {};
    try {
        const accion = String(postData.accion || '').toUpperCase();

        if (accion !== 'CONSULTAR' && !postData.idUsuario) {
            winston.warn(`gestionarAlcance ${accion} - Intento con idUsuario nulo | asunto: ${postData.idAsunto}`);
            return { status: 400, message: 'Sesion de usuario no valida. Por favor recarga la pagina e intenta de nuevo.' };
        }

        let sql = `CALL SP_GESTIONAR_ALCANCE (
            ?, ?, ?, ?, ?
        )`;

        let result = await db.query(sql, [
            accion,
            postData.idAsunto,
            postData.idAsuntoOrigen || null,
            postData.idUsuario,
            postData.ipOrigen
        ]);

        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200 && accion === 'CONSULTAR') {
            // El SP responde las dos direcciones por separado para que la
            // pantalla no tenga que deducir cual es cual.
            response.model = {
                origen: JSON.parse(JSON.stringify(result[1]))[0] || null,
                alcances: JSON.parse(JSON.stringify(result[2]))
            };
        } else if (response.status != 200) {
            winston.warn(`gestionarAlcance ${accion} - ${response.status} | ${response.message} | asunto=${postData.idAsunto}`);
        }
        return response;
    } catch (ex) {
        winston.error(`gestionarAlcance - Excepcion: ${ex.message} | asunto=${postData.idAsunto}`);
        throw ex;
    }
}

module.exports = {
    registrarAsunto,
    consultarAsuntosUR,
    consultarDetalleAsunto,
    consultarExpedienteAsunto,
    consultarTurnados,
    turnarAsunto,
    reemplazarDocumento,
    agregarAnexos,
    eliminarDocumento,
    concluirAsunto,
    editarAsunto,
    cancelarAsunto,
    consultarHistorial,
    obtenerIdTurnadosPermitidos,
    agregarAntecedentes,
    guardarComentarioDocumento,
    consultarComentariosDocumentos,
    editarAsuntoCompleto,
    buscarAsuntos,
    gestionarAlcance

}
async function almacenaListaArchivos(list, directorioAnexos, directoryBd, idUsuarioRegistra, idAsunto) {
    const resultAnexosBD = [];

    if (Array.isArray(list) && list.length > 0) {
        const sqlDocumentos = `CALL SP_REGISTRAR_DOCUMENTO_ASUNTO(?, ?, ?, ?, ?, ?)`;

        for (const element of list) {
            const finalFile = {
                fileName: `${directorioAnexos}/${element.fileName}`,
                fileNameBd: `${directoryBd}/${element.fileName}`,
                base64: Buffer.from(element.fileEncode64, 'base64')
            };

            try {
                const responseItem = await utils.writeFile(finalFile);
                if (responseItem.status === 200) {
                    const result = await db.query(sqlDocumentos, [
                        idAsunto,
                        element.tipoDocumento,
                        element.fileName,
                        finalFile.fileNameBd,
                        element.size,
                        idUsuarioRegistra
                    ]);
                    resultAnexosBD.push(result[0][0]);
                } else {
                    console.warn(`No se pudo escribir el archivo: ${element.fileName}`);
                    resultAnexosBD.push({
                        status: 500,
                        file: element.fileName,
                        message: "Error al escribir el archivo"
                    });
                }
            } catch (err) {
                console.error(`Error procesando archivo ${element.fileName}:`, err);
                resultAnexosBD.push({
                    status: 500,
                    file: element.fileName,
                    message: "Error interno al procesar el archivo"
                });
            }
        }
    }

    return resultAnexosBD;
}