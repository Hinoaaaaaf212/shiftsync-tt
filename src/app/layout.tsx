import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { PWAProvider } from "@/components/pwa-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ShiftSync TT - The Smarter Way to Schedule",
  description: "Employee scheduling system built specifically for Trinidad & Tobago businesses. Manage shifts, employees, and schedules with ease.",
  keywords: ["business", "scheduling", "trinidad", "tobago", "employee management", "shifts", "restaurant"],
  authors: [{ name: "ShiftSync TT" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShiftSync TT",
  },
  openGraph: {
    title: "ShiftSync TT - The Smarter Way to Schedule",
    description: "Employee scheduling system built specifically for Trinidad & Tobago businesses.",
    locale: "en_TT",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <AuthProvider>
          <PWAProvider>
            {children}
          </PWAProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
