import "@xyflow/react/dist/style.css";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sovereign Vault Ops Console",
  description: "Visualized adversarial AI POC for confidential healthcare truth auditing."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
