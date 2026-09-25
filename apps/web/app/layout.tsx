import type { ReactNode } from "react";

/** The product UI is the static runtime under /aip; this layout only frames Next's own fallback pages. */
export const metadata = {
  title: "Sustantix AIP",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
