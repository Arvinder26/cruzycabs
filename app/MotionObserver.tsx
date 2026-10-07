"use client";

import { useEffect } from "react";

const REVEAL_TARGETS = [
  "main > section:not(.hero):not(.content-hero)",
  ".content-page > section:not(.content-hero)",
  ".site-footer",
].join(", ");

export function MotionObserver() {
  useEffect(() => {
    const root = document.documentElement;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_TARGETS));

    root.classList.add("motion-enabled");
    elements.forEach((element) => element.classList.add("motion-reveal"));

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return () => root.classList.remove("motion-enabled");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      root.classList.remove("motion-enabled");
    };
  }, []);

  return null;
}
