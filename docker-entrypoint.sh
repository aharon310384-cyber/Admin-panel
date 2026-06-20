#!/bin/sh
set -e
echo "[entrypoint] prisma db push (синхронизация схемы v2)..."
node ./node_modules/prisma/build/index.js db push --skip-generate
echo "[entrypoint] starting Next.js..."
exec node server.js
