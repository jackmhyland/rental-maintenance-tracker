import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rental Maintenance Tracker",
  description: "AI-assisted rental property maintenance request tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </body>
    </html>
  );
}
