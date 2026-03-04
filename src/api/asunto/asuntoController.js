const asuntoDAO = require("../../DAO/asuntoDAO");
const utils = require("../utils/utils");
const pdf = require("../utils/pdf");
const csv = require("../utils/csv");
const path = require('path');
const fs = require('fs');
const Archiver = require("archiver");

async function registrarAsunto(req, res) {
    try {
        
        const postData = req.body;
        if (Object.keys(postData).length !== 0) {
            let data = await asuntoDAO.registrarAsunto(postData);
            return res.status(200).json(data);
        } else {
            res.status(400).json(utils.postDataInvalido(postData));
        }
    } catch (ex) {
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
    consultarHistorial,
    descargarExpediente,
    verDocumento,
    listarDocumentos,
    cancelarAsunto
}
