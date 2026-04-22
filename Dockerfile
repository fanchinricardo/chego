FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "node_modules/serve/build/main.js", "dist", "-s", "--listen", "tcp://0.0.0.0:3000"]