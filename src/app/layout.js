import './globals.css';
import Nav from '@/components/Nav';
import { getCurrentReseller } from '@/lib/session';

export const metadata = {
  title: 'Ordering Portal',
  description: 'Generic ordering portal',
};

export default function RootLayout({ children }) {
  const reseller = getCurrentReseller();
  return (
    <html lang="en">
      <body style={reseller?.theme}>
        <Nav
          reseller={reseller && { name: reseller.name, initials: reseller.initials }}
        />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
