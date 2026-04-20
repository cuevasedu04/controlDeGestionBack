var nodemailer = require('nodemailer');
const { getMaxListeners } = require('../../config/winston');
const correoDAO = require("../../DAO/correoDAO");
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});


function sendEmail(mailOptions) {
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log("error send email: ", error)
            return false;
        } else {
            console.log("Correo enviado! ! !")
            return true;
        }
    });
}

async function bodyRechazo(res) {
    try {

        let data = await correoDAO.obtenerCorreoRechazoPeticion(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo rechazo petición.");
        throw ex;
    }
}
/**
 * 
 * @param {*} data 
 */
async function bodyCartaAmableOC(res) {
    try {

        let data = await correoDAO.obtenerCorreoCartaAmableOC(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo carta amable.");
        throw ex;
    }
}


async function bodyCartaAmableOSFAE(res) {
    try {

        let data = await correoDAO.obtenerCorreoCartaAmableOSFAE(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo carta amable OSFAE.");
        throw ex;
    }
}
async function bodyRechazoAsignacion(res) {
    try {

        let data = await correoDAO.obtenerCorreoRechazoAsignacion(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo rechazo asignación.");
        throw ex;
    }
}
async function bodyPaseSalida(res) {
    try {

        let data = await correoDAO.bodyPaseSalida(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo rechazo asignación.");
        throw ex;
    }
}
async function bodyResguardoCorreo(res) {
    try {

        let data = await correoDAO.bodyResguardoCorreo(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo rechazo asignación.");
        throw ex;
    }
}

async function bodyRespuestaEnlace(res) {
    try {

        let data = await correoDAO.obtenerCorreoRespuestaEnlance(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo respuesta enlace.");
        throw ex;
    }
}
async function bodyRespuestaSGIS(res) {
    try {

        let data = await correoDAO.obtenerCorreoRespuestaSGIS(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo respuesta SGIS.");
        throw ex;
    }
}
async function bodyVoBoRechazo(res) {
    try {

        let data = await correoDAO.obtenerCorreoVoboRechazo(res);
        return data;
    } catch (ex) {
        console.log("Error al obtener correo rechazo vobo.");
        throw ex;
    }
}


/**         Recibe elidFormato si es:<br>
 *          1- Rechazada<br> ok
 *          2-Carta Amable<br>
 *          3-Rechazo asignación <br> ok
 *          4-RespuestaEnlace<br> ok
 *          5-Respuesta S-GIS<br> pendiente
 *          6-voBo S-GIS<br> ok
 *  {}
 * @param idFormato
 */
async function configuraCorreo(idFormato, data, pdf = null) {
    var configRemite = {
        from: "no_reply@scg.com.mx"
    }
    let res;
    switch (idFormato) {
        case 1:
            configRemite.subject = "S-GIS - Notificación: Rechazo de solicitud.";
            res = await bodyRechazo(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            break;
        case 2:
            configRemite.subject = "S-GIS - Notificación: Solicitud aceptada, inicio de proceso.";
            res = await bodyCartaAmableOC(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            configRemite.cc = res.model.correoUR;
            break;
        case 3:
            configRemite.subject = "S-GIS - Notificación: Solicitud aceptada, inicio de proceso.";
            res = await bodyCartaAmableOSFAE(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            configRemite.cc = res.model.correoUR;
            break;
        case 4:
            configRemite.subject = "S-GIS - Notificación: Respuesta del enlace.";
            res = await bodyRespuestaEnlace(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            break;
        case 5:
            configRemite.subject = "S-GIS - Notificación: VoBo. del operador.";
            res = await bodyRespuestaSGIS(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            break;
        case 6:
            configRemite.subject = "S-GIS - Notificación: Rechazo de la respuesta en VoBo.";
            res = await bodyVoBoRechazo(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            break;
        case 7:
            configRemite.subject = "S-GIS - Notificación: Rechazo de la asignación.";
            res = await bodyRechazoAsignacion(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            break;
        case 8:
            configRemite.subject = "PASE DE SALIDA";
            res = await bodyPaseSalida(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            var pdfBase64 = await getPdfStream(pdf);
            configRemite.attachments = [
                {
                    filename: "Pase de Salida.pdf",
                    content: pdfBase64,
                    encoding: 'base64'
                }
            ]
            break;
        case 9:
            configRemite.subject = "PASE DE SALIDA EQUIPO PERSONAL";
            res = await bodyPaseSalida(data);
            configRemite.body = res.model.body;
            configRemite.correoPersona = res.model.correoPersona;
            var pdfBase64 = await getPdfStream(pdf);
            configRemite.attachments = [
                {
                    filename: "Pase de Salida.pdf",
                    content: pdfBase64,
                    encoding: 'base64'
                }
            ]
            break;
        case 10:
            configRemite.subject = "RESGUARDO";
            res = await bodyResguardoCorreo(data);

            configRemite.body = res.model.body;            
            configRemite.correoPersona = res.model.correoPersona;
            var pdfBase64 = await getPdfStream(pdf);
            configRemite.attachments = [
                {
                    filename: "Resguardo.pdf",
                    content: pdfBase64,
                    encoding: 'base64'
                }
            ]
            break;
        default:
            configRemite.subject = "S-GIS - Notificación.";
            break;
    }
    return configRemite;
}

async function enviarCorreoActualizacionEtapa(idFormato, data) {
    try {
        let config = await configuraCorreo(idFormato, data);
        var mailOptions = {
            from: config.from,
            to: config.correoPersona,
            cc: config.cc,
            subject: config.subject,
            html: config.body

        };
        sendEmail(mailOptions);
    } catch (error) {
        console.log(error)
    }
}
async function enviarCorreoPaseSalida(idFormato, data,pdf) {
    try {
        let config = await configuraCorreo(idFormato, data,pdf);

        var mailOptions = {
            from: config.from,
             to:data.correoDestino,
            //to:'adrcoria@gmail.com',
            subject: config.subject,
            html: config.body,
            attachments:config.attachments
        };        

        sendEmail(mailOptions);
    } catch (error) {
        console.log(error)
    }
}

async function enviarCorreoPaseSalidaEquipoPersonal(idFormato, data,pdf) {
    try {
        let config = await configuraCorreo(idFormato, data,pdf);

        var mailOptions = {
            from: config.from,
             to:data.email,
            //to:'adrcoria@gmail.com',
            subject: config.subject,
            html: config.body,
            attachments:config.attachments
        };
        console.log(mailOptions);

        sendEmail(mailOptions);
    } catch (error) {
        console.log(error)
    }
}
async function enviarCorreoResguardo(idFormato, data,pdf) {
    try {
        let config = await configuraCorreo(idFormato, data,pdf);

        var mailOptions = {
            from: config.from,
             to:data.correo,
            cc: config.correoPersona,
            //to:'adrcoria@gmail.com',
            subject: config.subject,
            html: config.body,
            attachments:config.attachments
        };
        sendEmail(mailOptions);
    } catch (error) {
        console.log(error)
    }
}

function getPdfStream (stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    })
}
function bodyNotificacionTurnado(data) {
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

                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#4B0E27 0%,#611232 100%);padding:28px 36px;">
                            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Sistema de Control de Gestión</p>
                        </td>
                    </tr>

                    <!-- Accent bar -->
                    <tr>
                        <td style="background-color:#c8a415;height:4px;"></td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:36px 36px 28px;">
                            <p style="margin:0 0 6px;color:#555555;font-size:15px;">Estimado/a responsable:</p>
                            <p style="margin:0 0 24px;color:#333333;font-size:15px;line-height:1.6;">
                                Le informamos que se le ha <strong>turnado un nuevo asunto</strong> para su atención.
                            </p>

                            <!-- Oficio badge -->
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                                <tr>
                                    <td style="background-color:#fdf0f3;border-left:4px solid #611232;border-radius:4px;padding:16px 18px;">
                                        <p style="margin:0;font-size:12px;color:#666666;text-transform:uppercase;letter-spacing:0.8px;">Número de Oficio</p>
                                        <p style="margin:4px 0 16px;font-size:20px;font-weight:700;color:#611232;">${data.noOficio}</p>
                                        <table cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="50%" style="vertical-align:top;padding-right:8px;">
                                                    <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.6px;">Tema</p>
                                                    <p style="margin:3px 0 0;font-size:13px;color:#333333;">${data.tema}</p>
                                                </td>
                                                <td width="50%" style="vertical-align:top;padding-left:8px;">
                                                    <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.6px;">Prioridad</p>
                                                    <p style="margin:3px 0 0;font-size:13px;font-weight:600;color:${data.prioridad === 'Alta' ? '#c0392b' : data.prioridad === 'Media' ? '#d68910' : '#1e8449'};">${data.prioridad}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colspan="2" style="padding-top:12px;">
                                                    <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.6px;">Descripción</p>
                                                    <p style="margin:3px 0 0;font-size:13px;color:#333333;line-height:1.5;">${data.descripcion}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                        
                            <p style="margin:0 0 24px;color:#444444;font-size:15px;line-height:1.6;">
                                Para revisar el asunto asignado, ingrese al
                                <a href="http://89.116.51.124:8010/auth/login" style="color:#611232;font-weight:600;text-decoration:none;">Sistema de Control de Gestión</a>.
                            </p>

                            <!-- CTA Button -->
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background-color:#611232;border-radius:5px;">
                                        <a href="http://89.116.51.124:8010/auth/login"
                                           style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                                            Ir al Sistema →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f7f8fa;border-top:1px solid #e8eaed;padding:20px 36px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="vertical-align:middle;">
                                        <img src="http://89.116.51.124:8010/img/Logos_P_Hacienda_ANAM.png"
                                             alt="ANAM - Agencia Nacional de Aduanas de México"
                                             style="max-height:48px;display:block;" />
                                    </td>
                                    <td style="vertical-align:middle;text-align:right;">
                                        <p style="margin:0;font-size:11px;color:#888888;">Subdirección de Control de Gestión</p>
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

        <!-- Confidentiality legend -->
        <tr>
            <td align="center" style="padding:16px 20px 24px;">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                    <tr>
                        <td style="border-top:1px solid #cccccc;padding-top:14px;">
                            <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.6px;">Leyenda de Confidencialidad</p>
                            <p style="margin:0;font-size:9.5px;color:#777777;line-height:1.5;text-align:justify;">
                                De conformidad con el inciso a) del Artículo 57 del &ldquo;Acuerdo por el que se emiten las políticas y disposiciones para impulsar el uso y aprovechamiento de la informática, el gobierno digital, las tecnologías de la información y comunicación, y la seguridad de la información en la Administración Pública Federal&rdquo; publicado en el Diario Oficial de la Federación el 6 de septiembre del 2021. La información contenida en correos institucionales, es de carácter confidencial y su tratamiento es con estricta observancia a los principios de licitud, finalidad, lealtad, consentimiento, calidad, proporcionalidad, información y responsabilidad establecidos en la Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados.
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

function bodyNotificacionComisionado(data) {
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

                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#4B0E27 0%,#611232 100%);padding:28px 36px;">
                            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Sistema de Control de Gestión</p>
                        </td>
                    </tr>

                    <!-- Accent bar -->
                    <tr>
                        <td style="background-color:#c8a415;height:4px;"></td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:36px 36px 28px;">
                            <p style="margin:0 0 6px;color:#555555;font-size:15px;">Estimado/a colaborador(a):</p>
                            <p style="margin:0 0 24px;color:#333333;font-size:15px;line-height:1.6;">
                                Le informamos que ha sido <strong>comisionado/a</strong> para atender el siguiente asunto:
                            </p>

                            <!-- Oficio badge -->
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                                <tr>
                                    <td style="background-color:#fdf0f3;border-left:4px solid #611232;border-radius:4px;padding:16px 18px;">
                                        <p style="margin:0;font-size:12px;color:#666666;text-transform:uppercase;letter-spacing:0.8px;">Número de Oficio</p>
                                        <p style="margin:4px 0 16px;font-size:20px;font-weight:700;color:#611232;">${data.noOficio}</p>
                                        <table cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="50%" style="vertical-align:top;padding-right:8px;">
                                                    <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.6px;">Tema</p>
                                                    <p style="margin:3px 0 0;font-size:13px;color:#333333;">${data.tema}</p>
                                                </td>
                                                <td width="50%" style="vertical-align:top;padding-left:8px;">
                                                    <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.6px;">Prioridad</p>
                                                    <p style="margin:3px 0 0;font-size:13px;font-weight:600;color:${data.prioridad === 'Alta' ? '#c0392b' : data.prioridad === 'Media' ? '#d68910' : '#1e8449'};">${data.prioridad}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colspan="2" style="padding-top:12px;">
                                                    <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.6px;">Descripción</p>
                                                    <p style="margin:3px 0 0;font-size:13px;color:#333333;line-height:1.5;">${data.descripcion}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 24px;color:#444444;font-size:15px;line-height:1.6;">
                                Para revisar el asunto asignado, ingrese al
                                <a href="http://89.116.51.124:8010/auth/login" style="color:#611232;font-weight:600;text-decoration:none;">Sistema de Control de Gestión</a>.
                            </p>

                            <!-- CTA Button -->
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background-color:#611232;border-radius:5px;">
                                        <a href="http://89.116.51.124:8010/auth/login"
                                           style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                                            Ir al Sistema →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f7f8fa;border-top:1px solid #e8eaed;padding:20px 36px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="vertical-align:middle;">
                                        <img src="http://89.116.51.124:8010/img/Logos_P_Hacienda_ANAM.png"
                                             alt="ANAM - Agencia Nacional de Aduanas de México"
                                             style="max-height:48px;display:block;" />
                                    </td>
                                    <td style="vertical-align:middle;text-align:right;">
                                        <p style="margin:0;font-size:11px;color:#888888;">Subdirección de Control de Gestión</p>
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

        <!-- Confidentiality legend -->
        <tr>
            <td align="center" style="padding:16px 20px 24px;">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                    <tr>
                        <td style="border-top:1px solid #cccccc;padding-top:14px;">
                            <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#555555;text-transform:uppercase;letter-spacing:0.6px;">Leyenda de Confidencialidad</p>
                            <p style="margin:0;font-size:9.5px;color:#777777;line-height:1.5;text-align:justify;">
                                De conformidad con el inciso a) del Artículo 57 del &ldquo;Acuerdo por el que se emiten las políticas y disposiciones para impulsar el uso y aprovechamiento de la informática, el gobierno digital, las tecnologías de la información y comunicación, y la seguridad de la información en la Administración Pública Federal&rdquo; publicado en el Diario Oficial de la Federación el 6 de septiembre del 2021. La información contenida en correos institucionales, es de carácter confidencial y su tratamiento es con estricta observancia a los principios de licitud, finalidad, lealtad, consentimiento, calidad, proporcionalidad, información y responsabilidad establecidos en la Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados.
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

async function enviarNotificacionTurnado(data) {
    try {
        if (!data.correos) return;
        var mailOptions = {
            from: process.env.SMTP_USER,
            to: data.correos,
            subject: `SCG - Nuevo asunto turnado: ${data.noOficio}`,
            html: bodyNotificacionTurnado(data)
        };
        sendEmail(mailOptions);
    } catch (error) {
        console.log("Error al enviar notificación de turnado:", error);
    }
}

async function enviarNotificacionComisionado(data) {
    try {
        if (!data.correos) return;
        var mailOptions = {
            from: process.env.SMTP_USER,
            to: data.correos,
            subject: `SCG - Ha sido comisionado al asunto: ${data.noOficio}`,
            html: bodyNotificacionComisionado(data)
        };
        sendEmail(mailOptions);
    } catch (error) {
        console.log("Error al enviar notificación de comisionado:", error);
    }
}

function bodyNotificacionReporteRoboRegistro(data) {
    var body =
        `<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
            </style>
        </head>
        <body>
            <header class="header">
                <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4wYRDGGUt60Oz9EvKa0JoUxWLH7i35yoqt2g2-4kFrjtGsMlJVnBOQhMM_F5LSsSh3nEOWZmIE"/>
            </header>
            <section class="section-text">
                <div>
                    Estimado servidor público. 
                    <br> Le informamos que se ha iniciado un registro de reporte de robo
                    con el folio ${data.folio}  en el Sistema de Administración de Servicios de TIC (SASTIC).
                </div>
                <div>
                    <br>Siniestro ocurrido en la Unidad Responsable: ${data.unidadResponsable}
                    <br><strong>Componente: </strong>${data.componente}
                    <br><strong>Tipo de siniestro: </strong>${data.tipoSiniestro}
                   
                </div>
                <div>En caso de requerir mayor información, favor de ponerse en contacto con la Unidad Responsable en la cual ocurrió el siniestro, ya que esa unidad es la encargada de dar atención y seguimiento.</div>
            </section>
            <section class="section-footer">
                <p>Subdirección de Control de Gestión</p>
                <p>Agencia Nacional de Aduanas de México</p>
            </section>
            <p>Nota: Este correo electrónico se genera automáticamente y no requiere respuesta.</p>
        </body>
    </html>`
    return body;
}

async function enviarNotificacion( data ) {
    try {
        let from = "no_reply@nube.sep.gob.mx";
        var body = await bodyNotificacionReporteRoboRegistro(data);
        var mailOptions = {
            from: from,
            to: data.correos, 
            subject: "Notificaciones SEP -  Registro de reporte de robo",
            html: body,
        }       
        sendEmail(mailOptions, data);

    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    sendEmail,
    configuracionRemitente: configuraCorreo,
    /* cuerpos de correo*/
    bodyRechazo,
    bodyCartaAmableOC,
    bodyCartaAmableOSFAE,
    bodyRechazoAsignacion,
    bodyRespuestaEnlace,
    bodyRespuestaSGIS,
    bodyVoBoRechazo,
    enviarCorreoActualizacionEtapa,
    enviarCorreoPaseSalida,
    enviarCorreoPaseSalidaEquipoPersonal,
    enviarCorreoResguardo,
    enviarNotificacion,
    enviarNotificacionTurnado,
    enviarNotificacionComisionado
}