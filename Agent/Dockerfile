FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 9000

ENV PORT=9000
ENV AGENT_SECRET_TOKEN="your_secure_agent_token"

CMD ["npm", "start"]
