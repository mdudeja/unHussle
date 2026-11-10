#!/bin/bash
# Load test configuration in Bun; the runner owns startup, health polling and cleanup.
exec bun run --env-file=.env.test scripts/test-with-server.ts "$@"
