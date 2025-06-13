#!/bin/bash

# Define what to find and replace
SEARCH="https://backend-empty-fire-4935.fly.dev"
REPLACE="https://backend-empty-fire-4935.fly.dev"

# Recursively replace in all files under current directory
find . -type f -exec sed -i "s|$SEARCH|$REPLACE|g" {} +

echo "✅ All instances of '$SEARCH' replaced with '$REPLACE'"




















