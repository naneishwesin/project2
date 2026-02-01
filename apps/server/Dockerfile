FROM node:20-alpine

WORKDIR /app
COPY package.json /app/package.json
RUN npm install --omit=dev

COPY src /app/src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]

