FROM node:20-alpine AS builder

WORKDIR /app

COPY qwen3-tts-frontend/package*.json ./
RUN npm ci

COPY qwen3-tts-frontend/ .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
