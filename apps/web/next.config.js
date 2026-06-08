/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === "1";

// Native Node.js modules that must never be bundled for the browser.
const SERVER_ONLY_MODULES = ["@napi-rs/canvas", "pdfjs-dist", "tesseract.js", "pdf-parse"];

const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  experimental: {
    // Prevent webpack from bundling server-only packages into Server Components (Next.js 14).
    serverComponentsExternalPackages: SERVER_ONLY_MODULES,
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      // Hard-exclude native binary packages from ALL client-side bundles,
      // including the static export. Without this, webpack throws on .node files.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        ...SERVER_ONLY_MODULES,
      ];
    }
    return config;
  },

  ...(isStaticExport && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

module.exports = nextConfig;
