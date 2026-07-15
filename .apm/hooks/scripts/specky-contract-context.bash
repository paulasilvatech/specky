# Shared explicit feature-contract context for Specky hooks.

specky_load_contract_context() {
  local context_dir context_exports
  context_dir=$(cd "$(dirname "$0")" && pwd)
  context_exports=$(node "$context_dir/specky-contract-context.mjs" shell) || return $?
  eval "$context_exports"
}

specky_has_capability() {
  local capability=",${SPECKY_CAPABILITIES:-},"
  case "$capability" in
    *",$1,"*) return 0 ;;
    *) return 1 ;;
  esac
}

specky_require_feature_context() {
  specky_load_contract_context || return $?
  if [ "${SPECKY_CONTEXT_ACTIVE:-0}" != "1" ]; then
    echo "[specky] Explicit feature context required: ${SPECKY_CONTEXT_REASON:-missing context}." >&2
    return 2
  fi
}
