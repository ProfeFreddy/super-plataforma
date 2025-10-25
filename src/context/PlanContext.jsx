// src/context/PlanContext.js
import React, { createContext, useContext, useState } from "react";

// ðŸ‘‡ named export
export const PlanContext = createContext(null);

export function PlanProvider({ children, initialValue = {} }) {
  const [state, setState] = useState(initialValue);
  const value = { state, setState };
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export const usePlan = () => useContext(PlanContext);
