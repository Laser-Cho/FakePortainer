FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Bypass SSL verification for restricted proxy/network environments
RUN npm config set strict-ssl false && npm install --strict-ssl=false
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian11
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["server.js"]
