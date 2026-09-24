-- =====================================================================
-- Alcance: un asunto que continúa a otro.
--
-- Autor: Benilde Rodríguez — 2026-09-24
--
-- Se marca al registrar —casilla «Es alcance», que abre un buscador— y
-- también desde el expediente, que es la red de seguridad: el alta y el
-- vínculo son dos llamadas, y si la segunda falla el asunto quedaría suelto.
-- Se dejaron en dos a propósito, para no tocar SP_REGISTRAR_ASUNTO, que es
-- el corazón del sistema y ya corre en producción.
--
-- Reglas acordadas:
--   · el origen puede ser un asunto en cualquier estado
--   · un asunto admite varios alcances, y un alcance puede tener el suyo
--     (cadena) — por eso hay control de ciclos
--   · se puede desvincular, y queda en la bitácora
--
-- ESTRUCTURA: se sigue el patrón que ya usa SADRH en este mismo sistema
-- —un solo procedimiento con parámetro de acción, como
-- SP_GESTIONAR_ACUERDO— en vez de crear uno por operación. El buscador va
-- aparte porque no es del alcance: sirve para buscar asuntos desde
-- cualquier pantalla.
--
-- La bitácora usa ASUNTO_EDITADO: su columna tipoOperacion es un enum
-- cerrado, y agregarle un valor sería modificar una columna que ya existe.
-- Vincular es una edición del asunto, así que el tipo le queda.
--
-- Aplicar en: scg_db_backup (y en scg_db cuando se libere).
-- Es idempotente: se puede correr varias veces.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La columna del vínculo. Apunta al asunto que este continúa.
-- ---------------------------------------------------------------------
SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE scg_tbl_asunto
            ADD COLUMN idAsuntoOrigen BIGINT NULL AFTER idAsunto',
        'SELECT ''La columna idAsuntoOrigen ya existe, no se hace nada.'' AS aviso'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'scg_tbl_asunto'
      AND COLUMN_NAME  = 'idAsuntoOrigen'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice para que buscar «los alcances de este asunto» no recorra la tabla.
SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'CREATE INDEX idx_asunto_origen ON scg_tbl_asunto (idAsuntoOrigen)',
        'SELECT ''El índice idx_asunto_origen ya existe.'' AS aviso'
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'scg_tbl_asunto'
      AND INDEX_NAME   = 'idx_asunto_origen'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ---------------------------------------------------------------------
-- 2. Buscador de asuntos: por número de oficio, descripción, volante o
--    folio. Va aparte del alcance porque no le pertenece: cualquier
--    pantalla que necesite buscar un asunto puede usarlo.
--
--    Busca en el servidor y no en el navegador porque la tabla ronda los
--    6,700 asuntos y el modal no necesita traerlos todos.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS SP_BUSCAR_ASUNTOS;
DELIMITER $$
CREATE PROCEDURE SP_BUSCAR_ASUNTOS (
    IN _termino   VARCHAR(255),
    IN _idExcluir BIGINT,
    IN _limite    INT
)
COMMENT 'Busca asuntos por oficio, descripción, volante o folio. Autor: Benilde Rodríguez, 2026-09-24.'
BEGIN
    -- La intercalación va explícita porque esta tabla las tiene mezcladas:
    -- noOficio es utf8mb4_0900_ai_ci y descripcionAsunto, folio y
    -- numeroVolante son utf8mb4_unicode_ci. Comparar entre las dos falla con
    -- «Illegal mix of collations», así que aquí se normalizan ambos lados y
    -- la búsqueda deja de depender de cómo quedó cada columna.
    DECLARE _patron VARCHAR(259) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;

    SET _termino = NULLIF(TRIM(IFNULL(_termino, '')), '');
    SET _limite  = IFNULL(NULLIF(_limite, 0), 50);
    SET _patron  = CONCAT('%', _termino, '%');

    IF _termino IS NULL THEN
        SELECT 100 AS status, 'Escribe algo para buscar.' AS message;
    ELSE
        SELECT 200 AS status, 'OK.' AS message;

        SELECT a.idAsunto,
               a.folio,
               a.noOficio,
               a.numeroVolante,
               a.descripcionAsunto,
               a.remitenteNombre,
               a.statusAsunto,
               DATE_FORMAT(a.fechaRecepcion, '%d/%m/%Y') AS fechaRecepcion
          FROM scg_tbl_asunto a
         WHERE IFNULL(a.activo, 1) = 1
           AND (_idExcluir IS NULL OR a.idAsunto <> _idExcluir)
           AND (   a.noOficio          COLLATE utf8mb4_unicode_ci LIKE _patron
                OR a.descripcionAsunto COLLATE utf8mb4_unicode_ci LIKE _patron
                OR a.numeroVolante     COLLATE utf8mb4_unicode_ci LIKE _patron
                OR a.folio             COLLATE utf8mb4_unicode_ci LIKE _patron )
         ORDER BY a.fechaRecepcion DESC
         LIMIT _limite;
    END IF;
END$$
DELIMITER ;


-- ---------------------------------------------------------------------
-- 3. El alcance, en un solo procedimiento con parámetro de acción —el
--    mismo patrón de SP_GESTIONAR_ACUERDO en SADRH.
--
--    CONSULTAR   devuelve las dos direcciones del enlace
--    VINCULAR    enlaza este asunto con su origen
--    DESVINCULAR quita el enlace
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS SP_GESTIONAR_ALCANCE;
DELIMITER $$
CREATE PROCEDURE SP_GESTIONAR_ALCANCE (
    IN _accion         VARCHAR(20),
    IN _idAsunto       BIGINT,
    IN _idAsuntoOrigen BIGINT,
    IN _idUsuario      INT,
    IN _ipOrigen       VARCHAR(45)
)
COMMENT 'Alcance entre asuntos: CONSULTAR, VINCULAR, DESVINCULAR. Autor: Benilde Rodríguez, 2026-09-24.'
BEGIN
    DECLARE _existe        INT DEFAULT 0;
    DECLARE _existeOrigen  INT DEFAULT 0;
    DECLARE _rolUsuario    INT DEFAULT NULL;
    DECLARE _nombreUsuario VARCHAR(255) DEFAULT NULL;
    DECLARE _folio         VARCHAR(55)  DEFAULT NULL;
    DECLARE _status        VARCHAR(255) DEFAULT NULL;
    DECLARE _origenPrevio  BIGINT DEFAULT NULL;
    DECLARE _hayCiclo      INT DEFAULT 0;
    DECLARE _cursor        BIGINT DEFAULT NULL;
    DECLARE _saltos        INT DEFAULT 0;
    DECLARE _antes         TEXT DEFAULT NULL;
    DECLARE _despues       TEXT DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 500 AS status, 'Ocurrió un error al gestionar el alcance.' AS message;
    END;

    SET _accion = UPPER(TRIM(IFNULL(_accion, '')));

    -- Desvincular es vincular con origen vacío: así la escritura vive en
    -- un solo camino y no hay dos lugares que puedan divergir.
    IF _accion = 'DESVINCULAR' THEN
        SET _idAsuntoOrigen = NULL;
    END IF;

    SELECT COUNT(*) INTO _existe
      FROM scg_tbl_asunto
     WHERE idAsunto = _idAsunto AND IFNULL(activo, 1) = 1;

    -- =========================== CONSULTAR ===========================
    IF _accion = 'CONSULTAR' THEN
        IF _existe = 0 THEN
            SELECT 404 AS status, 'El asunto no existe o fue dado de baja.' AS message;
        ELSE
            SELECT 200 AS status, 'OK.' AS message;

            -- El asunto del que este es alcance.
            SELECT o.idAsunto, o.folio, o.noOficio, o.descripcionAsunto,
                   o.statusAsunto,
                   DATE_FORMAT(o.fechaRecepcion, '%d/%m/%Y') AS fechaRecepcion
              FROM scg_tbl_asunto a
              JOIN scg_tbl_asunto o ON o.idAsunto = a.idAsuntoOrigen
             WHERE a.idAsunto = _idAsunto
               AND IFNULL(o.activo, 1) = 1;

            -- Los asuntos que son alcance de este.
            SELECT d.idAsunto, d.folio, d.noOficio, d.descripcionAsunto,
                   d.statusAsunto,
                   DATE_FORMAT(d.fechaRecepcion, '%d/%m/%Y') AS fechaRecepcion
              FROM scg_tbl_asunto d
             WHERE d.idAsuntoOrigen = _idAsunto
               AND IFNULL(d.activo, 1) = 1
             ORDER BY d.fechaRecepcion DESC;
        END IF;

    -- ==================== VINCULAR / DESVINCULAR =====================
    ELSEIF _accion IN ('VINCULAR', 'DESVINCULAR') THEN

        IF _idAsuntoOrigen IS NOT NULL THEN
            SELECT COUNT(*) INTO _existeOrigen
              FROM scg_tbl_asunto
             WHERE idAsunto = _idAsuntoOrigen AND IFNULL(activo, 1) = 1;
        END IF;

        SELECT idUsuarioRol,
               TRIM(CONCAT_WS(' ', nombre, primerApellido, segundoApellido))
          INTO _rolUsuario, _nombreUsuario
          FROM scg_tbl_usuario
         WHERE idUsuario = _idUsuario AND IFNULL(activo, 1) = 1
         LIMIT 1;

        -- Control de ciclos: se sube por la cadena del origen propuesto. Si
        -- en el camino aparece este mismo asunto, el vínculo cerraría un
        -- círculo y el expediente quedaría dando vueltas. El tope de saltos
        -- protege además de un ciclo que ya estuviera en los datos.
        IF _idAsuntoOrigen IS NOT NULL AND _idAsuntoOrigen <> _idAsunto THEN
            SET _cursor = _idAsuntoOrigen;
            WHILE _cursor IS NOT NULL AND _saltos < 50 AND _hayCiclo = 0 DO
                IF _cursor = _idAsunto THEN
                    SET _hayCiclo = 1;
                ELSE
                    SELECT idAsuntoOrigen INTO _cursor
                      FROM scg_tbl_asunto WHERE idAsunto = _cursor LIMIT 1;
                    SET _saltos = _saltos + 1;
                END IF;
            END WHILE;
        END IF;

        IF _existe = 0 THEN
            SELECT 404 AS status, 'El asunto no existe o fue dado de baja.' AS message;

        ELSEIF _idAsuntoOrigen IS NOT NULL AND _existeOrigen = 0 THEN
            SELECT 404 AS status, 'El asunto que se quiere enlazar no existe.' AS message;

        ELSEIF _rolUsuario IS NULL THEN
            SELECT 401 AS status, 'Sesión de usuario no válida.' AS message;

        ELSEIF _rolUsuario NOT IN (1, 2) THEN
            SELECT 403 AS status, 'No tiene permiso para enlazar asuntos.' AS message;

        ELSEIF _idAsuntoOrigen = _idAsunto THEN
            SELECT 409 AS status, 'Un asunto no puede ser alcance de sí mismo.' AS message;

        ELSEIF _hayCiclo = 1 THEN
            SELECT 409 AS status,
                   'Ese asunto ya proviene de este, y enlazarlos cerraría un círculo.' AS message;

        ELSE
            SELECT folio, statusAsunto, idAsuntoOrigen
              INTO _folio, _status, _origenPrevio
              FROM scg_tbl_asunto WHERE idAsunto = _idAsunto;

            SET _antes   = CONCAT('AsuntoOrigen: ', IFNULL(_origenPrevio, 'ninguno'));
            SET _despues = CONCAT('AsuntoOrigen: ', IFNULL(_idAsuntoOrigen, 'ninguno'));

            START TRANSACTION;

            UPDATE scg_tbl_asunto
               SET idAsuntoOrigen      = _idAsuntoOrigen,
                   idUsuarioModifica   = _idUsuario,
                   `fechaModificación` = CURRENT_TIMESTAMP
             WHERE idAsunto = _idAsunto;

            INSERT INTO scg_tbl_hist_asuntos_registrados
                (idAsunto, folio, tipoOperacion, idUsuarioModifica, usuarioModifica,
                 statusAnterior, statusNuevo, valorAnterior, valorNuevo,
                 ipOrigen, fechaModificacion)
            VALUES
                (_idAsunto, _folio, 'ASUNTO_EDITADO', _idUsuario, _nombreUsuario,
                 _status, _status, _antes, _despues,
                 _ipOrigen, CURRENT_TIMESTAMP);

            COMMIT;

            SELECT 200 AS status,
                   IF(_idAsuntoOrigen IS NULL,
                      'El enlace se quitó.',
                      'El asunto quedó enlazado.') AS message;
        END IF;

    ELSE
        SELECT 400 AS status,
               CONCAT('Acción no reconocida: ', IFNULL(_accion, '')) AS message;
    END IF;
END$$
DELIMITER ;


-- ---------------------------------------------------------------------
-- 4. Se retira SP_VINCULAR_ALCANCE, que quedó absorbido por
--    SP_GESTIONAR_ALCANCE. Solo existió en desarrollo; nunca se aplicó en
--    producción.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS SP_VINCULAR_ALCANCE;
DROP PROCEDURE IF EXISTS SP_CONSULTAR_ALCANCES;
