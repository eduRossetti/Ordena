import './globals.css';

export const metadata = {
  title: 'Ordena',
  description: 'Tarefas compartilhadas em grupo',
  appleWebApp: { capable: true, title: 'Ordena', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
