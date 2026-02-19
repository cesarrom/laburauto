FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
ARG VITE_API_URL=/api
ARG VITE_AUTHENTIK_ENABLED=false
ARG VITE_SSO_LOGIN_URL=http://localhost:3000/api/auth/sso/authentik/start
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTHENTIK_ENABLED=$VITE_AUTHENTIK_ENABLED
ENV VITE_SSO_LOGIN_URL=$VITE_SSO_LOGIN_URL
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @laburauto/shared build
RUN pnpm --filter @laburauto/client build

FROM nginx:1.27-alpine AS client
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/apps/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
