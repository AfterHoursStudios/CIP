#!/bin/bash

echo "Building web version..."
npm run build:web

echo "Fixing font paths for Vercel..."
cd dist/assets && mv node_modules vendor 2>/dev/null || true
cd ../..

# Update paths in JS bundle
sed -i 's|/assets/node_modules/|/assets/vendor/|g' dist/_expo/static/js/web/*.js

echo "Adding PWA manifest..."
cp public/* dist/
find dist -name "*.html" -exec sed -i 's|<link rel="icon" href="/favicon.ico" />|<link rel="icon" href="/favicon.ico" /><link rel="manifest" href="/manifest.json" /><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><link rel="apple-touch-icon" href="/icon-192.png">|g' {} \;

echo "Deploying to Vercel..."
cd dist && npx vercel --prod

echo "Done!"
