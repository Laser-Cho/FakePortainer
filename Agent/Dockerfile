FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# Bypass SSL verification for restricted proxy/network environments
RUN npm config set strict-ssl false && npm install --strict-ssl=false --production

COPY . .

EXPOSE 9000

ENV PORT=9000
ENV AGENT_SECRET_TOKEN="your_secure_agent_token"

CMD ["npm", "start"]
