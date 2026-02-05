import Providers from "./providers";

export const metadata = {
  title: "Continuity Studio MVP",
  description: "Sora 2 continuity studio MVP"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
