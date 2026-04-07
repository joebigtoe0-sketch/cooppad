/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep `next build` from tracing the Anchor tree (can be huge under target/)
    outputFileTracingExcludes: {
      "*": [
        "./target/**/*",
        "./programs/**/*",
        "./migrations/**/*",
        "./tests/**/*",
      ],
    },
  },
  webpack: (config, { dev }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Webpack dev watches the whole package root; Anchor's target/ has 10k+ files and can hang "Starting…".
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/target/**",
          "**/programs/**",
          "**/migrations/**",
          "**/tests/**",
          "**/.anchor/**",
          "**/test-ledger/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
