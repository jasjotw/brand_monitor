import { createContext, ReactNode, useContext } from "react";

const AnalysisContext = createContext({
  showValues: true,
});

export function AnalysisProvider({
  children,
  showValues,
}: {
  children: ReactNode;
  showValues: boolean;
}) {
  return (
    <AnalysisContext.Provider value={{ showValues }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisVisibility() {
  return useContext(AnalysisContext);
}
