// Entrada del servidor en Vercel: todas las rutas (páginas y /api/*) pasan por el servidor de Expo Router.
// Ver https://docs.expo.dev/router/web/api-routes.md#vercel
const { createRequestHandler } = require('expo-server/adapter/vercel');

module.exports = createRequestHandler({
  build: require('path').join(__dirname, '../dist/server'),
});
