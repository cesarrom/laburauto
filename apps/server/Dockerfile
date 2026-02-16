FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter server build
RUN pnpm deploy --filter=server --legacy /prod/server

FROM base AS production
COPY --from=build /prod/server /prod/server
WORKDIR /prod/server
EXPOSE 3000
EXPOSE 9229
CMD [ "node", "dist/index.js" ]
