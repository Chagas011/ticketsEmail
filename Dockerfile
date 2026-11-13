FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=hmlg
ENV PORT=3001

COPY package*.json ./

# Instala dependencies e devDependencies
RUN npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
