import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { colors } from '../lib/theme';

// HTML base de la versión web (solo corre en Node al generar las páginas).
// Configura Dachsi como app instalable: "Agregar a pantalla de inicio" en el iPhone abre a pantalla completa.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Dachsi</title>
        <meta name="description" content="Plan diario para entrenar y criar a tu cachorro." />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={colors.background} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Dachsi" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `html, body { background-color: ${colors.background}; }` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
