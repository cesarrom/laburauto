FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /app
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @laburauto/shared build
RUN pnpm --filter server build

FROM base AS production
COPY --from=build /app/apps/server/dist /app/dist
WORKDIR /app/dist
EXPOSE 3000
EXPOSE 9229
CMD [ "node", "index.js" ]
