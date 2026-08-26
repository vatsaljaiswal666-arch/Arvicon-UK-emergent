import './globals.css'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Arvicon Operations & Inventory Management',
  description: 'Natural stone export operations, inventory, shipments, sales & profitability.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
