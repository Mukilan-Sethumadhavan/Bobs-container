import { Home, FileText, Package, Settings, Sparkles, Zap, Link2, MessageSquare } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Instant Proposal",
    url: "/",
    icon: Zap,
    testId: "link-instant-proposal",
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    testId: "link-dashboard",
  },
  {
    title: "Quick Proposal (3-Step)",
    url: "/quick-proposal",
    icon: Sparkles,
    testId: "link-quick-proposal",
  },
  {
    title: "Manual Proposal",
    url: "/new-proposal",
    icon: FileText,
    testId: "link-new-proposal",
  },
  {
    title: "Product Catalog",
    url: "/catalog",
    icon: Package,
    testId: "link-catalog",
  },
  {
    title: "HubSpot Settings",
    url: "/hubspot",
    icon: Link2,
    testId: "link-hubspot",
  },
  {
    title: "HubSpot Conversations",
    url: "/hubspot/conversations",
    icon: MessageSquare,
    testId: "link-hubspot-conversations",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    testId: "link-settings",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Bob's Containers</h2>
            <p className="text-xs text-muted-foreground">HubSpot → Proposal Generator</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
