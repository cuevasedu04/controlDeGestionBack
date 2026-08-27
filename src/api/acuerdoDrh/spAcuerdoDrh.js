/**
 * Utilidades para hablar con los stored procedures consolidados de SADRH.
 *
 * Vive aquí y no en api/utils/utils.js a propósito: ese archivo es de
 * controlDeGestion y este módulo no toca nada ajeno.
 *
 * CONTRATO DE LOS SPs
 *   status 100 -> excepción SQL, ya con ROLLBACK aplicado
 *   status 200 -> respuesta de negocio (éxito o validación fallida)
 *   Las columnas propias de cada acción se leen SIEMPRE por nombre.
 */

/**
 * ¿El primer conjunto de un SP de CONSULTA es un rechazo y no datos?
 *
 * Los SPs de consulta con alcance responden de dos formas incompatibles:
 *   - rechazo -> UN conjunto con UNA fila que trae `status` y `message`
 *   - éxito   -> el conjunto de datos, cuyas filas NO tienen columna `status`
 *
 * Se distingue por la PRESENCIA de esa columna, nunca por el número de filas:
 * una consulta que devuelve exactamente un acuerdo también trae una sola fila.
 * Confundirlas haría que un rechazo llegara al cliente disfrazado de resultado
 * vacío.
 */
function esRechazoDeConsulta(filas) {
    return Array.isArray(filas)
        && filas.length === 1
        && filas[0] !== null
        && typeof filas[0] === 'object'
        && filas[0].status !== undefined
        && filas[0].message !== undefined;
}

/**
 * Traduce la respuesta del SP a un código de negocio.
 *
 * Los rechazos se detectan por el prefijo 'Error' del mensaje, que es la
 * convención que ya siguen los SPs. Los mensajes de no-operación que NO
 * empiezan con 'Error' salen como 200: no fallaron, simplemente no cambiaron
 * nada.
 */
function clasificar(resultado) {
    if (Number(resultado.status) === 100) return 500;
    if (/^Error/i.test(resultado.message || '')) return 400;
    return 200;
}

/**
 * Responde al cliente a partir del result set del SP.
 *
 * El HTTP siempre es 200, como en el resto de controlDeGestion; el resultado
 * real viaja en el `status` del cuerpo.
 */
function responder(res, resultado, construirModel) {
    const status = clasificar(resultado);

    if (status !== 200) {
        return res.status(200).json({
            status: status,
            message: resultado.message || "No fue posible completar la operación."
        });
    }

    return res.status(200).json({
        status: 200,
        message: resultado.message || "Operación completada.",
        model: typeof construirModel === 'function' ? construirModel(resultado) : null
    });
}

/** Normaliza un entero opcional: '', null, undefined y NaN pasan como null. */
function entero(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number.parseInt(v, 10);
    return Number.isInteger(n) ? n : null;
}

/** Normaliza texto opcional: recorta y convierte vacío en null. */
function texto(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

/** Copia plana de las filas de un result set. */
function filas(conjunto) {
    return conjunto ? JSON.parse(JSON.stringify(conjunto)) : [];
}

/**
 * Fila de respuesta de un SP de ESCRITURA.
 *
 * Los cuatro consolidados devuelven un solo result set con `status` y
 * `message`, más las columnas propias de cada acción. Se leen por nombre.
 */
function respuestaEscritura(result) {
    return (result && result[0] && result[0][0])
        ? JSON.parse(JSON.stringify(result[0][0]))
        : {};
}

/** IP del cliente, con respaldo para entornos sin proxy configurado. */
function ipDe(req) {
    const cabecera = req.headers['x-forwarded-for'];
    const ip = (cabecera ? String(cabecera).split(',')[0] : null)
        || req.ip
        || (req.connection && req.connection.remoteAddress)
        || '127.0.0.1';
    return String(ip).replace('::ffff:', '').substring(0, 45);
}

module.exports = {
    esRechazoDeConsulta,
    clasificar,
    responder,
    entero,
    texto,
    filas,
    respuestaEscritura,
    ipDe
};
