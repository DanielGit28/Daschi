// Configuración de Metro para que expo-sqlite funcione en web (wa-sqlite).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite en web usa un archivo WebAssembly.
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer requiere estos encabezados en el servidor de desarrollo.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
