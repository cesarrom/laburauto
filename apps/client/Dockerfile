FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @laburauto/client build || true
RUN pnpm deploy --filter=@laburauto/client --legacy /prod/client

FROM base AS client
COPY --from=build /prod/client /prod/client
WORKDIR /prod/client
EXPOSE 5173
CMD [ "pnpm", "dev:host" ]
