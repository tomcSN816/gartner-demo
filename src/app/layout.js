import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'Ordering Portal',
  description: 'Generic ordering portal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
