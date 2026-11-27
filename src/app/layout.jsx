import { BaseStyles, ThemeProvider } from '@primer/react';
import './globals.css';

export const metadata = {
  title: 'Ordena',
  description: 'Tarefas compartilhadas em grupo',
  appleWebApp: { capable: true, title: 'Ordena', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d1117',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      data-color-mode="dark"
      data-dark-theme="dark"
      data-light-theme="light"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider colorMode="night">
          <BaseStyles>{children}</BaseStyles>
        </ThemeProvider>
      </body>
    </html>
  );
}
