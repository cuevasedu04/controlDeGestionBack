#!/bin/bash
# Sincroniza scg_ws/src/documentos hacia el servidor de respaldo vía rsync.
# Pensado para ejecutarse por cron cada 5 minutos.
#
# Requisito previo: clave SSH sin passphrase (o con agente) autorizada
# en el servidor de respaldo para el usuario que ejecuta este script.
#   ssh-keygen -t ed25519 -f ~/.ssh/id_backup -N ""
#   ssh-copy-id -i ~/.ssh/id_backup.pub usuario@169.58.230.126

set -euo pipefail

SRC="/home/dev/control-de-gestion/scg_ws/src/documentos/"
DEST_HOST="169.58.230.126"
DEST_USER="usuario"          # ajustar al usuario real del servidor de respaldo
DEST_PATH="/home/dev/control-de-gestion/scg_ws/src/documentos/"
SSH_KEY="$HOME/.ssh/id_backup"
LOG="/var/log/sync-documentos.log"

rsync -az --delete \
  -e "ssh -i ${SSH_KEY} -o ConnectTimeout=10" \
  "${SRC}" "${DEST_USER}@${DEST_HOST}:${DEST_PATH}" \
  >> "${LOG}" 2>&1

echo "$(date '+%Y-%m-%d %H:%M:%S') sync OK" >> "${LOG}"
