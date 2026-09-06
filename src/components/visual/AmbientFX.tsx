"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { KikuMark } from "./Ornaments";

/** Screens that carry business data, where the decoration would sit on top of it. */
const WORKSPACE = [
  "/dashboard",
  "/bids",
  "/contracts",
  "/listings",
  "/lots",
  "/reports",
  "/settings",
  "/admin",
  "/invoice",
  "/denied",
];

export function AmbientFX() {
  const pathname = usePathname();
  const workspace = WORKSPACE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const hit = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "a, button, .btn, .card, .badge, summary, .fx, .tilt, [role='button']"
      );
      if (!hit) return;

      const box = hit.getBoundingClientRect();
      if (box.width < 8 || box.height < 8) return;

      // A pane of light laid over what was pressed, cut to the same outline,
      // so the glint looks like it travels through the thing itself.
      const sheen = document.createElement("span");
      sheen.className = "click-sheen";
      sheen.style.left = `${box.left}px`;
      sheen.style.top = `${box.top}px`;
      sheen.style.width = `${box.width}px`;
      sheen.style.height = `${box.height}px`;
      sheen.style.borderRadius = getComputedStyle(hit).borderRadius;
      sheen.append(document.createElement("i"));
      document.body.append(sheen);
      window.setTimeout(() => sheen.remove(), 720);
    };

    const onMove = (e: MouseEvent) => {
      const glow = document.getElementById("cursor-glow");
      if (glow) {
        glow.style.transform = `translate3d(${e.clientX - 90}px, ${e.clientY - 90}px, 0)`;
      }
      const el = (e.target as HTMLElement | null)?.closest(".tilt") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(920px) rotateY(${x * 9}deg) rotateX(${-y * 7}deg) translateY(-6px)`;
    };

    const onOut = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest(".tilt") as HTMLElement | null;
      const related = e.relatedTarget as HTMLElement | null;
      if (el && (!related || !el.contains(related))) {
        el.style.transform = "";
      }
    };

    // These handlers write to the page, and React may still be adopting the
    // server markup. Nothing is bound until the document has finished loading,
    // by which time hydration is over. Sections that drift into view are left
    // to CSS, so no code touches those nodes at all.
    let bound = false;
    const start = () => {
      if (bound) return;
      bound = true;
      document.addEventListener("click", onClick);
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseout", onOut);
    };
    const startWhenIdle = () =>
      requestAnimationFrame(() => requestAnimationFrame(start));
    if (document.readyState === "complete") startWhenIdle();
    else window.addEventListener("load", startWhenIdle, { once: true });

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("load", startWhenIdle);
    };
  }, []);

  // The decoration is put into the page by hand rather than rendered, so that
  // React has nothing to adopt here and the body it hydrates holds only the
  // real content. It goes in once the document has finished loading.
  useEffect(() => {
    let cancelled = false;
    const nodes: HTMLElement[] = [];

    const mount = () => {
      if (cancelled) return;
      const glow = document.createElement("div");
      glow.id = "cursor-glow";
      glow.className = "cursor-glow";
      glow.setAttribute("aria-hidden", "true");
      nodes.push(glow);

      if (!workspace) {
        for (const side of ["l", "r"]) {
          const lantern = document.createElement("div");
          lantern.className = `lantern-float lantern-float-${side}`;
          lantern.setAttribute("aria-hidden", "true");
          nodes.push(lantern);
        }
      }
      document.body.append(...nodes);
    };

    const mountWhenIdle = () =>
      requestAnimationFrame(() => requestAnimationFrame(mount));
    if (document.readyState === "complete") mountWhenIdle();
    else window.addEventListener("load", mountWhenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", mountWhenIdle);
      for (const node of nodes) node.remove();
    };
  }, [workspace]);

  return null;
}

export function WaTitle({
  tate,
  kicker,
  title,
  lead,
  as = "h2",
}: {
  tate: string;
  kicker: string;
  title: string;
  lead?: string;
  as?: "h1" | "h2";
}) {
  const Heading = as;
  return (
    <div className="reveal flex items-start gap-5">
      <span className="tategaki hidden pt-1 text-sm sm:block">{tate}</span>
      <div className="min-w-0">
        <p className="wa-kicker">
          <KikuMark />
          {kicker}
          <KikuMark />
        </p>
        <Heading className="font-serif mt-2 text-3xl font-bold tracking-wide text-ink sm:text-4xl">
          {title}
        </Heading>
        {lead && <p className="mt-3 max-w-2xl text-base text-ink-2">{lead}</p>}
        <span className="mizuhiki" />
      </div>
    </div>
  );
}
