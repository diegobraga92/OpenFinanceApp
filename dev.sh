#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
PASS="${GREEN}✅${NC}"
FAIL="${RED}❌${NC}"
INFO="${CYAN}ℹ️${NC}"

DOCKER_RUN="docker run --rm -v $ROOT_DIR/backend:/app -w /app rust:slim-bookworm"
DEPS_CMD="apt-get update -qq && apt-get install -y -qq pkg-config libssl-dev > /dev/null 2>&1"

step()   { echo -e "\n${CYAN}═══ $1 ═══${NC}"; }
ok()     { echo -e "  ${PASS} $1"; }
fail()   { echo -e "  ${FAIL} $1"; exit 1; }
skip()   { echo -e "  ${YELLOW}⏭️  $1${NC}"; }
info()   { echo -e "  ${INFO} $1"; }

# ──────────────────────────────────────────────
# Backend checks (via Docker — cargo not on host)
# ──────────────────────────────────────────────
check_backend() {
    step "Backend: cargo fmt --check"
    $DOCKER_RUN \
        bash -c "rustup component add rustfmt > /dev/null 2>&1 && cargo fmt --check" \
        && ok "Format check passed" \
        || fail "Format check failed"

    step "Backend: cargo clippy -- -D warnings"
    $DOCKER_RUN \
        bash -c "$DEPS_CMD && rustup component add clippy > /dev/null 2>&1 && cargo clippy -- -D warnings" \
        && ok "Clippy passed" \
        || fail "Clippy found issues"

    step "Backend: cargo audit"
    $DOCKER_RUN \
        bash -c "cargo install cargo-audit --locked > /dev/null 2>&1; cargo audit" \
        && ok "Security audit passed" \
        || fail "Security audit found vulnerabilities"

    step "Backend: cargo build"
    $DOCKER_RUN \
        bash -c "$DEPS_CMD && cargo build" \
        && ok "Build passed" \
        || fail "Build failed"
}

# ──────────────────────────────────────────────
# Web checks (npm available locally)
# ──────────────────────────────────────────────
check_web() {
    step "Web: npm install (if needed)"
    cd "$ROOT_DIR/web"
    if [ ! -d node_modules ]; then
        npm install --silent && ok "Dependencies installed" || fail "npm install failed"
    else
        ok "node_modules exists, skipping install"
    fi

    step "Web: lint"
    npm run lint 2>&1 | grep -v "^> web@" || true
    # Check exit code properly
    if npm run lint > /dev/null 2>&1; then
        ok "Lint passed"
    else
        echo ""
        npm run lint 2>&1 | grep -E "(error|Warning)"
        fail "Lint found errors"
    fi

    step "Web: typecheck"
    npm run typecheck 2>&1 | grep -v "^> web@" || true
    if npm run typecheck > /dev/null 2>&1; then
        ok "Typecheck passed"
    else
        fail "Typecheck failed"
    fi
}

# ──────────────────────────────────────────────
# Mobile checks (npm available locally)
# ──────────────────────────────────────────────
check_mobile() {
    step "Mobile: npm install (if needed)"
    cd "$ROOT_DIR/mobile"
    if [ ! -d node_modules ]; then
        npm install --silent && ok "Dependencies installed" || fail "npm install failed"
    else
        ok "node_modules exists, skipping install"
    fi

    step "Mobile: lint"
    if npm run lint > /dev/null 2>&1; then
        ok "Lint passed"
    else
        echo ""
        npm run lint 2>&1 | grep -E "(error|Warning)"
        fail "Lint found errors"
    fi

    step "Mobile: typecheck"
    if npm run typecheck > /dev/null 2>&1; then
        ok "Typecheck passed"
    else
        fail "Typecheck failed"
    fi
}

# ──────────────────────────────────────────────
# Dev mode — start services via docker-compose
# ──────────────────────────────────────────────
dev_up() {
    step "Starting development services"
    cd "$ROOT_DIR"
    docker compose up --build -d
    echo ""
    info "Backend API:  http://localhost:3000/health"
    info "Web UI:       http://localhost:5173"
    info "RabbitMQ UI:  http://localhost:15672  (pudim / pudim)"
    echo ""
    ok "Services started"
}

dev_down() {
    step "Stopping development services"
    cd "$ROOT_DIR"
    docker compose down
    ok "Services stopped"
}

# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
usage() {
    echo "Usage: ./dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  check           Run all CI checks (backend + web + mobile)"
    echo "  check-backend   Backend only: fmt, clippy, audit, build"
    echo "  check-web       Web only: lint, typecheck"
    echo "  check-mobile    Mobile only: lint, typecheck"
    echo "  dev             Start all services (docker compose up -d --build)"
    echo "  all             Run checks, then start services"
    echo "  down            Stop all services"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh check-backend   # Check backend before push"
    echo "  ./dev.sh dev             # Start coding session"
    echo "  ./dev.sh all             # Verify and launch"
}

case "${1:-dev}" in
    check)
        check_backend
        check_web
        check_mobile
        echo -e "\n${GREEN}═════════════════════════════════════${NC}"
        echo -e "${GREEN}  ✅ All checks passed!${NC}"
        echo -e "${GREEN}═════════════════════════════════════${NC}"
        ;;
    check-backend)
        check_backend
        echo -e "\n${GREEN}✅ Backend checks passed${NC}"
        ;;
    check-web)
        check_web
        echo -e "\n${GREEN}✅ Web checks passed${NC}"
        ;;
    check-mobile)
        check_mobile
        echo -e "\n${GREEN}✅ Mobile checks passed${NC}"
        ;;
    dev)
        dev_up
        ;;
    all)
        check_backend
        check_web
        check_mobile
        echo -e "\n${GREEN}═════════════════════════════════════${NC}"
        echo -e "${GREEN}  ✅ All checks passed!${NC}"
        echo -e "${GREEN}═════════════════════════════════════${NC}"
        dev_up
        ;;
    down)
        dev_down
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        echo -e "${FAIL} Unknown command: $1${NC}"
        usage
        exit 1
        ;;
esac