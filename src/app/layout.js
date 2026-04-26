import { Geist, Geist_Mono, Permanent_Marker } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const graffitiFont = Permanent_Marker({
  variable: "--font-graffiti",
  weight: "400",
  subsets: ["latin"],
});

export const metadata = {
  title: "Notepad by peanutbolu",
  description: "Notepad online pribadi untuk menyimpan catatan, gambar, dan video.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${graffitiFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
