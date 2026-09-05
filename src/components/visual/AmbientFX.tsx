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
    (p) => pathname === p || pathname.startsWith(`src/components/visual/AmbientFX.tsx/`)
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("a, button, .btn, .card, .badge, summary, .fx, .tilt, [role='button']")) {
        return;
      }
      const ripple = document.createElement("span");
      ripple.className = "click-ripple";
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      const ink = document.createElement("span");
      ink.className = "click-ink";
      ink.style.left = `${e.clientX}px`;
      ink.style.top = `${e.clientY}px`;
      document.body.append(ripple, ink);
      window.setTimeout(() => {
        ripple.remove();
        ink.remove();
      }, 800);
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

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    // Anything this touches, React may still be hydrating. Marking a node
    // with an attribute or a class while its markup is being adopted makes the
    // server HTML and the client tree disagree, so the whole subtree is thrown
    // away and drawn again. The nodes already seen are therefore remembered
    // off to one side, and none of it starts until the document has finished
    // loading and hydration is over.
    const seen = new WeakSet<Element>();
    const watch = () => {
      document.querySelectorAll(".reveal").forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        io.observe(node);
      });
    };

    const mo = new MutationObserver(watch);
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      // Whatever is already on screen stays on screen: settle it before the
      // fade-in rule starts applying, or the page would blink once.
      document.querySelectorAll(".reveal").forEach((node) => {
        const box = node.getBoundingClientRect();
        if (box.top < window.innerHeight * 0.92 && box.bottom > 0) {
          node.classList.add("is-in");
        }
      });
      document.documentElement.setAttribute("data-fx", "on");
      mo.observe(document.body, { childList: true, subtree: true });
      watch();
    };
    const startWhenIdle = () => requestAnimationFrame(() => requestAnimationFrame(start));
    if (document.readyState === "complete") startWhenIdle();
    else window.addEventListener("load", startWhenIdle, { once: true });

    document.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("load", startWhenIdle);
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <>
      <div id="cursor-glow" className="cursor-glow" aria-hidden="true" />
      {!workspace && (
        <>
          <div className="lantern-float lantern-float-l" aria-hidden="true" />
          <div className="lantern-float lantern-float-r" aria-hidden="true" />
        </>
      )}
    </>
  );
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
