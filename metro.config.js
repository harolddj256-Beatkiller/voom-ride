// The shared, Node-testable helpers use .cjs. Make their extension explicit.
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = [...new Set([...config.resolver.sourceExts, 'cjs'])];
module.exports = config;
