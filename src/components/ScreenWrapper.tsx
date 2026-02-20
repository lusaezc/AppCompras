import { motion } from "framer-motion";
import type { ReactNode } from "react";

type ScreenWrapperProps = {
  children: ReactNode;
  className?: string;
};

export default function ScreenWrapper({
  children,
  className,
}: ScreenWrapperProps) {
  return (
    <motion.div
      className={["screen", className].filter(Boolean).join(" ")}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}
