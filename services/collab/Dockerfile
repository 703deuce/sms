FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV PORT=1234
CMD ["node", "--experimental-strip-types", "src/server.ts"]
