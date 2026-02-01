#!/bin/bash

echo "Starting test server..."
bun run --env-file=.env.test src-db-server/server.ts &
SERVER_PID=$!

echo "Test server started with PID $SERVER_PID"

cleanup() {
    echo "Stopping test server..."
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
}

trap cleanup EXIT

sleep 2

echo "Running tests..."
bun test --env-file=.env.test **/__tests__

TEST_EXIT_CODE=$?

echo "Tests completed with exit code $TEST_EXIT_CODE"

exit $TEST_EXIT_CODE
