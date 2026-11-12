import { useEffect, useState } from "react";
import { CfdsModePage } from "../../features/cfds";
import { CmcModePage } from "../../features/cmc";
import { LabelLibraryPage } from "../../features/library";
import { PowerConsolePage } from "../../features/power-console";
import { StandardModePage } from "../../features/standard";
import { ModeSelectPage } from "../pages/ModeSelectPage";

function readPathname(): string {
  return window.location.pathname || "/";
}

export function navigateToRoute(path: string): void {
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

export function AppRouter() {
  const [pathname, setPathname] = useState<string>(readPathname);

  useEffect(() => {
    const onPopState = () => setPathname(readPathname());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  switch (pathname) {
    case "/standard":
      return <StandardModePage />;
    case "/cfds":
      return <CfdsModePage />;
    case "/cmc":
      return <CmcModePage />;
    case "/library":
      return <LabelLibraryPage />;
    case "/power":
      return <PowerConsolePage />;
    case "/":
    default:
      return <ModeSelectPage onSelectMode={(path) => navigateToRoute(path)} />;
  }
}
