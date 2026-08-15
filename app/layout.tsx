import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { PwaRegistration } from "./pwa-registration";
import "./globals.css";

const title = "らっかせい！";
const description =
  "花をつなげて、地中で落花生を育てて収穫する、かわいい落ちものパズルゲーム「らっかせい！」";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title,
    description,
    applicationName: title,
    manifest: "/manifest.webmanifest",
    formatDetection: {
      telephone: false,
    },
    appleWebApp: {
      capable: true,
      title,
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: imageUrl, width: 1731, height: 909, alt: "らっかせい！の花と畑のゲーム画面" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#9edcf2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
