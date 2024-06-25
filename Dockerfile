FROM node:20 as builder

ARG ADMIN_SERVE=true
ENV ADMIN_SERVE=$ADMIN_SERVE

WORKDIR /app
COPY package.json yarn.lock ./
COPY lerna.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/mail/package.json packages/mail/package.json

RUN yarn install --verbose
COPY . .
RUN yarn lerna run build && \
    yarn lerna run --scope=backend build:admin


FROM node:20
WORKDIR /app
COPY --from=builder /app /app
CMD ["/bin/bash", "./entrypoint.sh"]

EXPOSE 3000/tcp
