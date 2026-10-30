#!/bin/bash
set -e
# Preserve the supplied ATC artwork at every size, including the title-bar icon.
python3 "$(dirname "$0")/../scripts/make-atc-icons.py"
