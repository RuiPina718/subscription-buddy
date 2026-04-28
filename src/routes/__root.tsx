import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que procuras não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-base hover:scale-[1.02]">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Trackify — Gere as tuas subscrições num único lugar" },
      { name: "description", content: "Controla todas as tuas subscrições, evita cobranças surpresa e poupa todos os meses com o Trackify." },
      { name: "author", content: "Trackify" },
      { property: "og:title", content: "Trackify — Gere as tuas subscrições num único lugar" },
      { property: "og:description", content: "Controla todas as tuas subscrições, evita cobranças surpresa e poupa todos os meses com o Trackify." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Trackify — Gere as tuas subscrições num único lugar" },
      { name: "twitter:description", content: "Controla todas as tuas subscrições, evita cobranças surpresa e poupa todos os meses com o Trackify." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8c6f00d5-0522-491c-be4a-afa147e50e99/id-preview-6c63ae2c--577c05c9-4ca6-4bb9-aad3-f24347f1231d.lovable.app-1777325329992.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8c6f00d5-0522-491c-be4a-afa147e50e99/id-preview-6c63ae2c--577c05c9-4ca6-4bb9-aad3-f24347f1231d.lovable.app-1777325329992.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
