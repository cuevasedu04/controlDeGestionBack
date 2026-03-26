const catalogDAO = require("../../DAO/catalogDAO");
const utils = require("../utils/utils");
const token = require("../token/tokenController");

/**
 * Into controller files, you will add the logic and calls to DAO objects 
 * 
 */
async function consultarTema(req, res) {
    try {
        let data = await catalogDAO.consultarTema(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarPrioridad(req, res) {
    try {
        let data = await catalogDAO.consultarPrioridad(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarTipoDocumento(req, res) {
    try {
        let data = await catalogDAO.consultarTipoDocumento(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarMedioRecepcion(req, res) {
    try {
        let data = await catalogDAO.consultarMedioRecepcion(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarUnidadAdministrativa(req, res) {
    try {
        let data = await catalogDAO.consultarUnidadAdministrativa(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarInstruccion(req, res) {
    try {
        let data = await catalogDAO.consultarInstruccion(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarDependencia(req, res) {
    try {
        let data = await catalogDAO.consultarDependencia(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}
async function consultarUsuarioRol(req, res) {
    try {
        let data = await catalogDAO.consultarUsuarioRol(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function registrarTema(req, res) {
    try {        
        let data = await catalogDAO.registrarTema(req.body);
        return res.status(200).json(data);
    } catch (ex) {
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function registrarPrioridad(req, res){
    try {
        let data = await catalogDAO.registrarPrioridad(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function insertarDeterminantes(req, res){
    try {
        let data = await catalogDAO.insertarDeterminantes(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }   
}

async function consultarDeterminantes(req, res){
    try{
        let data =  await catalogDAO.consultarDeterminantes(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function actualizarDeterminantes(req, res){
    try{
        let data = await catalogDAO.actualizarDeterminantes(req.body);
        return res.status(200).json(data);
    }catch(ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function desactivarDeterminantes(req, res) {
    try{
        let data = await catalogDAO.desactivarDeterminantes(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function consultarCantidadesStatus(req, res) {
    try{
        let data = await catalogDAO.consultarCantidadesStatus(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function actualizarTema(req, res) {
    try{
        let data = await catalogDAO.actualizarTema(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function desactivarTema(req, res) {
    try{
        let data = await catalogDAO.desactivarTema(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function registrarTipoDocumento(req, res) {
    try{
        let data = await catalogDAO.registrarTipoDocumento(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function actualizarTipoDocumento(req, res) {
    try{
        let data = await catalogDAO.actualizarTipoDocumento(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function activarDesactivarTipoDocumento(req, res) {
    try{
        let data = await catalogDAO.activarDesactivarTipoDocumento(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function verReporte(req, res) {
    try{
        let data = await catalogDAO.verReporte(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function generarExcel(req, res) {
    try{
        let data = await catalogDAO.generarExcel(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}

async function busquedaAvanzadaTurnados(req, res) {
    try{
        let data = await catalogDAO.busquedaAvanzadaTurnados(req.body);
        return res.status(200).json(data);
    }catch (ex){
        res.status(500).json(utils.errorGenerico(ex));
    }
}





module.exports = {
    consultarTema,
    consultarPrioridad,
    consultarMedioRecepcion,
    consultarTipoDocumento,
    consultarUnidadAdministrativa,
    consultarInstruccion,
    consultarDependencia,
    consultarUsuarioRol,
    registrarTema,
    insertarDeterminantes,
    consultarDeterminantes,
    actualizarDeterminantes,
    desactivarDeterminantes,
	consultarCantidadesStatus,
    actualizarTema,
    desactivarTema,
    registrarTipoDocumento,
    actualizarTipoDocumento,
    activarDesactivarTipoDocumento,
    verReporte,
    generarExcel,
    busquedaAvanzadaTurnados
}

