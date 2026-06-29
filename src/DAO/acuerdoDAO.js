const db = require("../config/database");
const winston = require("../config/winston");

async function registrarAcuerdo(postData) {
    try {
        if (!postData.idUsuarioRegistra) {
            winston.warn(`registrarAcuerdo - idUsuarioRegistra nulo | idUnidadResponsable: ${postData.idUnidadResponsable}`);
            return { status: 400, message: 'Sesión de usuario no válida. Por favor recarga la página e intenta de nuevo.' };
        }
        const sql = `CALL SP_REGISTRAR_ACUERDO(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const result = await db.query(sql, [
            postData.idUnidadResponsable  || null,
            postData.fecha                || null,
            postData.hora                 || null,
            postData.iniciales            || null,
            postData.idTema               || null,
            postData.descripcionEjecutiva || null,
            postData.acuerdo              || null,
            postData.idPrioridad          || null,
            postData.acuerdoTUAF ? 1 : 0,
            postData.seguimiento          || null,
            postData.idUsuarioRegistra,
            postData.usuarioRegistra      || null
        ]);
        const response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status === 200 && result[1]?.[0]) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        if (response.status !== 200) {
            winston.warn(`registrarAcuerdo - SP error: ${response.status} | ${response.message} | unidad=${postData.idUnidadResponsable} | user=${postData.idUsuarioRegistra}`);
        }
        return response;
    } catch (ex) {
        winston.error(`registrarAcuerdo - Excepción: ${ex.message} | unidad=${postData.idUnidadResponsable} | user=${postData.idUsuarioRegistra}`);
        throw ex;
    }
}

async function agregarItemAcuerdo(postData) {
    try {
        if (!postData.idUsuarioRegistra) return { status: 400, message: 'Sesión de usuario no válida.' };
        if (!postData.idAcuerdo)         return { status: 400, message: 'idAcuerdo es requerido.' };
        if (![1, 2].includes(Number(postData.idSeccion))) return { status: 400, message: 'idSeccion debe ser 1 (Asunto) o 2 (OficioFirma).' };

        const sql = `CALL SP_AGREGAR_ITEM_ACUERDO(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const result = await db.query(sql, [
            postData.idAcuerdo,
            postData.idSeccion,
            postData.orden              || 1,
            postData.idTipoItem         || null,
            postData.idTema             || null,
            postData.descripcionEjecutiva || null,
            postData.acuerdoInstruccion || null,
            postData.idPrioridad        || null,
            postData.acuerdoTUAF ? 1 : 0,
            postData.seguimiento        || null,
            postData.esPrioritario ? 1 : 0,
            postData.fechaCompromiso    || null,
            postData.idFirmante         || null,
            postData.contenidoOficio    || null,
            postData.antecedente        || null,
            postData.instruccionFirma   || null,
            postData.idUsuarioRegistra
        ]);
        const response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status === 200 && result[1]?.[0]) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        winston.error(`agregarItemAcuerdo - Excepción: ${ex.message} | idAcuerdo=${postData.idAcuerdo}`);
        throw ex;
    }
}

async function registrarInstruccionDRH(postData) {
    try {
        if (!postData.idUsuarioRegistra) return { status: 400, message: 'Sesión de usuario no válida.' };

        const sql = `CALL SP_REGISTRAR_INSTRUCCION_DRH(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const result = await db.query(sql, [
            postData.idAcuerdo              || null,
            postData.idUnidadResponsable    || null,
            postData.idTema                 || null,
            postData.instruccion,
            postData.plazo                  || null,
            postData.idPrioridad            || null,
            postData.esPrioritario ? 1 : 0,
            postData.idUsuarioRegistra,
            postData.usuarioRegistra        || null
        ]);
        const response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status === 200 && result[1]?.[0]) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        winston.error(`registrarInstruccionDRH - Excepción: ${ex.message} | idAcuerdo=${postData.idAcuerdo}`);
        throw ex;
    }
}

async function registrarSeguimientoItem(postData) {
    try {
        if (!postData.idUsuarioRegistra) return { status: 400, message: 'Sesión de usuario no válida.' };

        const sql = `CALL SP_REGISTRAR_SEGUIMIENTO_ITEM(?, ?, ?, ?)`;
        const result = await db.query(sql, [
            postData.idItemAcuerdo,
            postData.semaforoNuevo,
            postData.observacion,
            postData.idUsuarioRegistra
        ]);
        return JSON.parse(JSON.stringify(result[0][0]));
    } catch (ex) {
        winston.error(`registrarSeguimientoItem - Excepción: ${ex.message} | idItem=${postData.idItemAcuerdo}`);
        throw ex;
    }
}

async function concluirItemAcuerdo(postData) {
    try {
        if (!postData.idUsuarioModifica) return { status: 400, message: 'Sesión de usuario no válida.' };

        const sql = `CALL SP_CONCLUIR_ITEM_ACUERDO(?, ?, ?)`;
        const result = await db.query(sql, [
            postData.idItemAcuerdo,
            postData.observacion  || null,
            postData.idUsuarioModifica
        ]);
        return JSON.parse(JSON.stringify(result[0][0]));
    } catch (ex) {
        winston.error(`concluirItemAcuerdo - Excepción: ${ex.message} | idItem=${postData.idItemAcuerdo}`);
        throw ex;
    }
}

async function consultarAcuerdosUR(postData) {
    try {
        const sql = `CALL SP_CONSULTAR_ACUERDOS_UR(?, ?, ?, ?)`;
        const result = await db.query(sql, [
            postData.idUnidadResponsable || 0,
            postData.fechaInicio         || null,
            postData.fechaFin            || null,
            postData.idUsuarioRol        || 0
        ]);
        const response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status === 200) {
            response.model = JSON.parse(JSON.stringify(result[1]));
        }
        return response;
    } catch (ex) {
        winston.error(`consultarAcuerdosUR - Excepción: ${ex.message}`);
        throw ex;
    }
}

async function consultarDetalleAcuerdo(postData) {
    try {
        const sql = `CALL SP_CONSULTAR_DETALLE_ACUERDO(?)`;
        const result = await db.query(sql, [postData.idAcuerdo || 0]);
        const response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status === 200) {
            response.encabezado     = JSON.parse(JSON.stringify(result[1][0]));
            response.items          = JSON.parse(JSON.stringify(result[2]));
            response.instrucciones  = JSON.parse(JSON.stringify(result[3]));
        }
        return response;
    } catch (ex) {
        winston.error(`consultarDetalleAcuerdo - Excepción: ${ex.message} | idAcuerdo=${postData.idAcuerdo}`);
        throw ex;
    }
}

async function consultarLigaSeguimiento(postData) {
    try {
        const sql = `CALL SP_CONSULTAR_LIGA_SEGUIMIENTO(?, ?, ?, ?, ?)`;
        const result = await db.query(sql, [
            postData.idUnidadResponsable ?? 0,
            postData.idSemaforo          ?? -1,
            postData.fechaInicio         || null,
            postData.fechaFin            || null,
            postData.soloVigentes ? 1 : 0
        ]);
        const response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status === 200) {
            response.resumenPorUnidad = JSON.parse(JSON.stringify(result[1]));
            response.items            = JSON.parse(JSON.stringify(result[2]));
        }
        return response;
    } catch (ex) {
        winston.error(`consultarLigaSeguimiento - Excepción: ${ex.message}`);
        throw ex;
    }
}

async function programarHorarioAcuerdo(postData) {
    try {
        if (!postData.idUsuarioRegistra) return { status: 400, message: 'Sesión de usuario no válida.' };

        const sql = `CALL SP_PROGRAMAR_HORARIO_ACUERDO(?, ?, ?, ?, ?)`;
        const result = await db.query(sql, [
            postData.fecha,
            postData.idUnidadResponsable,
            postData.horaInicio,
            postData.notas           || null,
            postData.idUsuarioRegistra
        ]);
        return JSON.parse(JSON.stringify(result[0][0]));
    } catch (ex) {
        winston.error(`programarHorarioAcuerdo - Excepción: ${ex.message} | fecha=${postData.fecha}`);
        throw ex;
    }
}

async function consultarProgramacion(postData) {
    try {
        const sql = `CALL SP_CONSULTAR_PROGRAMACION(?, ?)`;
        const result = await db.query(sql, [
            postData.fecha               || null,
            postData.idUnidadResponsable || 0
        ]);
        const response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status === 200) {
            response.model = JSON.parse(JSON.stringify(result[1]));
        }
        return response;
    } catch (ex) {
        winston.error(`consultarProgramacion - Excepción: ${ex.message}`);
        throw ex;
    }
}

module.exports = {
    registrarAcuerdo,
    agregarItemAcuerdo,
    registrarInstruccionDRH,
    registrarSeguimientoItem,
    concluirItemAcuerdo,
    consultarAcuerdosUR,
    consultarDetalleAcuerdo,
    consultarLigaSeguimiento,
    programarHorarioAcuerdo,
    consultarProgramacion
};
