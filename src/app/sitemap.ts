import type { MetadataRoute } from "next";

const BASE = process.env.SITE_URL ?? "http://localhost:3000";

/**
 * Only the public pages belong here. Everything behind a login is excluded -
 * a sitemap listing lot URLs a crawler cannot reach is just noise, and a
 * closed marketplace should not advertise its inventory.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
