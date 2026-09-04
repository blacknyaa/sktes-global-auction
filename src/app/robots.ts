import type { MetadataRoute } from "next";

const BASE = process.env.SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/guide", "/register", "/terms"],
        disallow: [
          "/dashboard",
          "/lots",
          "/listings",
          "/bids",
          "/contracts",
          "/invoice",
          "/admin",
          "/settings",
          "/api",
          "/login",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
