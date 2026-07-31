#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
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
    if npm run lint > /dev/null 2>&1; then
        ok "Lint passed"
    else
        echo ""
        npm run lint 2>&1 | grep -E "(error|Warning)"
        fail "Lint found errors"
    fi

    step "Web: typecheck"
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
# OpenAPI checks
# ──────────────────────────────────────────────
check_openapi() {
    step "OpenAPI: spec validation"
    if npx --yes @redocly/cli lint "$ROOT_DIR/api/openapi/openapi.json" > /dev/null 2>&1; then
        ok "OpenAPI spec is valid"
    else
        npx @redocly/cli lint "$ROOT_DIR/api/openapi/openapi.json" 2>&1 | tail -n 30
        fail "OpenAPI spec validation failed"
    fi
}

# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
usage() {
    echo "Usage: $(basename "$0") <command>"
    echo ""
    echo "Commands:"
    echo "  check           Run all CI checks (backend + openapi + web + mobile)"
    echo "  check-backend   Backend only: fmt, clippy, audit, build"
    echo "  check-openapi   OpenAPI spec only: validation"
    echo "  check-web       Web only: lint, typecheck"
    echo "  check-mobile    Mobile only: lint, typecheck"
    echo ""
    echo "Examples:"
    echo "  ./scripts/ci-checks check-backend   # Check backend before push"
    echo "  ./scripts/ci-checks check           # Full check suite"
}

case "${1:-help}" in
    check)
        check_backend
        check_openapi
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
    check-openapi)
        check_openapi
        echo -e "\n${GREEN}✅ OpenAPI checks passed${NC}"
        ;;
    check-web)
        check_web
        echo -e "\n${GREEN}✅ Web checks passed${NC}"
        ;;
    check-mobile)
        check_mobile
        echo -e "\n${GREEN}✅ Mobile checks passed${NC}"
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