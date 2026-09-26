import { useEffect, useState } from "react";
import { Layers, Square } from "lucide-react";

type BgMode = "layered" | "classic";

const STORAGE_KEY = "hygienesense-bg-mode";

export function BackgroundToggle() {
  const [mode, setMode] = useState<BgMode>("layered");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "classic" || saved === "layered") setMode(saved);
  }, []);

  useEffect(() => {
    if (mode === "classic") {
      document.body.dataset["bg"] = "classic";
    } else {
      delete document.body.dataset["bg"];
    }
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const options: { value: BgMode; label: string; icon: typeof Layers }[] = [
    { value: "layered", label: "Layered", icon: Layers },
    { value: "classic", label: "Classic", icon: Square },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-border bg-card/90 p-1 shadow-soft backdrop-blur-md">
      <span className="hidden pl-2 pr-1 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground sm:inline">
        Background
      </span>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          aria-pressed={mode === value}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
