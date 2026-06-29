import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import api from "@/utils/api";
import {
  Bell, Sun, Moon, LogOut, User, Settings, Menu, ChevronDown, Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarContent } from "./Sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NAV, AUTH } from "@/constants/testIds";

export default function TopHeader() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    api.get("/alerts?is_resolved=false&limit=10")
      .then((r) => setAlertCount(r.data.filter((a) => !a.is_read).length))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/connexion");
  };

  return (
    <header
      data-testid={NAV.topHeader}
      className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0 z-10"
    >
      {/* Mobile menu */}
      <div className="flex items-center gap-3 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </Button>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sprout size={14} className="text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            AgriFlow
          </span>
        </div>
      </div>

      {/* Desktop: Page title area */}
      <div className="hidden md:block" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggle} title="Changer le thème" className="h-9 w-9">
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </Button>

        {/* Notifications */}
        <Link to={user?.role === "admin" ? "/admin/alertes" : "/alertes"}>
          <Button variant="ghost" size="icon" className="h-9 w-9 relative">
            <Bell size={18} />
            {alertCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center bg-destructive border-0">
                {alertCount > 9 ? "9+" : alertCount}
              </Badge>
            )}
          </Button>
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              data-testid={NAV.userMenu}
              className="flex items-center gap-2 h-9 px-3"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              </div>
              <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
                {user?.first_name}
              </span>
              <ChevronDown size={14} className="hidden sm:block text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(user?.role === "admin" ? "/admin/systeme" : "/parametres")}>
              <User size={14} className="mr-2" /> Mon profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(user?.role === "admin" ? "/admin/systeme" : "/parametres")}>
              <Settings size={14} className="mr-2" /> Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid={AUTH.logoutButton}
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut size={14} className="mr-2" /> Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
