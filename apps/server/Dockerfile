FROM node:22-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @laburauto/server build
EXPOSE 3000
EXPOSE 9229
CMD [ "node", "/usr/src/app/dist/apps/server/src/index.js" ]
