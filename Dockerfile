FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the app
COPY . .

ARG PORT=9093
ENV NODE_ENV=production
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["node", "server/index.js"]
