// src/components/PlanGuard.jsx
import React from "react";

/**
 * Placeholder simple: deja pasar siempre.
 * Más adelante puedes validar plan, trial, etc.
 */
export default function PlanGuard({ children, allowDuringTrial = true }) {
  return <>{children}</>;
}
