import {
  BarChart3,
  Bug,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Sun,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  labelKey: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", labelKey: "nav.today", icon: Sun },
  { href: "/dashboard", label: "Dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", labelKey: "nav.projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", labelKey: "nav.tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", labelKey: "nav.calendar", icon: CalendarDays },
  { href: "/bugs", label: "Bugs", labelKey: "nav.bugs", icon: Bug },
  { href: "/notes", label: "Notes", labelKey: "nav.notes", icon: StickyNote },
  { href: "/analytics", label: "Analytics", labelKey: "nav.analytics", icon: BarChart3 },
];
