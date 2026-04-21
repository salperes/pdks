FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# pg_dump / pg_restore — backup & restore modülleri bu ikiliyi çağırıyor
RUN apk add --no-cache postgresql16-client

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

RUN mkdir -p /app/uploads/photos /app/backups

EXPOSE 3000

CMD ["node", "dist/main"]
