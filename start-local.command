#!/bin/sh
set -eu
cd "$(dirname "$0")"
npm run build
exec npm run serve
