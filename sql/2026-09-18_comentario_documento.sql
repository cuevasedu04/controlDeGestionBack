-- =====================================================================
-- Comentario de revisión en los documentos del expediente de un asunto.
--
-- Pantalla: Asuntos registrados > (asunto) > pestaña Expediente.
-- Aplica al Documento Principal y a cada Anexo.
--
-- Es UN comentario por documento, editable: al guardar se sobrescribe.
-- Guardar el texto vacío borra el comentario.
--
-- Quién puede escribir: los roles 1 (Admin) y 2 (Gestor). Se valida en el
-- SP además de en el front. Para permitir más roles, agrégalos al IN de
-- SP_GUARDAR_COMENTARIO_DOCUMENTO — es el único lugar que cambiar.
--
-- El 2026-09-24 se sumó el Admin: podía subir antecedentes pero no
-- comentarlos, y la asimetría no tenía razón de ser.
--
-- Se llama comentarioRevision y es TEXT para igualar la columna que ya
-- existe en sadrh_tbl_documento_acuerdo del módulo SADRH, que resuelve
-- justo esto mismo. Lo que NO se copia de allá es reusar fechaModificacion
-- e idUsuarioModifica para la autoría: en esta tabla esas dos ya significan
-- «cuándo se reemplazó el documento», así que la autoría va aparte.
--
-- Aplicar en: scg_db_backup (y después en scg_db cuando se libere).
-- Es idempotente: se puede correr varias veces sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Las tres columnas nuevas en la tabla que ya existe.
--    No se creó tabla aparte porque es un solo comentario por documento.
-- ---------------------------------------------------------------------
SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE scg_tbl_documentos_asunto
            ADD COLUMN comentarioRevision  TEXT          NULL AFTER size,
            ADD COLUMN fechaComentario     TIMESTAMP     NULL AFTER comentarioRevision,
            ADD COLUMN idUsuarioComentario INT           NULL AFTER fechaComentario',
        'SELECT ''Las columnas de comentario ya existen, no se hace nada.'' AS aviso'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'scg_tbl_documentos_asunto'
      AND COLUMN_NAME  = 'comentarioRevision'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ---------------------------------------------------------------------
-- 2. Guardar / editar / borrar el comentario de un documento.
--
--    _comentario vacío o NULL  ->  se borra el comentario.
--    Devuelve dos result sets, como el resto de los SP del sistema:
--      [0] status + message
--      [1] el comentario ya guardado (solo si status = 200)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS SP_GUARDAR_COMENTARIO_DOCUMENTO;
DELIMITER $$
CREATE PROCEDURE SP_GUARDAR_COMENTARIO_DOCUMENTO (
    IN _idDocumentoAsunto INT,
    IN _comentario        TEXT,
    IN _idUsuario         INT
)
BEGIN
    DECLARE _existeDocumento INT DEFAULT 0;
    DECLARE _rolUsuario      INT DEFAULT NULL;
    DECLARE _texto           TEXT DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 500 AS status,
               'Ocurrió un error al guardar el comentario.' AS message;
    END;

    -- Texto limpio: espacios de sobra fuera, y '' se vuelve NULL (borrar).
    SET _texto = NULLIF(TRIM(IFNULL(_comentario, '')), '');

    SELECT COUNT(*) INTO _existeDocumento
      FROM scg_tbl_documentos_asunto
     WHERE idDocumentoAsunto = _idDocumentoAsunto
       AND IFNULL(activo, 1) = 1;

    SELECT idUsuarioRol INTO _rolUsuario
      FROM scg_tbl_usuario
     WHERE idUsuario = _idUsuario
       AND IFNULL(activo, 1) = 1
     LIMIT 1;

    IF _existeDocumento = 0 THEN
        SELECT 404 AS status,
               'El documento no existe o fue eliminado.' AS message;

    ELSEIF _rolUsuario IS NULL THEN
        SELECT 401 AS status,
               'Sesión de usuario no válida.' AS message;

    -- Comentan el Admin y el Gestor. Agrega roles a este IN si eso cambia.
    ELSEIF _rolUsuario NOT IN (1, 2) THEN
        SELECT 403 AS status,
               'No tiene permiso para comentar documentos.' AS message;

    ELSE
        START TRANSACTION;

        UPDATE scg_tbl_documentos_asunto
           SET comentarioRevision  = _texto,
               fechaComentario     = IF(_texto IS NULL, NULL, CURRENT_TIMESTAMP),
               idUsuarioComentario = IF(_texto IS NULL, NULL, _idUsuario)
         WHERE idDocumentoAsunto = _idDocumentoAsunto;

        COMMIT;

        SELECT 200 AS status,
               IF(_texto IS NULL,
                  'Comentario eliminado.',
                  'Comentario guardado.') AS message;

        -- La fecha va como texto ya formateado a propósito: el pool de
        -- Node está en UTC y convertir un TIMESTAMP recorre la hora.
        SELECT d.idDocumentoAsunto,
               d.comentarioRevision,
               DATE_FORMAT(d.fechaComentario, '%d/%m/%Y %H:%i') AS fechaComentario,
               d.idUsuarioComentario,
               TRIM(CONCAT_WS(' ', u.nombre, u.primerApellido, u.segundoApellido))
                   AS usuarioComentario
          FROM scg_tbl_documentos_asunto d
          LEFT JOIN scg_tbl_usuario u ON u.idUsuario = d.idUsuarioComentario
         WHERE d.idDocumentoAsunto = _idDocumentoAsunto;
    END IF;
END$$
DELIMITER ;


-- ---------------------------------------------------------------------
-- 3. Traer de un jalón los comentarios de todos los documentos de un
--    asunto (principal, anexos, respuestas...). El front los cruza por
--    idDocumentoAsunto.
--
--    Se hizo SP aparte en vez de tocar SP_CONSULTAR_EXPEDIENTE_ASUNTO
--    para no alterar algo que ya funciona.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS SP_CONSULTAR_COMENTARIOS_DOCUMENTOS;
DELIMITER $$
CREATE PROCEDURE SP_CONSULTAR_COMENTARIOS_DOCUMENTOS (
    IN _idAsunto INT
)
BEGIN
    SELECT 200 AS status, 'OK.' AS message;

    SELECT d.idDocumentoAsunto,
           d.comentarioRevision,
           DATE_FORMAT(d.fechaComentario, '%d/%m/%Y %H:%i') AS fechaComentario,
           d.idUsuarioComentario,
           TRIM(CONCAT_WS(' ', u.nombre, u.primerApellido, u.segundoApellido))
               AS usuarioComentario
      FROM scg_tbl_documentos_asunto d
      LEFT JOIN scg_tbl_usuario u ON u.idUsuario = d.idUsuarioComentario
     WHERE d.idAsunto = _idAsunto
       AND IFNULL(d.activo, 1) = 1
       AND d.comentarioRevision IS NOT NULL;
END$$
DELIMITER ;
