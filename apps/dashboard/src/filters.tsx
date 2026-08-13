import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Filter state is fully represented in URL parameters so views are
 * shareable/bookmarkable: ?site=..&range=7d&mode=all&path=.. etc.
 */
export interface FilterState {
  site: string | null;
  range: string;
  from: string | null;
  to: string | null;
  mode: string | null;
  includeBots: boolean;
  params: Record<string, string | undefined>;
  set: (key: string, value: string | null) => void;
}

const FiltersContext = createContext<FilterState>(null as unknown as FilterState);

export const RANGES = [
  { id: "today", label: "Heute" },
  { id: "yesterday", label: "Gestern" },
  { id: "7d", label: "7 Tage" },
  { id: "30d", label: "30 Tage" },
  { id: "this-month", label: "Dieser Monat" },
  { id: "last-month", label: "Letzter Monat" },
  { id: "custom", label: "Benutzerdefiniert" }
] as const;

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const set = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null || value === "") next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  const get = (k: string) => searchParams.get(k);
  const params: Record<string, string | undefined> = {};
  searchParams.forEach((v, k) => {
    params[k] = v;
  });

  const value: FilterState = {
    site: get("site"),
    range: get("range") ?? "7d",
    from: get("from"),
    to: get("to"),
    mode: get("mode"),
    includeBots: get("includeBots") === "true",
    params,
    set
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FilterState {
  return useContext(FiltersContext);
}
