#!/bin/sh
set -eu

: "${OBSERVABILITY_BASIC_AUTH_USER:?OBSERVABILITY_BASIC_AUTH_USER is required}"
: "${OBSERVABILITY_BASIC_AUTH_PASSWORD:?OBSERVABILITY_BASIC_AUTH_PASSWORD is required}"

mkdir -p /etc/nginx/auth
HASHED_PASSWORD=$(printf '%s' "$OBSERVABILITY_BASIC_AUTH_PASSWORD" | openssl passwd -apr1 -stdin)
printf '%s:%s\n' "$OBSERVABILITY_BASIC_AUTH_USER" "$HASHED_PASSWORD" > /etc/nginx/auth/.htpasswd

exec nginx -g 'daemon off;'