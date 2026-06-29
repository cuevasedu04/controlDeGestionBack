const acuerdoDAO = require("../../DAO/acuerdoDAO");
const utils = require("../utils/utils");
const winston = require("../../config/winston");

function getUser(req) {
    return req.userToken ? `${req.userToken.idUsuario} - ${req.userToken.nombreCompleto}` : 'desconocido';
}

async function registrarAcuerdo(req, res) {
    try {
        const postData = req.body;
        if (!Object.keys(postData).length) return res.status(400).json(utils.postDataInvalido(postData));
        const data = await acuerdoDAO.registrarAcuerdo(postData);
        if (data.status !== 200) winston.warn(`[Controller] registrarAcuerdo: ${data.status} | ${data.message} | usuario=${getUser(req)}`);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] registrarAcuerdo excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function agregarItemAcuerdo(req, res) {
    try {
        const postData = req.body;
        if (!Object.keys(postData).length) return res.status(400).json(utils.postDataInvalido(postData));
        const data = await acuerdoDAO.agregarItemAcuerdo(postData);
        if (data.status !== 200) winston.warn(`[Controller] agregarItemAcuerdo: ${data.status} | ${data.message} | idAcuerdo=${postData.idAcuerdo} | usuario=${getUser(req)}`);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] agregarItemAcuerdo excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function registrarInstruccionDRH(req, res) {
    try {
        const postData = req.body;
        if (!Object.keys(postData).length) return res.status(400).json(utils.postDataInvalido(postData));
        const data = await acuerdoDAO.registrarInstruccionDRH(postData);
        if (data.status !== 200) winston.warn(`[Controller] registrarInstruccionDRH: ${data.status} | ${data.message} | usuario=${getUser(req)}`);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] registrarInstruccionDRH excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function registrarSeguimientoItem(req, res) {
    try {
        const postData = req.body;
        if (!Object.keys(postData).length) return res.status(400).json(utils.postDataInvalido(postData));
        const data = await acuerdoDAO.registrarSeguimientoItem(postData);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] registrarSeguimientoItem excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function concluirItemAcuerdo(req, res) {
    try {
        const postData = req.body;
        if (!Object.keys(postData).length) return res.status(400).json(utils.postDataInvalido(postData));
        const data = await acuerdoDAO.concluirItemAcuerdo(postData);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] concluirItemAcuerdo excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarAcuerdosUR(req, res) {
    try {
        const data = await acuerdoDAO.consultarAcuerdosUR(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] consultarAcuerdosUR excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarDetalleAcuerdo(req, res) {
    try {
        const data = await acuerdoDAO.consultarDetalleAcuerdo(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] consultarDetalleAcuerdo excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarLigaSeguimiento(req, res) {
    try {
        const data = await acuerdoDAO.consultarLigaSeguimiento(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] consultarLigaSeguimiento excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function programarHorarioAcuerdo(req, res) {
    try {
        const postData = req.body;
        if (!Object.keys(postData).length) return res.status(400).json(utils.postDataInvalido(postData));
        const data = await acuerdoDAO.programarHorarioAcuerdo(postData);
        if (data.status !== 200) winston.warn(`[Controller] programarHorarioAcuerdo: ${data.status} | ${data.message} | usuario=${getUser(req)}`);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] programarHorarioAcuerdo excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarProgramacion(req, res) {
    try {
        const data = await acuerdoDAO.consultarProgramacion(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        winston.error(`[Controller] consultarProgramacion excepción: ${ex.message} | usuario=${getUser(req)}`);
        res.status(500).json(utils.errorGenerico(ex));
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
