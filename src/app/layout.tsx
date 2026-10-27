
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little Hug | Period Care Box",
  description:
    "A little care. A little comfort. A lot of love. Thoughtfully curated period care gift boxes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
