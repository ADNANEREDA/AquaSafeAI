# Étape 1 : Construction (Build) de l'application React
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Étape 2 : Serveur de production (Nginx)
FROM nginx:latest
# On copie les fichiers compilés par Vite (dossier dist) vers le dossier public de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Configuration simple pour gérer le routage React (évite les erreurs 404 au rafraîchissement)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Nginx écoute par défaut sur le port 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]