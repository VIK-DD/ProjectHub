import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card/40 lg:flex">
      <div className="flex h-14 items-center px-5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <p className="px-2.5 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Workspace
        </p>
        <SidebarNav />
      </div>
      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Quick search</span>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </div>
      </div>
    </aside>
  );
}
