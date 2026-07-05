FROM node:20-alpine

WORKDIR /app

COPY package.json tsconfig.json vite.config.ts ./
RUN npm install

COPY public ./public
COPY src ./src

EXPOSE 4173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4173"]
