import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#111827]/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-white/10 group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.4)] group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-white/60",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-white/5 group-[.toast]:text-white/60 group-[.toast]:rounded-lg",
          error:
            "group-[.toaster]:bg-red-950/90 group-[.toaster]:border-red-500/30 group-[.toaster]:text-red-50 group-[.toaster]:shadow-[0_8px_32px_rgba(239,68,68,0.15)]",
          success:
            "group-[.toaster]:bg-emerald-950/90 group-[.toaster]:border-emerald-500/30 group-[.toaster]:text-emerald-50 group-[.toaster]:shadow-[0_8px_32px_rgba(16,185,129,0.15)]",
          warning:
            "group-[.toaster]:bg-amber-950/90 group-[.toaster]:border-amber-500/30 group-[.toaster]:text-amber-50 group-[.toaster]:shadow-[0_8px_32px_rgba(245,158,11,0.15)]",
          info:
            "group-[.toaster]:bg-blue-950/90 group-[.toaster]:border-blue-500/30 group-[.toaster]:text-blue-50 group-[.toaster]:shadow-[0_8px_32px_rgba(59,130,246,0.15)]",
        },
      }}
      style={
        {
          "--toast-z-index": "9999",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster, toast };
