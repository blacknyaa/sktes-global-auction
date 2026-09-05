"use client";

import { useEffect } from "react";
import { KikuMark } from "./Ornaments";

export function AmbientFX() {
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

    const watch = () => {
      document.querySelectorAll(".reveal:not([data-watched])").forEach((node) => {
        node.setAttribute("data-watched", "1");
        io.observe(node);
      });
    };

    document.documentElement.setAttribute("data-fx", "on");
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    watch();

    document.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <>
      <div id="cursor-glow" className="cursor-glow" aria-hidden="true" />
      <div className="lantern-float lantern-float-l" aria-hidden="true" />
      <div className="lantern-float lantern-float-r" aria-hidden="true" />
    </>
  );
}

export function WaTitle({
  tate,
  kicker,
  title,
  lead,
}: {
  tate: string;
  kicker: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="reveal flex items-start gap-5">
      <span className="tategaki hidden pt-1 text-sm sm:block">{tate}</span>
      <div className="min-w-0">
        <p className="wa-kicker">
          <KikuMark />
          {kicker}
          <KikuMark />
        </p>
        <h2 className="font-serif mt-2 text-3xl font-bold tracking-wide text-ink sm:text-4xl">
          {title}
        </h2>
        {lead && <p className="mt-3 max-w-2xl text-base text-ink-2">{lead}</p>}
        <span className="mizuhiki" />
      </div>
    </div>
  );
}
