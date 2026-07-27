#!/bin/sh
# Construye la imagen de la app Event Flow.
# Uso: ./build.sh [tag opcional, default "event-flow:latest"]

set -e

TAG="${1:-event-flow:latest}"

echo "Construyendo imagen ${TAG}..."
docker build --target runner -t "${TAG}" .

echo ""
echo "Imagen lista: ${TAG}"
echo ""
echo "Para correrla necesitás una base Postgres accesible y un AUTH_SECRET. Ejemplo:"
echo ""
echo "  docker run -d --name event-flow -p 3000:3000 \\"
echo "    -e DATABASE_URL=\"postgresql://user:pass@host:5432/eventflow\" \\"
echo "    -e AUTH_SECRET=\"$(openssl rand -base64 32 2>/dev/null || echo 'reemplazar-por-un-valor-random')\" \\"
echo "    ${TAG}"
echo ""
echo "Antes de arrancarla, las tablas deben existir en esa base. Corré una vez:"
echo ""
echo "  docker build --target migrator -t event-flow-migrate ."
echo "  docker run --rm -e DATABASE_URL=\"postgresql://user:pass@host:5432/eventflow\" event-flow-migrate"
echo ""
echo "Para exportarla como archivo .tar (llevarla a otra máquina sin volver a buildear):"
echo ""
echo "  docker save -o event-flow-image.tar ${TAG}"
echo "  # en la otra máquina: docker load -i event-flow-image.tar"
