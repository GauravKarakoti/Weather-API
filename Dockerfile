FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

COPY .env.example .env

RUN npm install --omit=dev

COPY . .

EXPOSE 3003

CMD ["node", "server.js"]