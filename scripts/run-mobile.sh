#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$ROOT_DIR/mobile"

# ─── Colors ────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[run-mobile]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[run-mobile]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[run-mobile]${NC} $1"; }
log_error() { echo -e "${RED}[run-mobile]${NC} $1"; }

# ─── Help ──────────────────────────────────────────────────────────────────
usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Start the PudimFinance mobile development environment.
Delegates backend setup to scripts/run, then starts the Expo dev server.

Options:
  --no-db    Skip starting Docker services (postgres) — passed to scripts/run
  --help     Show this help message and exit
EOF
    exit 0
}

# ─── Parse arguments ───────────────────────────────────────────────────────
DEV_SH_ARGS=()
for arg in "$@"; do
    case "$arg" in
        --no-db)  DEV_SH_ARGS+=("--no-db") ;;
        --help)   usage ;;
        *) log_warn "Unknown argument: $arg"; usage ;;
    esac
done

# Forward --no-web by default (mobile doesn't need the web dev server)
DEV_SH_ARGS+=("--no-web")

# ─── Cleanup handler ───────────────────────────────────────────────────────
cleanup() {
    echo ""
    log_info "Shutting down..."

    # 1. Stop Expo
    if [ -n "${EXPO_PID:-}" ]; then
        log_info "Stopping Expo (PID $EXPO_PID)..."
        kill "$EXPO_PID" 2>/dev/null || true
        wait "$EXPO_PID" 2>/dev/null || true
    fi
    pkill -9 -f "expo" 2>/dev/null || true

    # 2. Stop the backend stack launched by scripts/run
    log_info "Stopping backend (cargo process)..."
    pkill -9 -f "cargo run" 2>/dev/null || true

    log_info "Stopping Docker services..."
    docker compose -f "$ROOT_DIR/docker-compose.yml" down 2>/dev/null || true

    # 3. Stop scripts/run itself
    if [ -n "${DEV_PID:-}" ]; then
        kill "$DEV_PID" 2>/dev/null || true
        wait "$DEV_PID" 2>/dev/null || true
    fi

    log_ok "All services stopped. Goodbye!"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ─── 1. Launch backend via scripts/run --no-web ────────────────────────────
log_info "Starting backend stack via scripts/run..."
"$SCRIPT_DIR/run" "${DEV_SH_ARGS[@]}" &
DEV_PID=$!
log_ok "scripts/run started (PID $DEV_PID)."

# Give backend time to boot
sleep 3

# ─── 2. Install mobile dependencies if needed ──────────────────────────────
if [ ! -d "$MOBILE_DIR/node_modules" ]; then
    log_info "node_modules not found. Running npm install..."
    (cd "$MOBILE_DIR" && npm install)
    log_ok "npm install completed."
else
    log_ok "node_modules found, skipping npm install."
fi

# ─── 3. Start Expo ─────────────────────────────────────────────────────────
log_info "Starting Expo dev server..."
(cd "$MOBILE_DIR" && npx expo start) &
EXPO_PID=$!
log_ok "Expo started (PID $EXPO_PID)."

# ─── 4. Print summary ──────────────────────────────────────────────────────
echo ""
log_ok "═══════════════════════════════════════════════════════════"
log_ok "  PudimFinance mobile environment is running!"
log_ok ""
log_ok "  Backend API:  http://localhost:3000/health"
log_ok "  Expo:         http://localhost:8081"
log_ok ""
log_ok "  Press Ctrl+C to stop all services."
log_ok "═══════════════════════════════════════════════════════════"
echo ""

# Wait for scripts/run to exit (keeps script alive, forwards Ctrl+C)
wait "$DEV_PID"