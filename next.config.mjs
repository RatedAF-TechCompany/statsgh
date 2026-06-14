import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routerShim = path.resolve(__dirname, "src/compat/react-router-dom.tsx");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The existing codebase predates Next's lint/type strictness and the old
  // Vite build never enforced them. Don't let lint/type errors gate the build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Pin the workspace root to this project (a stray parent lockfile otherwise
  // confuses Next's root inference).
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "statsgh.com",
      },
      {
        protocol: "https",
        hostname: "ofhejtwaigiqyejbvncz.supabase.co",
      },
    ],
  },
  // Pin root + map the slice of react-router-dom the app uses onto Next's router.
  turbopack: {
    root: __dirname,
    resolveAlias: {
      "react-router-dom": routerShim,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-router-dom": routerShim,
    };
    return config;
  },
  async redirects() {
    const pair = (from, to) => [
      { source: from, destination: to, permanent: true },
      { source: `${from}/:path*`, destination: to, permanent: true },
    ];
    return [
      // Old category slugs → new category slugs
      ...pair("/democracy", "/security-governance"),
      ...pair("/energy", "/energy-resources"),
      ...pair("/environment", "/environment-climate"),
      ...pair("/national-accounts", "/public-finance"),
      ...pair("/prices-and-consumption", "/economy-inflation"),
      ...pair("/speeches-and-press-releases", "/top-stories"),
      ...pair("/culture-and-leisure", "/"),
      ...pair("/social-services", "/"),
      { source: "/population/:path*", destination: "/population", permanent: true },

      // Old article listing patterns (/article/:slug handled by app/article/[slug])
      { source: "/article", destination: "/top-stories", permanent: true },
      { source: "/news/:path+", destination: "/top-stories", permanent: true },

      // Legacy /category/<slug> → current section slugs (specific before catch-all)
      ...pair("/category/business", "/business"),
      ...pair("/category/economy", "/economy"),
      ...pair("/category/markets", "/markets-data"),
      ...pair("/category/markets-data", "/markets-data"),
      ...pair("/category/politics", "/politics-policy"),
      ...pair("/category/politics-policy", "/politics-policy"),
      ...pair("/category/energy", "/energy-resources"),
      ...pair("/category/energy-resources", "/energy-resources"),
      ...pair("/category/agriculture", "/agriculture"),
      ...pair("/category/technology", "/technology"),
      ...pair("/category/companies", "/companies"),
      ...pair("/category/analysis", "/analysis"),
      ...pair("/category/opinion", "/opinion-analysis"),
      ...pair("/category/opinion-analysis", "/opinion-analysis"),
      ...pair("/category/research", "/research"),
      ...pair("/category/financial-literacy", "/financial-literacy"),
      ...pair("/category/world", "/world"),
      ...pair("/category/top-stories", "/top-stories"),
      // Unknown legacy category → homepage (final fallback)
      { source: "/category", destination: "/", permanent: true },
      { source: "/category/:path*", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
