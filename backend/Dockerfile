FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Directory for temporary audio uploads
RUN mkdir -p /app/uploads/tmp

EXPOSE 5000

CMD ["node", "server.js"]
