const asuntoDAO = require("../../DAO/asuntoDAO");
const utils = require("../utils/utils");
const pdf = require("../utils/pdf");
const csv = require("../utils/csv");
const path = require('path');
const fs = require('fs');
const Archiver = require("archiver");
const winston = require("../../config/winston");

async function registrarAsunto(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {
            let data = await asuntoDAO.registrarAsunto(postData);
            if (data.status !== 200) {
                const user = req.userToken ? `${req.userToken.idUsuario} - ${req.userToken.nombreCompleto}` : 'desconocido';
                winston.warn(`[Controller] registrarAsunto fallido: status=${data.status} | msg="${data.message}" | noOficio="${postData.noOficio}" | usuario=${user}`);
            }
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.postDataInvalido(postData));
        }
    } catch (ex) {
        const user = req.userToken ? `${req.userToken.idUsuario} - ${req.userToken.nombreCompleto}` : 'desconocido';
        winston.error(`[Controller] registrarAsunto excepción: ${ex.message} | usuario=${user}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function turnarAsunto(req, res) {
    try {
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {
            let data = await asuntoDAO.turnarAsunto(postData);
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.postDataInvalido(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarAsuntosUR(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.consultarAsuntosUR(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarDetalleAsunto(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.consultarDetalleAsunto(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarExpedienteAsunto(req, res) {
    try {
        const postData = req.body;       
        
            let data = await asuntoDAO.consultarExpedienteAsunto(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarTurnados(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.consultarTurnados(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function reemplazarDocumento(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.reemplazarDocumento(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function agregarAnexos(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.agregarAnexos(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function agregarAntecedentes(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.agregarAntecedentes(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function eliminarDocumento(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.eliminarDocumento(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function concluirAsunto(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.concluirAsunto(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function editarAsunto(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.editarAsunto(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarHistorial(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.consultarHistorial(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function cancelarAsunto(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.cancelarAsunto(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function descargarExpediente(req, res) {
    try {
        const postData = req.body;

        if (postData.id) {
            let path_ = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.id}`);

            if (fs.existsSync(path_)) {
                postData.path = path_;

                // Solo se incluyen las subcarpetas "Turnado-{idTurnado}" que pertenezcan
                // a la unidad responsable del usuario que descarga (fail-closed si falta el dato).
                if (postData.idAsunto && postData.idUnidadResponsable) {
                    const idTurnadosPermitidos = await asuntoDAO.obtenerIdTurnadosPermitidos(
                        [postData.idAsunto],
                        postData.idUnidadResponsable
                    );
                    postData.idTurnadosPermitidos = new Set(idTurnadosPermitidos);
                } else {
                    postData.idTurnadosPermitidos = new Set();
                }

                utils.generarZip(postData, res);
            } else {
                return utils.zipVacio(res);
            }
        } else {
            res.status(400).json(utils.postDataInvalido(postData));
        }
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

// Reemplaza caracteres no válidos para nombres de carpeta/archivo en Windows y recorta longitud
function sanitizarNombreCarpeta(nombre) {
    if (!nombre) return '';
    return nombre
        .toString()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/[\x00-\x1F]/g, '')
        .trim()
        .replace(/\.+$/, '')
        .slice(0, 150);
}

async function descargarExpedientesMasivo(req, res) {
    try {
        const postData = req.body;

        // Solo el folio se usa para localizar la carpeta en disco (no cambia).
        // noOficio es únicamente para el nombre visible dentro del ZIP. idAsunto se usa
        // para saber qué turnados (subcarpetas) pertenecen a la unidad del usuario.
        const mapaAsuntos = new Map();
        (Array.isArray(postData.asuntos) ? postData.asuntos : []).forEach((a) => {
            if (a && a.folio && !mapaAsuntos.has(a.folio)) {
                mapaAsuntos.set(a.folio, { noOficio: a.noOficio || '', idAsunto: a.idAsunto || null });
            }
        });

        if (mapaAsuntos.size === 0) {
            return res.status(400).json(utils.postDataInvalido(postData));
        }

        const idAsuntos = [...mapaAsuntos.values()].map((a) => a.idAsunto).filter(Boolean);
        let idTurnadosPermitidos = new Set();
        if (idAsuntos.length > 0 && postData.idUnidadResponsable) {
            const permitidos = await asuntoDAO.obtenerIdTurnadosPermitidos(idAsuntos, postData.idUnidadResponsable);
            idTurnadosPermitidos = new Set(permitidos);
        }

        const nombresUsados = new Set();
        const nombreUnico = (base) => {
            let nombre = base;
            let contador = 2;
            while (nombresUsados.has(nombre.toLowerCase())) {
                nombre = `${base} (${contador})`;
                contador++;
            }
            nombresUsados.add(nombre.toLowerCase());
            return nombre;
        };

        const carpetasEncontradas = [];
        mapaAsuntos.forEach(({ noOficio }, folio) => {
            const path_ = path.resolve(`./src/documentos/Asuntos/Asunto-${folio}`);
            if (fs.existsSync(path_)) {
                const nombreBase = sanitizarNombreCarpeta(noOficio) || `Asunto-${folio}`;
                carpetasEncontradas.push({ path: path_, nombreZip: nombreUnico(nombreBase) });
            }
        });

        if (carpetasEncontradas.length === 0) {
            return utils.zipVacio(res);
        }

        const fecha = new Date().toISOString().slice(0, 10);
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-disposition': `attachment; filename=Expedientes-${fecha}.zip`
        });

        const zip = Archiver('zip', { zlib: { level: 9 } });
        zip.on('error', (err) => {
            winston.error(`[Controller] descargarExpedientesMasivo error de archivo: ${err.message}`);
            res.status(500).end();
        });

        zip.pipe(res);
        carpetasEncontradas.forEach(({ path: path_, nombreZip }) => {
            utils.agregarCarpetaAsuntoFiltrada(zip, path_, nombreZip, idTurnadosPermitidos);
        });
        zip.finalize();
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

// Función auxiliar para listar archivos recursivamente
function getFilesRecursively(dir, fileList = [], relativePath = '') {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getFilesRecursively(filePath, fileList, path.join(relativePath, file));
        } else {
            fileList.push({
                name: file,
                relativePath: path.join(relativePath, file),
                size: stat.size,
                type: path.extname(file)
            });
        }
    });
    return fileList;
}

async function listarDocumentos(req, res) {
    try {
        const postData = req.body;
        if (!postData.id) {
            return res.status(400).json({ message: "El ID es requerido." });
        }

        const folderPath = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.id}`);

        if (fs.existsSync(folderPath)) {
            const files = getFilesRecursively(folderPath);
            res.status(200).json(files);
        } else {
            res.status(200).json([]); // Retorna lista vacía si no existe carpeta
        }
    } catch (ex) {
        res.status(500).json({ message: "Error al listar documentos", error: ex.message });
    }
}

async function verDocumento(req, res) {
    try {
        const postData = req.body;
        if (!postData.id) {
            return res.status(400).json({ message: "El ID es requerido." });
        }

        let filePath;
        
        if (postData.relativePath) {
            // Si la ruta ya incluye "documentos/", usar desde ./src/
            if (postData.relativePath.startsWith('documentos/')) {
                filePath = path.resolve('./src', postData.relativePath);
            } else {
                // Si es solo el nombre del archivo, construir ruta completa
                const folderPath = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.id}`);
                filePath = path.join(folderPath, postData.relativePath);
            }
        } else {
            // Buscar el primer PDF en la carpeta
            const folderPath = path.resolve(`./src/documentos/Asuntos/Asunto-${postData.id}`);
            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath);
                const pdfFile = files.find(file => file.toLowerCase().endsWith('.pdf'));
                if (pdfFile) filePath = path.join(folderPath, pdfFile);
            }
        }

        if (filePath && fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            let contentType = 'application/octet-stream';
            if (ext === '.pdf') contentType = 'application/pdf';
            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            else if (ext === '.png') contentType = 'image/png';

            res.contentType(contentType);
            res.sendFile(filePath);
        } else {
            res.status(404).json({ message: "Documento no encontrado." });
        }
    } catch (ex) {
        res.status(500).json({ message: "Error interno", error: ex.message });
    }
}

async function guardarComentarioDocumento(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.guardarComentarioDocumento(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarComentariosDocumentos(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.consultarComentariosDocumentos(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

/**
 * La IP real de quien pide, respetando el proxy si lo hay.
 * Mismo criterio que usa el modulo de acuerdos, para que la bitacora
 * guarde el dato igual en todo el sistema.
 */
function ipDe(req) {
    const cabecera = req.headers['x-forwarded-for'];
    const ip = (cabecera ? String(cabecera).split(',')[0] : null)
        || req.ip
        || (req.connection && req.connection.remoteAddress)
        || '127.0.0.1';
    return String(ip).replace('::ffff:', '').substring(0, 45);
}

async function editarAsuntoCompleto(req, res) {
    try {
        const postData = req.body;
            let data = await asuntoDAO.editarAsuntoCompleto({ ...postData, ipOrigen: ipDe(req) });
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
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
    agregarAntecedentes,
    eliminarDocumento,
    concluirAsunto,
    editarAsunto,
    consultarHistorial,
    descargarExpediente,
    descargarExpedientesMasivo,
    verDocumento,
    listarDocumentos,
    cancelarAsunto,
    guardarComentarioDocumento,
    consultarComentariosDocumentos,
    editarAsuntoCompleto
}
