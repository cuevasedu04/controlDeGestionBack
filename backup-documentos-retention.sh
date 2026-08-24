#!/bin/bash
# Snapshot diario con retención de scg_ws/src/documentos.
# Se ejecuta EN EL SERVIDOR DE RESPALDO, sobre su propia copia local
# (la que ya mantiene al día el espejo en vivo de sync-documentos.sh).
# Objetivo: protegerse de borrados/corrupciones que el espejo en vivo
# replicaría igualmente, guardando versiones diarias por N días.
#
# Usa rsync --link-dest: cada snapshot solo ocupa espacio por los
# archivos que cambiaron respecto al día anterior (hardlinks para el resto).

set -euo pipefail

SRC="/home/dev/control-de-gestion/scg_ws/src/documentos/"
BACKUP_ROOT="/home/dev/backups/documentos"
RETENTION_DAYS=14
DATE="$(date +%F)"
LOG="/var/log/backup-documentos-retention.log"

mkdir -p "${BACKUP_ROOT}"

rsync -a --delete \
  --link-dest="${BACKUP_ROOT}/latest" \
  "${SRC}" "${BACKUP_ROOT}/${DATE}/" \
  >> "${LOG}" 2>&1

rm -f "${BACKUP_ROOT}/latest"
ln -s "${BACKUP_ROOT}/${DATE}" "${BACKUP_ROOT}/latest"

# Eliminar snapshots con más de RETENTION_DAYS días
find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "20*" -mtime "+${RETENTION_DAYS}" -exec rm -rf {} \;

echo "$(date '+%Y-%m-%d %H:%M:%S') snapshot ${DATE} OK" >> "${LOG}"
