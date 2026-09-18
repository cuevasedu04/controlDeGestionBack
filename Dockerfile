FROM node:20-alpine

WORKDIR /app

# Copiar solo los archivos de dependencias primero
COPY package*.json ./

# Instalar las dependencias
RUN npm install --production

# Copiar el resto del código fuente
COPY . .

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=8080

# Exponer el puerto según tu configuración de producción
EXPOSE 8080

# Iniciar la aplicación
CMD ["npm", "start"]
