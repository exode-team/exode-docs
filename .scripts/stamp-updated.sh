#!/bin/sh
# Stamp each docs page with its "last updated" time in UTC-0.
#
# Default (seeding): timestamp = git last-commit time for the file
#   (fallback: filesystem mtime for untracked files).
# STAMP_NOW=1: use the current UTC time — used by the pre-commit hook so
#   edited pages get the moment of the commit.
#
# Usage:
#   .scripts/stamp-updated.sh                 # (re)stamp every ru/**/*.mdx from git history
#   STAMP_NOW=1 .scripts/stamp-updated.sh f1  # stamp given files with the current UTC time
set -eu

SENTINEL='{/* updated-stamp */}'

stamp_file() {
    f="$1"
    case "$f" in *.mdx) ;; *) return 0 ;; esac
    [ -f "$f" ] || return 0

    if [ "${STAMP_NOW:-0}" = "1" ]; then
        ts=$(TZ=UTC0 date '+%Y-%m-%d %H:%M')
    else
        ts=$(TZ=UTC0 git log -1 --format=%cd --date=format-local:'%Y-%m-%d %H:%M' -- "$f" 2>/dev/null || true)
        [ -n "$ts" ] || ts=$(TZ=UTC0 stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$f")
    fi

    tmp=$(mktemp)
    # Drop any existing stamp block (from the sentinel to EOF) and trailing blank lines.
    awk -v s="$SENTINEL" '
        index($0, s) { stop = 1 }
        !stop { lines[++n] = $0 }
        END {
            last = n
            while (last > 0 && lines[last] == "") last--
            for (i = 1; i <= last; i++) print lines[i]
        }
    ' "$f" > "$tmp" && mv "$tmp" "$f"

    printf '\n%s\n\n---\n\n_Обновлено: %s UTC_\n' "$SENTINEL" "$ts" >> "$f"
}

if [ "$#" -gt 0 ]; then
    for f in "$@"; do stamp_file "$f"; done
else
    find ru -name '*.mdx' | while IFS= read -r f; do stamp_file "$f"; done
fi
