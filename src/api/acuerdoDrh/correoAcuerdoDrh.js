/**
 * Notificaciones por correo de Acuerdos DRH.
 *
 * Vive aquí y no en api/utils/email.js a propósito: ese archivo es de
 * controlDeGestion y este módulo no toca nada ajeno. Sí REUSA su `sendEmail`,
 * que ya trae configurado el transporte SMTP; lo que se agrega son los cuerpos
 * propios de SADRH, siguiendo su misma plantilla visual para que los correos se
 * lean como los del resto del sistema.
 *
 * QUÉ SE NOTIFICA
 *   · Documento rechazado  — la dirección tiene que corregirlo y reenviarlo.
 *   · Acuerdo rechazado    — igual, pero sobre el FADRH completo.
 *   · Cita asignada        — el acuerdo quedó autorizado y ya tiene fecha.
 *   · Cita reprogramada    — cambió el día; hay que enterarse.
 *   · Cita cancelada       — deja de haber reunión.
 *
 * Los tres primeros los señala el propio SP con `requiereNotificacion` y
 * `correoDestino`; aquí solo se cumple lo que ya prometía el mensaje.
 *
 * DOS REGLAS QUE NO SE ROMPEN
 *
 * 1. UN CORREO NUNCA TUMBA UNA OPERACIÓN. Para cuando se envía, el SP ya hizo
 *    COMMIT: el documento ya se rechazó, la cita ya se movió. Si el SMTP falla,
 *    lo que NO puede pasar es que el usuario vea un error y crea que su acción
 *    no se guardó. Por eso todo aquí se traga sus excepciones y se limita a
 *    dejar rastro en el log.
 *
 * 2. EN DESARROLLO NO SE ENVÍA NADA. Las cuentas de prueba usan direcciones
 *    @anam.gob.mx que no existen, y el SMTP es una cuenta compartida real. Con
 *    NODE_ENV distinto de 'production' solo se escribe en el log lo que se
 *    habría mandado. Para probar el envío de verdad: SADRH_CORREO=on.
 */

const email = require("../utils/email");
const winston = require("../../config/winston");

/** La liga al sistema, la misma que usan los correos de SCG. */
const LIGA = process.env.SCG_URL || "http://89.116.51.124:8010/auth/login";

/** ¿Se manda de verdad, o solo se anota lo que se habría mandado? */
function envioActivo() {
    if (String(process.env.SADRH_CORREO || "").toLowerCase() === "on") return true;
    if (String(process.env.SADRH_CORREO || "").toLowerCase() === "off") return false;
    return process.env.NODE_ENV === "production";
}

/** Escapa el texto que viene de la base antes de meterlo en el HTML. */
function esc(v) {
    return String(v === null || v === undefined ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * dd/mm/aaaa hh:mm a partir de lo que devuelve MySQL.
 *
 * CUIDADO CON LA ZONA HORARIA. El pool de controlDeGestion está configurado
 * con `timezone: 'utc'` (src/config/database.js), así que el driver devuelve
 * un Date cuyos componentes UTC son la hora del reloj guardada en la base:
 * un acuerdo agendado a las 12:00 llega como `...T12:00:00.000Z`.
 *
 * Leerlo con getHours() aplica la zona local y le resta seis horas en CDMX —
 * el aviso decía «06:00» de una reunión de las 12:00. Por eso se leen los
 * componentes UTC.
 *
 * Si en cambio llega una cadena, se toman sus dígitos tal cual: interpretarla
 * como fecha volvería a meter la zona horaria de por medio.
 */
function fechaLarga(v) {
    if (!v) return "";

    if (typeof v === "string") {
        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]} hrs`;
        const soloFecha = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;
    }

    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);

    const p = (x) => String(x).padStart(2, "0");
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
           `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} hrs`;
}

/**
 * La plantilla, calcada de la que ya usa controlDeGestion para sus avisos:
 * mismo guinda, misma barra dorada, mismo pie con la leyenda de
 * confidencialidad. Un correo de SADRH no debe verse como de otro sistema.
 *
 * `acento` tiñe el bloque de datos según de qué se trate: guinda para lo
 * informativo, rojo para lo que hay que corregir.
 */
function plantilla({ titulo, saludo, mensaje, folio, datos = [], aviso, acento = "#611232" }) {
    const filasDatos = datos
        .filter((d) => d && d.valor !== null && d.valor !== undefined && String(d.valor) !== "")
        .map((d) => `
            <tr>
                <td colspan="2" style="padding-top:12px;">
                    <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.6px;">${esc(d.etiqueta)}</p>
                    <p style="margin:3px 0 0;font-size:13px;color:#333333;line-height:1.5;">${esc(d.valor)}</p>
                </td>
            </tr>`).join("");

    const bloqueAviso = aviso ? `
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                                <tr>
                                    <td style="background-color:#fff8e6;border-left:4px solid #c8a415;border-radius:4px;padding:14px 18px;">
                                        <p style="margin:0;font-size:13px;color:#5c4a10;line-height:1.55;">${esc(aviso)}</p>
                                    </td>
                                </tr>
                            </table>` : "";

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:30px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12);">

                    <tr>
                        <td style="background-color:#611232;height:7px;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>

                    <tr>
                        <td style="background-color:#ffffff;padding:24px 36px 20px;text-align:center;border-bottom:1px solid #f0f0f0;">
                            <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                                <tr>
                                    <td style="background-color:#611232;border-radius:4px;padding:6px 16px;">
                                        <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:4px;text-transform:uppercase;">SCG</span>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:0 0 4px;font-family:'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:0.3px;">Seguimiento de Acuerdos</p>
                            <p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#888888;letter-spacing:1.2px;text-transform:uppercase;">Dirección de Recursos Humanos &nbsp;·&nbsp; ANAM</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color:#c8a415;height:3px;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>

                    <tr>
                        <td style="padding:36px 36px 28px;">
                            <p style="margin:0 0 6px;color:#555555;font-size:15px;">${esc(saludo)}</p>
                            <p style="margin:0 0 24px;color:#333333;font-size:15px;line-height:1.6;">${mensaje}</p>

                            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                                <tr>
                                    <td style="background-color:#fdf0f3;border-left:4px solid ${acento};border-radius:4px;padding:16px 18px;">
                                        <p style="margin:0;font-size:12px;color:#666666;text-transform:uppercase;letter-spacing:0.8px;">Folio del acuerdo</p>
                                        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${acento};">${esc(folio)}</p>
                                        <table cellpadding="0" cellspacing="0" width="100%">${filasDatos}</table>
                                    </td>
                                </tr>
                            </table>
${bloqueAviso}
                            <p style="margin:0 0 24px;color:#444444;font-size:15px;line-height:1.6;">
                                Para atenderlo, ingrese al
                                <a href="${LIGA}" style="color:#611232;font-weight:600;text-decoration:none;">Sistema de Control de Gestión</a>,
                                en el apartado <strong>Seguimiento de Acuerdos</strong>.
                            </p>

                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background-color:#611232;border-radius:5px;">
                                        <a href="${LIGA}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                                            Ir al Sistema &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color:#f7f8fa;border-top:1px solid #e8eaed;padding:20px 36px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="vertical-align:middle;text-align:right;">
                                        <p style="margin:0;font-size:11px;color:#888888;">Dirección de Recursos Humanos</p>
                                        <p style="margin:2px 0 0;font-size:11px;color:#888888;">Agencia Nacional de Aduanas de México</p>
                                        <p style="margin:6px 0 0;font-size:10px;color:#aaaaaa;font-style:italic;">Este correo se genera automáticamente, no requiere respuesta.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>

        <tr>
            <td align="center" style="padding:16px 20px 24px;">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                    <tr>
                        <td style="border-top:1px solid #cccccc;padding-top:14px;">
                            <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.6px;">Leyenda de Confidencialidad</p>
                            <p style="margin:0;font-size:9.5px;color:#777777;line-height:1.5;text-align:justify;">
                                De conformidad con el inciso a) del Art&iacute;culo 57 del &ldquo;Acuerdo por el que se emiten las pol&iacute;ticas y disposiciones para impulsar el uso y aprovechamiento de la inform&aacute;tica, el gobierno digital, las tecnolog&iacute;as de la informaci&oacute;n y comunicaci&oacute;n, y la seguridad de la informaci&oacute;n en la Administraci&oacute;n P&uacute;blica Federal&rdquo; publicado en el Diario Oficial de la Federaci&oacute;n el 6 de septiembre del 2021. La informaci&oacute;n contenida en correos institucionales, es de car&aacute;cter confidencial y su tratamiento es con estricta observancia a los principios de licitud, finalidad, lealtad, consentimiento, calidad, proporcionalidad, informaci&oacute;n y responsabilidad establecidos en la Ley General de Protecci&oacute;n de Datos Personales en Posesi&oacute;n de Sujetos Obligados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

    </table>
</body>
</html>`;
}

/**
 * El único punto por donde sale un correo de SADRH.
 *
 * Nunca lanza. Si algo falla —falta el destinatario, el SMTP no responde—, lo
 * anota y devuelve false. Quien llama ya respondió al usuario.
 */
function enviar({ para, copia, asunto, html, referencia }) {
    try {
        const destinos = (Array.isArray(para) ? para : [para])
            .filter((c) => typeof c === "string" && c.includes("@"));

        if (!destinos.length) {
            winston.warn(`[correoAcuerdoDrh] ${referencia}: sin destinatario válido, no se envía`);
            return false;
        }

        const cc = (Array.isArray(copia) ? copia : [copia])
            .filter((c) => typeof c === "string" && c.includes("@") && !destinos.includes(c));

        if (!envioActivo()) {
            winston.info(`[correoAcuerdoDrh] (no se envía: NODE_ENV=${process.env.NODE_ENV}) ` +
                         `${referencia} → ${destinos.join(", ")}` +
                         `${cc.length ? ` | cc ${cc.join(", ")}` : ""} | ${asunto}`);
            return false;
        }

        email.sendEmail({
            from: process.env.SMTP_USER,
            to: destinos.join(","),
            cc: cc.length ? cc.join(",") : undefined,
            subject: asunto,
            html: html,
        });

        winston.info(`[correoAcuerdoDrh] ${referencia} → ${destinos.join(", ")}`);
        return true;
    } catch (ex) {
        // A propósito: un fallo de correo no puede propagarse. La operación de
        // negocio ya se guardó.
        winston.error(`[correoAcuerdoDrh] ${referencia}: falló el envío — ${ex.message}`);
        return false;
    }
}

// ── Los avisos ────────────────────────────────────────────────────

/** Un documento fue rechazado: la dirección tiene que corregirlo. */
function documentoRechazado({ para, copia, folio, documento, motivo, revisor }) {
    return enviar({
        para, copia,
        referencia: `documento rechazado ${folio}`,
        asunto: `SADRH - Documento rechazado: ${folio}`,
        html: plantilla({
            saludo: "Estimado/a responsable:",
            mensaje: "Se <strong>rechazó un documento</strong> del siguiente acuerdo. " +
                     "Debe corregirse y reenviarse para poder continuar.",
            folio,
            acento: "#9F0D3D",
            datos: [
                { etiqueta: "Documento", valor: documento },
                { etiqueta: "Motivo del rechazo", valor: motivo },
                { etiqueta: "Revisó", valor: revisor },
            ],
            aviso: "Mientras el documento no esté aprobado, el acuerdo no puede " +
                   "recibir fecha de celebración.",
        }),
    });
}

/** El FADRH completo fue rechazado. */
function acuerdoRechazado({ para, copia, folio, descripcion, motivo, revisor }) {
    return enviar({
        para, copia,
        referencia: `acuerdo rechazado ${folio}`,
        asunto: `SADRH - Acuerdo devuelto para corrección: ${folio}`,
        html: plantilla({
            saludo: "Estimado/a responsable:",
            mensaje: "El acuerdo que registró fue <strong>devuelto para corrección</strong>.",
            folio,
            acento: "#9F0D3D",
            datos: [
                { etiqueta: "Acuerdo", valor: descripcion },
                { etiqueta: "Motivo", valor: motivo },
                { etiqueta: "Revisó", valor: revisor },
            ],
            aviso: "Al corregirlo y guardarlo, el acuerdo regresa automáticamente " +
                   "a En revisión. No hace falta registrarlo de nuevo.",
        }),
    });
}

/**
 * La cita quedó asignada, se movió o se canceló.
 *
 * Van juntas porque son el mismo hecho visto en tres momentos, y lo que
 * cambia es el encabezado. Separarlas en tres plantillas casi idénticas solo
 * multiplicaría los lugares donde corregir una redacción.
 */
function citaDeAcuerdo({ tipo, para, copia, folio, tema, descripcion, fecha, fechaPrevia, motivo }) {
    const textos = {
        programada: {
            asunto: `SADRH - Su acuerdo fue autorizado y agendado: ${folio}`,
            mensaje: "Su acuerdo fue <strong>autorizado</strong> y ya tiene fecha de celebración.",
            aviso: null,
            acento: "#007B5D",
        },
        reprogramada: {
            asunto: `SADRH - Cambió la fecha de su acuerdo: ${folio}`,
            mensaje: "La reunión de su acuerdo fue <strong>reprogramada</strong>.",
            aviso: fechaPrevia ? `La fecha anterior era ${fechaLarga(fechaPrevia)}.` : null,
            acento: "#611232",
        },
        cancelada: {
            asunto: `SADRH - Se canceló la reunión de su acuerdo: ${folio}`,
            mensaje: "La reunión de su acuerdo fue <strong>cancelada</strong>.",
            aviso: "El acuerdo deja de avanzar en el flujo. Si necesita retomarlo, " +
                   "comuníquese con la Dirección de Recursos Humanos.",
            acento: "#9F0D3D",
        },
    }[tipo];

    if (!textos) return false;

    return enviar({
        para, copia,
        referencia: `cita ${tipo} ${folio}`,
        asunto: textos.asunto,
        html: plantilla({
            saludo: "Estimado/a responsable:",
            mensaje: textos.mensaje,
            folio,
            acento: textos.acento,
            datos: [
                { etiqueta: "Tema", valor: tema },
                { etiqueta: "Acuerdo", valor: descripcion },
                { etiqueta: tipo === "cancelada" ? "Fecha que tenía" : "Fecha de la reunión",
                  valor: fechaLarga(fecha) },
                { etiqueta: "Motivo", valor: motivo },
            ],
            aviso: textos.aviso,
        }),
    });
}

module.exports = {
    documentoRechazado,
    acuerdoRechazado,
    citaDeAcuerdo,
    // Se exportan para poder probarlas sin mandar nada.
    plantilla,
    envioActivo,
    fechaLarga,
};
