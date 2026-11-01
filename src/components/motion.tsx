"use client";

import { useEffect, useRef, useState } from "react";

const stillMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const check = () => {
      const node = ref.current;
      if (!node || node.getBoundingClientRect().top > window.innerHeight * 0.92) return;
      setSeen(true);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
    // A plain scroll check, because content must never stay hidden if an observer callback is missed.
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  return [ref, seen] as const;
}

// Adds .in once on screen. The CSS in globals.css does the rest.
export function Reveal({
  children,
  className = "",
  delay = 0,
  plain,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  plain?: boolean;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`${plain ? "" : "reveal"} ${seen ? "in" : ""} ${className}`}
      style={{ "--d": `${delay}s` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

const format = (value: number, decimals: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  delay = 0,
  className = "",
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  className?: string;
}) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (stillMotion()) return setValue(to);
    const started = performance.now() + delay * 1000;
    const timer = setInterval(() => {
      const progress = Math.min(Math.max((performance.now() - started) / 1200, 0), 1);
      setValue(to * (1 - (1 - progress) ** 3));
      if (progress === 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [seen, to, delay]);
  return (
    <span ref={ref} className={`num ${className}`} aria-label={`${prefix}${format(to, decimals)}${suffix}`}>
      <span aria-hidden>
        {prefix}
        {format(value, decimals)}
        {suffix}
      </span>
    </span>
  );
}

// The hero pill flips between the claim and what the data says.
export function ClaimFlip({ claimed, found }: { claimed: string; found: string }) {
  const [showFound, setShowFound] = useState(false);
  useEffect(() => {
    if (stillMotion()) return;
    const timer = setInterval(() => setShowFound((state) => !state), 2600);
    return () => clearInterval(timer);
  }, []);
  return (
    <span
      className={`inline-flex min-w-[4.1em] translate-y-1 items-center justify-center overflow-hidden rounded-full border px-3 py-1 align-middle text-[0.62em] transition-colors duration-500 sm:translate-y-0 ${
        showFound ? "border-accent bg-accent text-white" : "border-ink/70 bg-white"
      }`}
    >
      <span key={String(showFound)} className="swap num">
        {showFound ? found : claimed}
      </span>
    </span>
  );
}
