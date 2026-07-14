/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Starts the EVM curve indexer with the server (instrumentation.ts).
    instrumentationHook: true,
    // Next 14: use `serverComponentsExternalPackages` (top-level `serverExternalPackages` is ignored).
    // Turbopack bundling @coral-xyz/borsh + @solana/web3.js together can strip `PublicKey` and break
    // `GET /api/presales` with: ReferenceError: PublicKey is not defined
    serverComponentsExternalPackages: [
      "@coral-xyz/anchor",
      "@coral-xyz/borsh",
      "@solana/web3.js",
      "@solana/spl-token",
      "bn.js",
      "buffer-layout",
      "pg",
      "@electric-sql/pglite",
    ],
    // Keep `next build` from tracing the Anchor tree (can be huge under target/)
    outputFileTracingExcludes: {
      "*": [
        "./target/**/*",
        "./programs/**/*",
        "./migrations/**/*",
        "./tests/**/*",
        "./evm/out/**/*",
        "./evm/cache/**/*",
        "./evm/lib/**/*",
      ],
    },
  },
  webpack: (config, { dev }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // @metamask/sdk (via wagmi connectors) optionally requires react-native storage.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
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
          "**/evm/out/**",
          "**/evm/cache/**",
          "**/evm/lib/**",
          "**/.data/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
