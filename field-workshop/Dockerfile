FROM node:22-alpine

WORKDIR /app
COPY services/ ./services/
COPY web/ ./web/
COPY docs/ ./docs/
USER node

CMD ["node", "services/storefront.mjs"]
