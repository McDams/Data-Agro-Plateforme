import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Sprout, Map, Cpu, BarChart2, Brain, Bell,
  FileText, Settings, Users, ShieldCheck, Server, ScrollText,
  ChevronLeft, ChevronRight, X, Tractor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const farmerNav = [
  { to: "/tableau-de-bord", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/exploitations", icon: Tractor, label: "Exploitations" },
  { to: "/parcelles", icon: Map, label: "Parcelles" },
  { to: "/appareils", icon: Cpu, label: "Appareils" },
  { to: "/analytiques", icon: BarChart2, label: "Analytiques" },
  { to: "/predictions", icon: Brain, label: "Prédictions" },
  { to: "/alertes", icon: Bell, label: "Alertes" },
  { to: "/rapports", icon: FileText, label: "Rapports" },
  { to: "/parametres", icon: Settings, label: "Paramètres" },
];

const adminNav = [
  { to: "/admin", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/admin/utilisateurs", icon: Users, label: "Utilisateurs" },
  { to: "/admin/exploitations", icon: Tractor, label: "Exploitations" },
  { to: "/admin/appareils", icon: Cpu, label: "Appareils" },
  { to: "/admin/alertes", icon: Bell, label: "Alertes" },
  { to: "/admin/audit", icon: ScrollText, label: "Journal d'audit" },
  { to: "/admin/systeme", icon: Server, label: "Système" },
];

function NavItem({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === "/admin"}
      data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
      className={({ isActive }) =>
        cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export function SidebarContent({ collapsed, onClose }) {
  const { user } = useAuth();
  const nav = user?.role === "admin" ? adminNav : farmerNav;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 h-16 border-b border-border shrink-0",
        collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sprout size={16} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-base text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              AgriFlow
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sprout size={16} className="text-primary-foreground" />
          </div>
        )}
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X size={16} />
          </Button>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-2">
          <span className={cn("text-xs font-semibold tracking-widest uppercase px-2 py-1 rounded",
            user?.role === "admin" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-primary/10 text-primary dark:bg-primary/20")}>
            {user?.role === "admin" ? "Administration" : "Agriculteur"}
          </span>
        </div>
      )}

      {/* Nav items */}
      <nav data-testid="sidebar-nav" className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {nav.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* User info */}
      {!collapsed && user && (
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-primary">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn("hidden md:flex flex-col transition-sidebar relative shrink-0",
        collapsed ? "w-16" : "w-64")}>
        <SidebarContent collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          data-testid="sidebar-toggle"
          className="absolute -right-3 top-20 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <SidebarContent onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export { SidebarContent as default_SidebarContent };
