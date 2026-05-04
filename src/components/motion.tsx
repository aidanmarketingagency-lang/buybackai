"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";

// Motion tokens — mirror the CSS tokens in globals.css. Source of truth is
// docs/MOTION-SPEC.md. Keep these aligned by hand: the CSS animations and
// the Framer Motion code share the same easing curves, durations, and
// stagger timings.
export const ease = [0.16, 1, 0.3, 1] as const;
export const easeIn = [0.7, 0, 0.84, 0] as const;
export const spring = {
  type: "spring" as const,
  stiffness: 320,
  damping: 26,
  mass: 0.8,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.68, ease } },
};

export const fadeUpQuick: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

interface RevealProps extends Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate" | "whileInView"> {
  delay?: number;
  once?: boolean;
  amount?: number;
  variant?: "default" | "quick";
}

export function Reveal({
  children,
  delay = 0,
  once = true,
  amount = 0.2,
  variant = "default",
  ...rest
}: RevealProps) {
  const reduce = useReducedMotion();
  const v = variant === "quick" ? fadeUpQuick : fadeUp;
  return (
    <motion.div
      initial={reduce ? "show" : "hidden"}
      whileInView="show"
      viewport={{ once, amount }}
      variants={v}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps extends Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate" | "whileInView"> {
  speed?: "default" | "slow";
  amount?: number;
  once?: boolean;
}

export function Stagger({
  children,
  speed = "default",
  amount = 0.15,
  once = true,
  ...rest
}: StaggerProps) {
  const reduce = useReducedMotion();
  const v = speed === "slow" ? staggerContainerSlow : staggerContainer;
  return (
    <motion.div
      initial={reduce ? "show" : "hidden"}
      whileInView="show"
      viewport={{ once, amount }}
      variants={v}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  variant = "default",
  ...rest
}: Omit<HTMLMotionProps<"div">, "variants"> & { variant?: "default" | "quick" }) {
  const v = variant === "quick" ? fadeUpQuick : fadeUp;
  return (
    <motion.div variants={v} {...rest}>
      {children}
    </motion.div>
  );
}
