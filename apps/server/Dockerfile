FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @laburauto/shared build
RUN pnpm --filter server build
RUN pnpm deploy --filter=server --legacy /prod/server
RUN cp -r /usr/src/app/apps/server/dist /prod/server/dist
RUN find /prod/server/node_modules -type d -name "@laburauto" -exec sh -c 'cp -r /usr/src/app/packages/shared/dist "$1/shared/"' _ {} \;

FROM base AS production
COPY --from=build /prod/server /prod/server
WORKDIR /prod/server
EXPOSE 3000
EXPOSE 9229
CMD [ "node", "dist/apps/server/src/index.js" ]
