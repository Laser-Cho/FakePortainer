FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Bypass SSL verification for restricted proxy/network environments
RUN npm config set strict-ssl false && npm install --strict-ssl=false --production
COPY . .

FROM gcr.io/distroless/nodejs20-debian11
WORKDIR /app
COPY --from=builder /app ./
COPY docker-compose.yml /example/docker-compose.yml
EXPOSE 9000
ENV PORT=9000
ENV AGENT_SECRET_TOKEN="1"
CMD ["src/index.js"]
