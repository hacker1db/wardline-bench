#!/usr/bin/env bash
# Local security scan. Same checks as .github/workflows/security.yml.
# Writes reports to .security/ (git-ignored). Exits non-zero on high/critical findings.
#   CodeQL   JS/TS SAST (needs the codeql CLI: brew install --cask codeql)
#   syft     SBOM (CycloneDX) for the repo
#   grype    vulnerabilities in that SBOM
#   trivy    filesystem scan: vulns, secrets, misconfig
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/.security"
mkdir -p "$out"
status=0

if command -v codeql >/dev/null; then
  echo "== codeql"
  rm -rf "$out/codeql-db"
  codeql database create "$out/codeql-db" --language=javascript-typescript --source-root="$root" \
    --codescanning-config="$root/.github/codeql/codeql-config.yml" --overwrite >/dev/null
  codeql database analyze "$out/codeql-db" codeql/javascript-queries:codeql-suites/javascript-security-extended.qls \
    --download --format=sarif-latest --output="$out/codeql.sarif" >/dev/null
  n=$(node -e "const s=JSON.parse(require('fs').readFileSync('$out/codeql.sarif','utf8'));console.log(s.runs.reduce((a,r)=>a+r.results.length,0))")
  echo "codeql findings: $n (see .security/codeql.sarif)"
  [ "$n" -eq 0 ] || status=1
else
  echo "== codeql: skipped (not installed)"
fi

echo "== syft sbom"
syft dir:"$root" --exclude './**/node_modules/**' --exclude './.security/**' -o cyclonedx-json="$out/sbom.cdx.json" -q

echo "== grype"
grype sbom:"$out/sbom.cdx.json" --fail-on high -q -o table || status=1

echo "== trivy fs"
trivy fs --quiet --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --exit-code 1 \
  --skip-dirs node_modules --skip-dirs .security "$root" || status=1

exit $status
