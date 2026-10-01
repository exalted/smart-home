# shellcheck shell=sh
# Shared helpers for the bin/shelly-* tools. Source it, don't run it.
#
# Stream convention shared by every tool: one device per line on stdin, either
# a bare host ("192.168.179.4") or a JSON object with an "ip" key. Tools merge
# their own fields into the object and print it as one JSON line, so earlier
# fields (e.g. "name") survive the whole pipeline.

SHELLY_SUBNET=${SHELLY_SUBNET:-192.168.179}
SHELLY_PARALLEL=${SHELLY_PARALLEL:-10}
SHELLY_TIMEOUT=${SHELLY_TIMEOUT:-5}

die() {
  printf '%s: %s\n' "${0##*/}" "$*" >&2
  exit 1
}

need() {
  for dep; do
    command -v "$dep" >/dev/null 2>&1 || die "missing dependency: $dep"
  done
}

usage_from_header() {
  sed -n '2,/^$/s/^# \{0,1\}//p' "$0"
}

shelly_normalize() {
  jq -cR '
    select(length > 0 and (startswith("#") | not))
    | (fromjson? // {ip: .})
    | if type == "object" then . else {ip: tostring} end
    | select(.ip)'
}

# Runs "$@ LINE" once per normalized stdin line, in parallel. NUL-delimiting
# keeps each JSON line a single argument; macOS xargs -I would also choke on
# lines longer than 255 bytes.
shelly_each() {
  shelly_normalize | tr '\n' '\0' | xargs -0 -n 1 -P "$SHELLY_PARALLEL" "$@"
}

# Passing the password via a curl config on stdin keeps it out of `ps` output.
shelly_curl() {
  if [ -n "${SHELLY_PASSWORD:-}" ]; then
    printf 'user = "admin:%s"\n' "$(printf '%s' "$SHELLY_PASSWORD" | sed 's/[\\"]/\\&/g')" |
      curl -s -m "$SHELLY_TIMEOUT" --digest -K - "$@"
  else
    curl -s -m "$SHELLY_TIMEOUT" "$@"
  fi
}

# Prints the JSON-RPC response frame ({result} or {error}). Transport
# failures are reported in the same {error} shape so callers handle one case.
shelly_call() {
  host=$1 method=$2 params=${3:-null}
  body=$(jq -nc --arg m "$method" --argjson p "$params" \
    '{id: 1, method: $m} + (if $p == null then {} else {params: $p} end)')
  out=$(shelly_curl -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' \
    -d "$body" "http://$host/rpc") || true
  code=$(printf '%s\n' "$out" | tail -n 1)
  resp=$(printf '%s\n' "$out" | sed '$d')
  if printf '%s' "$resp" | jq -e 'type == "object" and (has("result") or has("error"))' >/dev/null 2>&1; then
    printf '%s\n' "$resp"
    return
  fi
  case $code in
    000 | '') printf '{"error":{"message":"unreachable"}}\n' ;;
    401) printf '{"error":{"message":"authentication required, set SHELLY_PASSWORD"}}\n' ;;
    *) jq -nc --arg c "$code" --arg b "$resp" '{error: {message: "HTTP \($c)", body: $b}}' ;;
  esac
}
