const turnadoDAO = require("../../DAO/turnadoDAO");
const utils = require("../utils/utils");
const pdf = require("../utils/pdf");
const csv = require("../utils/csv");
const path = require('path');
const fs = require('fs');
const Archiver = require("archiver");



async function consultarTurnados(req, res) {
    try {
        const postData = req.body;
            let data = await turnadoDAO.consultarTurnadosUR(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function asignarComisionado(req, res) {
    try {
        const postData = req.body;
            let data = await turnadoDAO.asignarComisionado(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function contestarTurnado(req, res) {
    try {
        const postData = req.body;
            let data = await turnadoDAO.contestarTurnado(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarDetalleTurnado(req, res) {
    try {
        const postData = req.body;
            let data = await turnadoDAO.consultarDetalleTurnado(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function rechazarTurnado(req, res) {
    try {
        const postData = req.body;
        if (!postData.idTurnado || !postData.idUsuarioModifica || !postData.motivoRechazo) {
            return  res.status(400).json({
                status: 400,
                message: "Faltan datos obligatorios para rechazar el turnado."
            });
        }
        let data = await turnadoDAO.rechazarTurnado(postData);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function verTurnado(req, res) {
    try {
        const postData = req.body;
        if (!postData.idTurnado || !postData.idUsuarioModifica) {
            return  res.status(400).json({
                status: 400,
                message: "Faltan datos obligatorios para rechazar el turnado."
            });
        }
        let data = await turnadoDAO.verTurnado(postData);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function obtenerComisionados(req, res) {
    try {
        const postData = req.body;
            let data = await turnadoDAO.obtenerComisionados(postData);
            return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}


module.exports = {
    consultarTurnados,
    contestarTurnado,
    rechazarTurnado,
    consultarDetalleTurnado,
    verTurnado,
    asignarComisionado,
    obtenerComisionados
}
