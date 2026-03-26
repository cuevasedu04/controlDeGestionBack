const db = require("../config/database");

async function consultarTema(postData) {
  let response = {};
  try {
    let sql = `CALL SP_CONSULTAR_TEMA()`;
    let result = await db.query(sql);
    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1]));
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}

async function consultarPrioridad(postData) {
  let response = {};
  try {
    let sql = `CALL SP_CONSULTAR_PRIORIDAD()`;
    let result = await db.query(sql);
    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1]));
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}

async function consultarTipoDocumento(postData) {
  let response = {};
  try {
    let sql = `CALL SP_CONSULTAR_TIPO_DOCUMENTO()`;
    let result = await db.query(sql);
    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1]));
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}

async function consultarMedioRecepcion(postData) {
  let response = {};
  try {
    let sql = `CALL SP_CONSULTAR_MEDIO_RECEPCION()`;
    let result = await db.query(sql);
    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1]));
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}

async function consultarUnidadAdministrativa(postData) {
  let response = {};
  try {
    let sql = `CALL SP_CONSULTAR_UNIDAD_RESPONSABLE(?,?)`;
    let result = await db.query(sql, [
      postData.esUnidadAdministrativa || 0,
      postData.esUnidadDeNegocio || 0,
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

async function consultarInstruccion(postData) {
  let response = {};
  try {
    let sql = `CALL SP_CONSULTAR_INSTRUCCION()`;
    let result = await db.query(sql);
    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1]));
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}

async function consultarDependencia(postData) {
  let response = {};
  try {
    let sql = `CALL SP_CONSULTAR_DEPENDENCIAS(?,?)`;
    let result = await db.query(sql, [
      postData.idDependencia || 0,
      postData.opcion || 0,
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
async function consultarUsuarioRol(postData) {
    let response = {};
    try {
        let sql = `CALL SP_CONSULTAR_ROL_USUARIO(?)`;
        let result = await db.query(sql,[postData.idUsuarioRol || 0]);
        response = JSON.parse(JSON.stringify(result[0][0]));
        if (response.status == 200) {
            response.model = JSON.parse(JSON.stringify(result[1]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

    // registrar tema 
async function registrarTema(postData) {
  let response = {};
  try {
    let sql = 'CALL SP_REGISTRAR_TEMA(?)';
    let result = await db.query(sql, [postData.tema || null]);

    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1][0]));
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}
async function consultarCantidadesStatus(postData) {
  let response = {};
  try {
    let sql = `CALL SP_CONSULTAR_CANTIDADES_STATUS(?,?,?,?)`;
    let result = await db.query(sql, [
		postData.opcion, 
		postData.idUnidadResponsable || null,
    postData.idUsuario,
    postData.idUsuarioRol
	]);

    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status === 200) {
      response.model = JSON.parse(JSON.stringify(result[1])); 
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}
// async function consultarCantidadesStatus(postData) {
//   let response = {};
//   try {
//     let sql = `CALL SP_CONSULTAR_CANTIDADES_STATUS(?,?)`;
//     let result = await db.query(sql, [
// 		postData.opcion, 
// 		postData.idUnidadResponsable || null
// 	]);

//     response = JSON.parse(JSON.stringify(result[0][0]));
//     if (response.status === 200) {
//       response.model = JSON.parse(JSON.stringify(result[1])); 
//     }
//     return response;
//   } catch (ex) {
//     throw ex;
//   }
// }
async function registrarTipoDocumento(postData) {
    let response = {};
    try {
        let sql = 'CALL SP_REGISTRAR_TIPO_DOCUMENTO(?)';
        let result = await db.query(sql, [postData.tipoDocumento || null]);

        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status === 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

// funciones de determinantes
async function insertarDeterminantes(postData) {
  let response = {};
  try {
    let sql = 'CALL SP_REGISTRAR_DETERMINANTE(?,?,?,?,?,?)';
    let result = await db.query(sql, [
      postData.nivel || null,
      postData.unidadDeNegocio || null,
      postData.unidadAdministrativa || null,
      postData.area || null,
      postData.determinante || null,
      postData.dependencia || null,
    ]);
  
    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status === 200) {
      response.model = JSON.parse(JSON.stringify(result[1][0]));
    }
    return response;

  } catch(ex) {
    throw ex;
  }
}



async function consultarDeterminantes(postData) {
  let response = {};
  try {
    let sql = 'CALL SP_OBTENER_DETERMINANTE(?)';
    const id = Number(postData.id) || 0;
    let result = await db.query(sql, [id]);

    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      const dataSet = JSON.parse(JSON.stringify(result[1] || []));
      response.model = (id === 0) ? dataSet : (dataSet[0] || null);
    }
    return response;

  } catch(ex) {
    throw ex;
  }
}
 
async function actualizarDeterminantes(postData) {
  let response = {};
  try {
    let sql = 'CALL SP_ACTUALIZAR_DETERMINANTE(?,?,?,?,?,?,?)';
    let result = await db.query(sql, [
      postData.id || 0,
      postData.nivel || null,
      postData.unidadDeNegocio || null,
      postData.unidadAdministrativa || null,
      postData.area || null,
      postData.determinante || null, 
      postData.dependencia || null,
    ]);

    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1]?.[0] || {}));
    }
    return response;
  } catch(ex) {
    throw ex;
  }
}


async function desactivarDeterminantes(postData) {
  let response = {};
  try {
    let sql = 'CALL SP_ACTIVAR_DESACTIVAR_DETERMINANTE(?)';
    let result = await db.query(sql, [postData.id || 0]);

    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1][0]));
    }
    return response;
    
  } catch(ex) {
    throw ex;
  }
}

async function actualizarTema(postData) {
  let response = {};
  try {
    let sql = 'CALL SP_ACTUALIZAR_TEMA(?, ?)';
    let result = await db.query(sql, [postData.idTema || 0, postData.tema || null]);

    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status === 200) {
      response.model = JSON.parse(JSON.stringify(result[1][0]));
    }
    return response;
  } catch(ex) {
    throw ex;
  }
}

async function desactivarTema(postData) {
  let response = {};
  try {
    let sql = 'CALL SP_ACTIVAR_DESACTIVAR_TEMA(?)';
    let result = await db.query(sql, [postData.idTema || 0]);

    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status == 200) {
      response.model = JSON.parse(JSON.stringify(result[1][0]));
    }
    return response;
  } catch(ex) {
    throw ex;
  }
}


async function actualizarTipoDocumento(postData) {
    let response = {};
    try {
        let sql = 'CALL SP_ACTUALIZAR_TIPO_DOCUMENTO(?, ?)';
        let result = await db.query(sql, [postData.idTipoDocumento || 0, postData.tipoDocumento || null]);

        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status === 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}

async function activarDesactivarTipoDocumento(postData) {
    let response = {};
    try {
        let sql = 'CALL SP_ACTIVAR_DESACTIVAR_TIPO_DOCUMENTO(?)';
        let result = await db.query(sql, [postData.idTipoDocumento || 0]);

        response = JSON.parse(JSON.stringify(result[0][0]));

        if (response.status === 200) {
            response.model = JSON.parse(JSON.stringify(result[1][0]));
        }
        return response;
    } catch (ex) {
        throw ex;
    }
}



async function verReporte(postData) {
  let response = {};
  try {
    let sql = `CALL SP_VER_REPORTE(?, ?, ?)`;
    let result = await db.query(sql, [
      postData.fechaInicio || null,
      postData.fechaFin || null,
      postData.idUnidadResponsable || null,
    ]);

    response = JSON.parse(JSON.stringify(result[0][0])); 
    if (response.status === 200) {
      response.model = {
        totalAsuntos: result[1],
        asuntosPorStatus: result[2],
        tiempoPromedioAtencion: result[3],
        asuntosConcluidos: result[4],
        tiempoPorTema: result[5],
        asuntosPorTema: result[6],
        turnosPorUnidad: result[7],
        listaAsuntosPorUnidad: result[8],
        asuntosConUnidades: result[9],
        asuntosPorUnidadRespTotalTurnados: result[10],
        asuntosPorUnidadRespTotalUnidades: result[11],
      };
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}

async function generarExcel(postData) {
  let response = {};
  try {
    let sql = `CALL SP_GENERAR_EXCEL(?, ?, ?, ?)`;
    let result = await db.query(sql, [
      postData.fechaInicio || null,
      postData.fechaFin || null,
      postData.idUnidadResponsable || null,
      postData.idStatusAsunto || null,
    ]);

    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status === 200) {
      response.model = {
        totalAsuntos: result[1],
        asuntosPorStatus: result[2],
        detalleAsuntosPorEstatus: result[3],
        asuntosConcluidos: result[4],
        tiempoPorTema: result[5],
        asuntosPorTema: result[6],
      };
    }
    return response;
  } catch (ex) {
    throw ex;
  }
}

async function busquedaAvanzadaTurnados(postData) {
  let response = {};
  try {
    let sql = `CALL SP_BUSQUEDA_AVANZADA_TURNADOS(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    let result = await db.query(sql, [
      postData.fechaInicio || null,
      postData.fechaFin || null,
      postData.idUnidadResponsable || null, 
      postData.statusTurnado || null,       
      postData.idUsuarioTurna || null,      
      postData.idUsuarioContesta || null,   
      postData.idAsunto || null,
      postData.folio || null,
      postData.tipoOperacion || null,
      postData.conRespuesta ?? null,
      postData.soloRechazados ?? null,
      postData.consecutivo || null,
      postData.idInstruccion || null,
      postData.idTema || null,
      postData.statusAsunto || null,
      postData.ordenamiento || 'fecha',
      postData.direccion || 'DESC',
      postData.limite || 100, 
      postData.offset || 0,
      postData.idUnidadResponsableUsuario,
      postData.idUsuario,
      postData.idUsuarioRol,   
    ]);
    response = JSON.parse(JSON.stringify(result[0][0]));
    if (response.status === 200) {
      response.model = {
        distribucionPorStatus: result[1],
        detalleTurnados: result[2],
      };
    }
    return response;
  } catch (ex) {
    throw ex;
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
  actualizarTema,
  desactivarTema,  
  registrarTipoDocumento,
  actualizarTipoDocumento,
  activarDesactivarTipoDocumento,
  verReporte,
  generarExcel,
  busquedaAvanzadaTurnados,
  consultarCantidadesStatus
};
