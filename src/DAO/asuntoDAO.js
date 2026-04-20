const db = require("../config/database");
const utils = require("../api/utils/utils");
const path = require("path");
const email = require("../api/utils/email");

async function registrarAsunto(postData) {
    let response = {};
    let resultFileBD3 = null; // Asegurada declaración anticipada
    try {
        const sql = `CALL SP_REGISTRAR_ASUNTO (
            ?,?,?,?,?,?,
            ?,?,?,?,?,?,
            ?,?,?,?,?,?,
            ?,?,?,?,?,?
        )`;

        const result = await db.query(sql, [
            postData.idTipoDocumento,
            postData.noOficio,
            postData.esVolante,
            postData.numeroVolante,
            postData.esGuia,
            postData.numeroGuia,
            postData.fechaDocumento,
            postData.fechaRecepcion,
            postData.remitenteNombre,
            postData.remitenteCargo,
            postData.remitenteDependencia,
            postData.dirigidoA,
            postData.dirigidoACargo,
            postData.dirigidoADependencia,
            postData.descripcionAsunto,
            postData.idTema,
            postData.fechaCumplimiento,
            postData.idMedio,
            postData.idPrioridad,
            postData.idUsuarioRegistra,
            postData.usuarioRegistra,
            postData.idUnidadAdministrativa,
            postData.unidadAdministrativa,
            postData.observaciones
        ]);

        // Validar respuesta del procedimiento almacenado
        console.log(result);
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
            response = { status: result[0]?.[0]?.status, message: result[0]?.[0]?.message };
        }

        return response;
    } catch (ex) {
        console.error("Error en registrarAsunto:", ex);
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




async function consultarAsuntosUR(postData) {
    let response = {};
    try {

        let sql = `CALL SP_CONSULTAR_ASUNTOS_REGISTRADOS_UR (
            ?
        )`;

        let result = await db.query(sql, [postData.idUnidadAdministrativa || 0]);
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
    consultarHistorial

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