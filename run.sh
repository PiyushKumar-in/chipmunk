#!/usr/bin/env bash
set -euo pipefail

# Project root directory (directory containing this script)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="chipmunk-backend"
IMAGE_NAME="chipmunk-backend:latest"
CONTAINER_STARTED=0

# Clean up container on script exit / interrupt
cleanup() {
    if [ "$CONTAINER_STARTED" -eq 1 ]; then
        echo ""
        echo "Stopping backend container '${CONTAINER_NAME}'..."
        "$CONTAINER_TOOL" stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
        "$CONTAINER_TOOL" rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
        echo "Backend container stopped."
    fi
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# 1. Ask user to enter admin password
# ------------------------------------------------------------------------------
if [ -z "${ADMIN_PASSWORD:-}" ]; then
    while true; do
        read -r -s -p "Enter admin password: " ADMIN_PASSWORD
        echo
        if [ -n "$ADMIN_PASSWORD" ]; then
            break
        fi
        echo "Admin password cannot be empty. Please try again."
    done
else
    echo "Using admin password from environment."
fi

# ------------------------------------------------------------------------------
# 2. Ask user for secret key (with auto-generation option)
# ------------------------------------------------------------------------------
if [ -z "${SECRET_KEY:-}" ]; then
    read -r -p "Enter secret key (leave blank to auto-generate): " SECRET_KEY
    if [ -z "$SECRET_KEY" ]; then
        if command -v openssl >/dev/null 2>&1; then
            SECRET_KEY=$(openssl rand -hex 32)
        elif command -v python >/dev/null 2>&1; then
            SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
        elif command -v python3 >/dev/null 2>&1; then
            SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
        else
            SECRET_KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
        fi
        echo "Auto-generated secret key: ${SECRET_KEY}"
    fi
else
    echo "Using secret key from environment."
fi

# ------------------------------------------------------------------------------
# 3. Detect container tool and run podman/docker build
# ------------------------------------------------------------------------------
if [ -z "${CONTAINER_TOOL:-}" ]; then
    if command -v podman >/dev/null 2>&1; then
        CONTAINER_TOOL="podman"
    elif command -v docker >/dev/null 2>&1; then
        CONTAINER_TOOL="docker"
    else
        echo "Error: Neither podman nor docker was found in PATH." >&2
        exit 1
    fi
fi

echo "=================================================="
echo "Container engine : ${CONTAINER_TOOL}"
echo "Project root     : ${PROJECT_ROOT}"
echo "=================================================="

echo "Building container image '${IMAGE_NAME}'..."
"$CONTAINER_TOOL" build -t "$IMAGE_NAME" "$PROJECT_ROOT"

# ------------------------------------------------------------------------------
# 4. Start backend container in a separate process (detached)
# ------------------------------------------------------------------------------
echo "Preparing backend container '${CONTAINER_NAME}'..."
# Remove any existing container with the same name
"$CONTAINER_TOOL" rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

# Ensure database directory exists
mkdir -p "${PROJECT_ROOT}/database"

OLLAMA_HOST="${OLLAMA_HOST:-http://100.70.198.100:11434}"

echo "Starting backend container in a separate process..."
CONTAINER_ID=$("$CONTAINER_TOOL" run -d \
    --name "$CONTAINER_NAME" \
    -p 8000:8000 \
    -v "${PROJECT_ROOT}/database:/app/database:Z" \
    -e "ADMIN_PASSWORD=${ADMIN_PASSWORD}" \
    -e "SECRET_KEY=${SECRET_KEY}" \
    -e "OLLAMA_HOST=${OLLAMA_HOST}" \
    "$IMAGE_NAME")

CONTAINER_STARTED=1
echo "Backend container started successfully (ID: ${CONTAINER_ID:0:12})."

# Health check (wait up to 30s as in evaluate.py)
echo "Waiting for backend to be healthy at http://127.0.0.1:8000/ ..."
BACKEND_READY=0
for _ in $(seq 1 30); do
    if curl -s -f "http://127.0.0.1:8000/" >/dev/null 2>&1 || curl -s -f "http://localhost:8000/" >/dev/null 2>&1; then
        BACKEND_READY=1
        echo "Backend is ready and accepting requests!"
        break
    fi
    sleep 1
done

if [ "$BACKEND_READY" -ne 1 ]; then
    echo "Warning: Backend did not report ready within 30 seconds."
    echo "Backend container logs:"
    "$CONTAINER_TOOL" logs --tail 20 "$CONTAINER_NAME" || true
fi

# ------------------------------------------------------------------------------
# 5. Start frontend server with `python -m http.server 3000`
# ------------------------------------------------------------------------------
PYTHON_BIN="python"
if ! command -v python >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
fi

echo "=================================================="
echo "Frontend server starting at http://localhost:3000"
echo "Backend API running at   http://localhost:8000"
echo "Press Ctrl+C to stop both frontend and backend."
echo "=================================================="

cd "${PROJECT_ROOT}/frontend"
$PYTHON_BIN -m http.server 3000
