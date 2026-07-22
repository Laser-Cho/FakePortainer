FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Bypass SSL verification for restricted proxy/network environments
RUN npm config set strict-ssl false && npm install --strict-ssl=false
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
