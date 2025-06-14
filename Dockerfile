# Этап 1: Сборка фронтенд-приложения
FROM node:18-alpine AS build-frontend
WORKDIR /app/frontend
# Копируем файлы пакетов и устанавливаем зависимости фронтенда
COPY frontend/package.json frontend/package-lock.json ./ 
RUN npm install
# Копируем остальной исходник фронтенда и собираем билд
COPY frontend/. .
RUN npm run build

# Этап 2: Сборка финального образа с бекендом и готовым фронтендом
FROM node:18-alpine
WORKDIR /app
# Копируем файлы пакетов и устанавливаем зависимости бэкенда
COPY backend/package.json backend/package-lock.json ./ 
RUN npm install
# Копируем исходники бэкенда
COPY backend/. .
# Копируем собранный фронтенд из предыдущего этапа
COPY --from=build-frontend /app/frontend/dist ./build
COPY frontend/public ./public

# Указываем порт
EXPOSE 3000
# Команда запуска
CMD ["npm", "start"]
