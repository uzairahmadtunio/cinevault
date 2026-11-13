import { useEffect, useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Download } from "lucide-react";

export function PwaInstallButton({ label }: { label: string }) {
  const { isInstallable, installed, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isInstallable && !installed);
  }, [isInstallable, installed]);

  if (!visible) return null;

  return (
    <button
      onClick={promptInstall}
      className="inline-flex items-center gap-2 rounded-full bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0ea5e9]"
    >
      <Download size={16} />
      {label}
    </button>
  );
}
