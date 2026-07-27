# --- Etapa 1: dependencias (incluye devDependencies, se usa para build y migraciones) ---
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

# --- Etapa 2: build de la app ---
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Etapa 3a: imagen de runtime, liviana, solo sirve la app ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

# --- Etapa 3b: imagen usada solo para correr "prisma db push" contra la base ---
# Se ejecuta una vez al levantar docker compose (servicio "migrate"), no queda
# corriendo. Necesita el CLI completo de Prisma, por eso parte de "deps" y no
# de la imagen de runtime, que se mantiene liviana.
FROM node:20-alpine AS migrator
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
CMD ["npx", "prisma", "db", "push", "--skip-generate"]
