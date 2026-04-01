
import { LifeOSView } from "../store/useLifeOSStore";
import clsx from "clsx";
import { BookOpen, LayoutDashboard, MessageCircle, Upload, Sparkles, HardDrive, Monitor } from "lucide-react";
import type { ElementType } from "react";

const NAV_ITEMS: Array<{
  view: LifeOSView;
  label: string;
  subtitle: string;
  icon: ElementType;
}> = [
  {
    view: "upload",
    label: "Data Studio",
    subtitle: "Import and structure files",
    icon: Upload,
  },
  {
    view: "insights",
    label: "Insight Lab",
    subtitle: "Spot patterns and trends",
    icon: LayoutDashboard,
  },
  {
    view: "chat",
    label: "Ask LifeOS",
    subtitle: "Converse with your data",
    icon: MessageCircle,
  },
  {
    view: "reports",
    label: "Reports",
    subtitle: "Curate shareable briefs",
    icon: BookOpen,
  },
  {
    view: "file_manager",
    label: "Local Brain OS",
    subtitle: "AI File Management",
    icon: HardDrive,
  },
  {
    view: "os_assistant",
    label: "OS Assistant",
    subtitle: "AI-powered OS control",
    icon: Monitor,
  },
];

type NavBarProps = {
  active: LifeOSView;
  onSelect: (view: LifeOSView) => void;
};

export function NavBar({ active, onSelect }: NavBarProps) {
  return (
    <nav className="flex min-h-full flex-col gap-8 bg-gradient-to-b from-navy-900 via-navy-950 to-obsidian-950 px-5 py-8 text-slate-100 shadow-premium-lg border-r border-champagne-500/10">
      {/* Brand Section */}
      <div className="space-y-2 px-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-champagne-400 via-champagne-500 to-blush-500 p-2 shadow-gold-glow">
            <Sparkles className="h-full w-full text-white" />
          </div>
          <div>
            <div className="font-display text-2xl font-semibold tracking-tight text-white">
              LifeOS
            </div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-champagne-400/70">
              Intelligence Hub
            </span>
          </div>
        </div>
      </div>

      {/* Decorative Line */}
      <div className="mx-2 h-px bg-gradient-to-r from-transparent via-champagne-500/30 to-transparent" />

      {/* Navigation Items */}
      <div className="flex flex-1 flex-col gap-2 px-1">
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const isActive = active === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onSelect(item.view)}
              style={{ animationDelay: `${index * 100}ms` }}
              className={clsx(
                "group relative flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all duration-300 animate-fade-in",
                isActive
                  ? "bg-gradient-to-r from-champagne-500/20 via-champagne-400/15 to-transparent text-white shadow-lg shadow-champagne-500/10 border border-champagne-500/20"
                  : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"
              )}
            >
              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-champagne-400 to-blush-500 shadow-gold-glow" />
              )}
              
              <div
                className={clsx(
                  "flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300",
                  isActive
                    ? "border-champagne-400/40 bg-gradient-to-br from-champagne-500/30 via-champagne-400/20 to-transparent text-champagne-300 shadow-inner"
                    : "border-slate-700/50 bg-slate-800/50 text-slate-400 group-hover:border-champagne-500/30 group-hover:text-champagne-300 group-hover:bg-slate-800"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className={clsx(
                  "text-sm font-semibold tracking-wide transition-colors",
                  isActive ? "text-champagne-200" : "group-hover:text-champagne-200"
                )}>
                  {item.label}
                </span>
                <span className={clsx(
                  "text-xs transition-colors",
                  isActive ? "text-champagne-400/70" : "text-slate-500 group-hover:text-slate-400"
                )}>
                  {item.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Section */}
      <div className="space-y-4 px-2">
        {/* Decorative Line */}
        <div className="h-px bg-gradient-to-r from-transparent via-champagne-500/20 to-transparent" />
        
        <div className="rounded-2xl border border-champagne-500/10 bg-gradient-to-br from-navy-800/50 to-navy-900/50 p-4 backdrop-blur">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-soft shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <p className="text-xs font-semibold uppercase tracking-wider text-champagne-300/90">
              Private-by-design
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            All computation runs locally. Your data never leaves your device.
          </p>
        </div>
      </div>
    </nav>
  );
}
