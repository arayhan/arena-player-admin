import { NavDrawer } from "@/components/nav-drawer";

import { BrandMark } from "@/components/brand-mark";
import { SidebarNav } from "./_components/sidebar-nav";

// Server Component. Wraps every authenticated route ("/", "/bookings", ...)
// with the sidebar/drawer shell; `/login` sits outside this route group so
// it renders full-screen with no nav chrome. The middleware still gates
// every route under here — this layout only supplies the chrome, not the
// session check.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavDrawer nav={<SidebarNav />} topbarBrand={<BrandMark size="sm" />}>
      {children}
    </NavDrawer>
  );
}
