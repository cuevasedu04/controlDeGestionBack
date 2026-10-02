-- =====================================================================
-- SP_EDITAR_ASUNTO_COMPLETO
--
-- Edición de la información general de un asunto por los roles 1 y 2,
-- en cualquier estado.
--
-- Nace al lado de SP_EDITAR_ASUNTO, que NO se toca ni se reemplaza:
-- sigue ahí por si algo más lo llama. Este existe por dos razones:
--
--   1. El viejo no guarda dirigidoADependencia. El campo se podía escribir
--      en pantalla y se perdía al guardar.
--   2. El viejo no se puede leer ni modificar: el usuario de base de datos
--      no tiene el privilegio SHOW_ROUTINE, así que cambiarlo habría
--      significado reescribirlo a ciegas.
--
-- Deja rastro en scg_tbl_hist_asuntos_registrados como ASUNTO_EDITADO, con
-- el antes, el después, el usuario y la IP. Esto importa porque se pueden
-- editar asuntos ya Concluidos: nada se cambia en silencio.
--
-- RECIBE EXACTAMENTE LOS CAMPOS QUE LA PANTALLA DEJA EDITAR. Tres quedan
-- fuera a propósito:
--
--   · idStatusAsunto  — el estado se mueve por sus propios flujos
--                       (concluir, cancelar, turnar), que exigen documento
--                       y validaciones. Abrirlo aquí permitiría marcar
--                       «Concluido» sin conclusión.
--   · folio           — es el consecutivo oficial y no se muestra en la
--                       pantalla de detalle. No se edita lo que no se ve.
--   · idUnidadAdministrativa — su id y su texto están desalineados en los
--                       datos: el asunto guarda «Recursos Humanos» con id 1,
--                       pero en el catálogo el id 1 es «Agencia Nacional de
--                       Aduanas de México». Sincronizarlo aquí cambiaría el
--                       texto de todos los asuntos sin que nadie lo pida.
--
-- Aplicar en: scg_db_backup (y en scg_db cuando se libere).
-- Es idempotente: se puede correr varias veces.
-- =====================================================================

DROP PROCEDURE IF EXISTS SP_EDITAR_ASUNTO_COMPLETO;
DELIMITER $$
CREATE PROCEDURE SP_EDITAR_ASUNTO_COMPLETO (
    IN _idAsunto             BIGINT,
    IN _idTipoDocumento      INT,
    IN _noOficio             VARCHAR(255),
    IN _esVolante            TINYINT,
    IN _numeroVolante        VARCHAR(255),
    IN _esGuia               TINYINT,
    IN _numeroGuia           VARCHAR(255),
    IN _fechaDocumento       DATETIME,
    IN _fechaRecepcion       DATETIME,
    IN _remitenteNombre      VARCHAR(255),
    IN _remitenteCargo       VARCHAR(255),
    IN _remitenteDependencia VARCHAR(255),
    IN _dirigidoA            VARCHAR(255),
    IN _dirigidoACargo       VARCHAR(255),
    IN _dirigidoADependencia VARCHAR(255),
    IN _descripcionAsunto    TEXT,
    IN _idTema               INT,
    IN _fechaCumplimiento    DATETIME,
    IN _idMedio              INT,
    IN _idPrioridad          INT,
    IN _observaciones        TEXT,
    IN _idUsuarioModifica    INT,
    IN _ipOrigen             VARCHAR(45)
)
BEGIN
    DECLARE _existe        INT DEFAULT 0;
    DECLARE _rolUsuario    INT DEFAULT NULL;
    DECLARE _nombreUsuario VARCHAR(255) DEFAULT NULL;
    DECLARE _folio         VARCHAR(55)  DEFAULT NULL;
    DECLARE _status        VARCHAR(255) DEFAULT NULL;
    DECLARE _antes         TEXT DEFAULT NULL;
    DECLARE _despues       TEXT DEFAULT NULL;

    -- Textos que acompañan a los ids: la tabla los guarda duplicados y hay
    -- que mantenerlos en sincronía, o la pantalla muestra el valor viejo.
    DECLARE _txtTipoDoc VARCHAR(255) DEFAULT NULL;
    DECLARE _txtTema    VARCHAR(255) DEFAULT NULL;
    DECLARE _txtMedio   VARCHAR(255) DEFAULT NULL;
    DECLARE _txtPrior   VARCHAR(255) DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 500 AS status,
               'Ocurrió un error al guardar los cambios del asunto.' AS message;
    END;

    SELECT COUNT(*) INTO _existe
      FROM scg_tbl_asunto
     WHERE idAsunto = _idAsunto
       AND IFNULL(activo, 1) = 1;

    SELECT idUsuarioRol,
           TRIM(CONCAT_WS(' ', nombre, primerApellido, segundoApellido))
      INTO _rolUsuario, _nombreUsuario
      FROM scg_tbl_usuario
     WHERE idUsuario = _idUsuarioModifica
       AND IFNULL(activo, 1) = 1
     LIMIT 1;

    IF _existe = 0 THEN
        SELECT 404 AS status,
               'El asunto no existe o fue dado de baja.' AS message;

    ELSEIF _rolUsuario IS NULL THEN
        SELECT 401 AS status,
               'Sesión de usuario no válida.' AS message;

    -- Editan el Admin y el Gestor. Agrega roles a este IN si eso cambia.
    ELSEIF _rolUsuario NOT IN (1, 2) THEN
        SELECT 403 AS status,
               'No tiene permiso para editar la información del asunto.' AS message;

    ELSE
        -- Los textos de catálogo. Si el id no existe se queda en NULL y más
        -- abajo se conserva el valor anterior.
        SELECT tipoDocumento  INTO _txtTipoDoc FROM scg_cat_tipo_documento  WHERE idTipoDocumento  = _idTipoDocumento LIMIT 1;
        SELECT tema           INTO _txtTema    FROM scg_cat_tema            WHERE idTema           = _idTema          LIMIT 1;
        SELECT medioRecepcion INTO _txtMedio   FROM scg_cat_medio_recepcion WHERE idMedioRecepcion = _idMedio         LIMIT 1;
        SELECT prioridad      INTO _txtPrior   FROM scg_cat_prioridad       WHERE idPrioridad      = _idPrioridad     LIMIT 1;

        -- Foto del antes. Solo los campos que este procedimiento puede
        -- cambiar: así el antes y el después se comparan renglón a renglón.
        SELECT folio,
               statusAsunto,
               CONCAT_WS(' | ',
                   CONCAT('TipoDoc: ',              IFNULL(tipoDocumento, '')),
                   CONCAT('NoOficio: ',             IFNULL(noOficio, '')),
                   CONCAT('EsVolante: ',            IF(IFNULL(esVolante, 0) = 1, 'Sí', 'No')),
                   CONCAT('NumeroVolante: ',        IFNULL(numeroVolante, '')),
                   CONCAT('EsGuia: ',               IF(IFNULL(esGuia, 0) = 1, 'Sí', 'No')),
                   CONCAT('NumeroGuia: ',           IFNULL(numeroGuia, '')),
                   CONCAT('FechaDocumento: ',       IFNULL(fechaDocumento, '')),
                   CONCAT('FechaRecepcion: ',       IFNULL(fechaRecepcion, '')),
                   CONCAT('RemitenteNombre: ',      IFNULL(remitenteNombre, '')),
                   CONCAT('RemitenteCargo: ',       IFNULL(remitenteCargo, '')),
                   CONCAT('RemitenteDependencia: ', IFNULL(remitenteDependencia, '')),
                   CONCAT('DirigidoA: ',            IFNULL(dirigidoA, '')),
                   CONCAT('DirigidoACargo: ',       IFNULL(dirigidoACargo, '')),
                   CONCAT('DirigidoADependencia: ', IFNULL(dirigidoADependencia, '')),
                   CONCAT('Descripcion: ',          IFNULL(descripcionAsunto, '')),
                   CONCAT('Tema: ',                 IFNULL(Tema, '')),
                   CONCAT('FechaCumplimiento: ',    IFNULL(fechaCumplimiento, '')),
                   CONCAT('Medio: ',                IFNULL(medio, '')),
                   CONCAT('Prioridad: ',            IFNULL(prioridad, '')),
                   CONCAT('Observaciones: ',        IFNULL(observaciones, ''))
               )
          INTO _folio, _status, _antes
          FROM scg_tbl_asunto
         WHERE idAsunto = _idAsunto;

        START TRANSACTION;

        UPDATE scg_tbl_asunto
           SET idTipoDocumento      = IFNULL(_idTipoDocumento, idTipoDocumento),
               tipoDocumento        = IFNULL(_txtTipoDoc, tipoDocumento),
               noOficio             = IFNULL(_noOficio, noOficio),
               esVolante            = IFNULL(_esVolante, esVolante),
               -- El número solo tiene sentido si la casilla está marcada;
               -- al desmarcarla se limpia, como en el alta.
               numeroVolante        = IF(IFNULL(_esVolante, esVolante) = 1, _numeroVolante, NULL),
               esGuia               = IFNULL(_esGuia, esGuia),
               numeroGuia           = IF(IFNULL(_esGuia, esGuia) = 1, _numeroGuia, NULL),
               fechaDocumento       = _fechaDocumento,
               fechaRecepcion       = _fechaRecepcion,
               remitenteNombre      = _remitenteNombre,
               remitenteCargo       = _remitenteCargo,
               remitenteDependencia = _remitenteDependencia,
               dirigidoA            = _dirigidoA,
               dirigidoACargo       = _dirigidoACargo,
               dirigidoADependencia = _dirigidoADependencia,
               descripcionAsunto    = _descripcionAsunto,
               idTema               = IFNULL(_idTema, idTema),
               Tema                 = IFNULL(_txtTema, Tema),
               fechaCumplimiento    = _fechaCumplimiento,
               idMedio              = IFNULL(_idMedio, idMedio),
               medio                = IFNULL(_txtMedio, medio),
               idPrioridad          = IFNULL(_idPrioridad, idPrioridad),
               prioridad            = IFNULL(_txtPrior, prioridad),
               observaciones        = _observaciones,
               idUsuarioModifica    = _idUsuarioModifica,
               `fechaModificación`  = CURRENT_TIMESTAMP
         WHERE idAsunto = _idAsunto;

        -- Foto del después, ya con los cambios aplicados.
        SELECT CONCAT_WS(' | ',
                   CONCAT('TipoDoc: ',              IFNULL(tipoDocumento, '')),
                   CONCAT('NoOficio: ',             IFNULL(noOficio, '')),
                   CONCAT('EsVolante: ',            IF(IFNULL(esVolante, 0) = 1, 'Sí', 'No')),
                   CONCAT('NumeroVolante: ',        IFNULL(numeroVolante, '')),
                   CONCAT('EsGuia: ',               IF(IFNULL(esGuia, 0) = 1, 'Sí', 'No')),
                   CONCAT('NumeroGuia: ',           IFNULL(numeroGuia, '')),
                   CONCAT('FechaDocumento: ',       IFNULL(fechaDocumento, '')),
                   CONCAT('FechaRecepcion: ',       IFNULL(fechaRecepcion, '')),
                   CONCAT('RemitenteNombre: ',      IFNULL(remitenteNombre, '')),
                   CONCAT('RemitenteCargo: ',       IFNULL(remitenteCargo, '')),
                   CONCAT('RemitenteDependencia: ', IFNULL(remitenteDependencia, '')),
                   CONCAT('DirigidoA: ',            IFNULL(dirigidoA, '')),
                   CONCAT('DirigidoACargo: ',       IFNULL(dirigidoACargo, '')),
                   CONCAT('DirigidoADependencia: ', IFNULL(dirigidoADependencia, '')),
                   CONCAT('Descripcion: ',          IFNULL(descripcionAsunto, '')),
                   CONCAT('Tema: ',                 IFNULL(Tema, '')),
                   CONCAT('FechaCumplimiento: ',    IFNULL(fechaCumplimiento, '')),
                   CONCAT('Medio: ',                IFNULL(medio, '')),
                   CONCAT('Prioridad: ',            IFNULL(prioridad, '')),
                   CONCAT('Observaciones: ',        IFNULL(observaciones, ''))
               )
          INTO _despues
          FROM scg_tbl_asunto
         WHERE idAsunto = _idAsunto;

        INSERT INTO scg_tbl_hist_asuntos_registrados
            (idAsunto, folio, tipoOperacion, idUsuarioModifica, usuarioModifica,
             statusAnterior, statusNuevo, valorAnterior, valorNuevo,
             ipOrigen, fechaModificacion)
        VALUES
            (_idAsunto, _folio, 'ASUNTO_EDITADO', _idUsuarioModifica, _nombreUsuario,
             _status, _status, _antes, _despues,
             _ipOrigen, CURRENT_TIMESTAMP);

        COMMIT;

        SELECT 200 AS status,
               'Los cambios del asunto se guardaron.' AS message;

        SELECT idAsunto, folio, idTipoDocumento, tipoDocumento, noOficio,
               esVolante, numeroVolante, esGuia, numeroGuia,
               fechaDocumento, fechaRecepcion,
               remitenteNombre, remitenteCargo, remitenteDependencia,
               dirigidoA, dirigidoACargo, dirigidoADependencia, descripcionAsunto,
               idTema, Tema, fechaCumplimiento, idMedio, medio,
               idPrioridad, prioridad, observaciones,
               idStatusAsunto, statusAsunto
          FROM scg_tbl_asunto
         WHERE idAsunto = _idAsunto;
    END IF;
END$$
DELIMITER ;
