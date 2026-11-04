# Zero-dependency Node demo — no npm install needed.
FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node . .
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server.js"]
