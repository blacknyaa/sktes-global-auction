import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The demo database built by scripts/build-demo-db.mjs is a plain file that
   * nothing imports, so Next's dependency tracing would not ship it to the
   * server bundle. Naming it here makes an unconfigured deployment work on its
   * own; when DATABASE_URL is set the file is never built and the entry is a
   * no-op.
   */
  outputFileTracingIncludes: {
    "/**": ["./prisma/demo.db"],
  },
};

export default nextConfig;
