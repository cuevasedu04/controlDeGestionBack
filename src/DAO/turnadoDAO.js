const db = require("../config/database");
const utils = require("../api/utils/utils");
const path = require("path");



async function consultarTurnadosUR(postData) {
    let response = {};
    try {

        let sql = `CALL SP_CONSULTAR_TURNADOS_UR (
            ?, ?, ?
        )`;

        let result = await db.query(sql, [
            postData.idUnidadAdministrativa || 0,
            postData.idUsuario || 0,
            postData.idUsuarioRol || 0
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
async function consultarDetalleTurnado(postData) {
    let response = {};
    try {

        let sql = `CALL SP_CONSULTAR_DETALLE_TURNADO (
            ?
        )`;

        let result = await db.query(sql, [postData.idTurnado || 0]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function rechazarTurnado(postData) {
    let response = {};
    try {

        let sql = `CALL SP_RECHAZAR_TURNADO (
            ?,?,?
        )`;

        let result = await db.query(sql, [
            postData.idTurnado,
            postData.idUsuarioModifica,
            postData.motivoRechazo
        ]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        return response;
    } catch (ex) {
        throw ex;
    }
}

async function verTurnado(postData) {
    let response = {};
    try {

        let sql = `CALL SP_VER_TURNADO (
            ?,?
        )`;

        let result = await db.query(sql, [
            postData.idTurnado,
            postData.idUsuarioModifica,
        ]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        return response;
    } catch (ex) {
        throw ex;
    }
}
async function contestarTurnado(postData) {
    let response = {};
    try {
        const directorioTurnados = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.folio}/Turnado-${postData.idTurnado}`);
        utils.ensureDirectoryExistsSync(directorioTurnados);
        const directoryBdTurnados = `documentos/Asuntos/Asunto-${postData.folio}/Turnado-${postData.idTurnado}`;

        // Verificar si el usuario es atendedor
        if (!postData.requiereDocumento) {
            // Si es atendedor, omitir el registro de documentos y solo ejecutar contestarTurnado
            let sql = `CALL SP_CONTESTAR_TURNADO (?, ?, ?)`;
            const result = await db.query(sql, [
                postData.idTurnado,
                postData.idUsuario,
                postData.respuesta,
            ]);

            response = JSON.parse(JSON.stringify(result[0][0]));
        } else {
            // Si no es atendedor, proceder con el registro de documentos
            if (Array.isArray(postData.documentos) && postData.documentos.length > 0) {
                const documentosResult = await almacenaListaArchivos(
                    postData.documentos,
                    directorioTurnados,
                    directoryBdTurnados,
                    postData.idUsuario,
                    postData.idTurnado
                );

                // Si hubo error en el guardado, lo lanzamos y no se ejecuta el SP
                const resultadoDocumento = documentosResult[0];
                if (resultadoDocumento.error) {
                    throw new Error(`Error al guardar documentos: ${resultadoDocumento.mensaje || 'Sin mensaje detallado'}`);
                }

                response = resultadoDocumento;

                // 2. Ejecutar SP solo si los documentos fueron exitosamente guardados (o si no había documentos)
                let sql = `CALL SP_CONTESTAR_TURNADO (?, ?, ?)`;
                const result = await db.query(sql, [
                    postData.idTurnado,
                    postData.idUsuario,
                    postData.respuesta,
                ]);

                response = JSON.parse(JSON.stringify(result[0][0]));
            } else {
                response = {
                    status: 404,
                    message: "Faltan documentos para responder el turnado."
                };
            }
        }


        return response;

    } catch (ex) {
        throw ex;
    }
}


async function asignarComisionado(postData) {
    let response = {};
    try {

        let sql = `CALL SP_ASIGNAR_COMISIONADO (
            ?,?,?
        )`;

        let result = await db.query(sql, [
            postData.idTurnado,
            postData.idUsuarioResponsable,
            postData.idUsuarioComisionado
        ]);
        response = JSON.parse(JSON.stringify(result[0][0]));

        return response;
    } catch (ex) {
        throw ex;
    }
}

async function obtenerComisionados(postData) {
    let response = {};
    try {
        let sql = `CALL SP_OBTENER_COMISIONADOS (
            ?
        )`;
        let result = await db.query(sql, [
            postData.idUsuarioResponsable || postData.idUsuario
        ]);
        
        response = {
            status: 200,
            message: 'OK',
            model: JSON.parse(JSON.stringify(result[0]))
        };
        return response;
    } catch (ex) {
        throw ex;
    }
}

module.exports = {
    obtenerComisionados,
    asignarComisionado,
    consultarTurnadosUR,
    rechazarTurnado,
    contestarTurnado,
    consultarDetalleTurnado,
    verTurnado
}

async function almacenaListaArchivos(list, directorioTurnados, directoryBd, idUsuarioRegistra, idTurnado) {
    const resultAnexosBD = [];

    if (Array.isArray(list) && list.length > 0) {
        const sqlDocumentos = `CALL SP_REGISTRAR_DOCUMENTO_TURNADO(?, ?, ?, ?, ?, ?)`;

        for (const element of list) {
            const finalFile = {
                fileName: `${directorioTurnados}/${element.fileName}`,
                fileNameBd: `${directoryBd}/${element.fileName}`,
                base64: Buffer.from(element.fileEncode64, 'base64')
            };

            try {
                const responseItem = await utils.writeFile(finalFile);
                if (responseItem.status === 200) {
                    const result = await db.query(sqlDocumentos, [
                        idTurnado,
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