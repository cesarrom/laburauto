FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
ARG VITE_API_URL=http://server:3000/api
ENV VITE_API_URL=$VITE_API_URL
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @laburauto/client build
RUN pnpm deploy --filter=@laburauto/client --legacy /prod/client
RUN cp -r apps/client/dist /prod/client/dist

FROM base AS client
COPY --from=build /prod/client /prod/client
WORKDIR /prod/client
EXPOSE 4173
CMD [ "pnpm", "preview", "--host", "0.0.0.0", "--port", "4173" ]
