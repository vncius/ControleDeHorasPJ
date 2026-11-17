# Frontend em container (docker-compose.yml na raiz): build do Vite servido
# pelo nginx, que também faz o papel do proxy /api do Cloudflare Pages
# (same-origin, cookie de sessão first-party).
FROM node:22.23.4-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Variáveis VITE_* entram no bundle em tempo de build. VITE_API_URL fica
# indefinida de propósito: a API é chamada em /api relativo (nginx).
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_LEGAL_CONTROLADOR=
ARG VITE_LEGAL_CONTATO=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_LEGAL_CONTROLADOR=$VITE_LEGAL_CONTROLADOR \
    VITE_LEGAL_CONTATO=$VITE_LEGAL_CONTATO
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
