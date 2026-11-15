import { useEffect, type ReactNode } from "react";
import { useNoindex } from "@/hooks/usePageMeta";

/**
 * Forces the delivery partner section to always render in light mode,
 * regardless of the user's theme preference. The previous theme is restored
 * when the wrapper unmounts (i.e. when the user navigates away).
 */
const DeliveryLightThemeWrapper = ({ children }: { children: ReactNode }) => {
  // The delivery partners' app (login included) stays out of search.
  useNoindex();
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    if (hadDark) root.classList.remove("dark");
    return () => {
      if (hadDark) root.classList.add("dark");
    };
  }, []);

  return <>{children}</>;
};

export default DeliveryLightThemeWrapper;
