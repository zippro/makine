import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProjectProvider } from "@/context/ProjectContext";
import Navigation from "@/components/Navigation";
import { Footer } from "@/components/Footer";

/*
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
*/

export const metadata: Metadata = {
  title: "Makine",
  description: "Create stunning music videos from your images and audio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`antialiased`}
        suppressHydrationWarning
      >
        <ProjectProvider>
          <Navigation />
          <main className="min-h-screen pt-20 pb-10 px-4 max-w-7xl mx-auto">
            {children}
          </main>
          <Footer />
        </ProjectProvider>
      </body>
    </html>
  );
}
