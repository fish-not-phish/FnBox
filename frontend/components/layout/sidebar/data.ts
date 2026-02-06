import {
  Code2,
  HelpCircle,
  Key,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  User,
  Users,
} from "lucide-react";
import { SidebarData } from "./types";

export const sidebarData: SidebarData = {
  logo: {
    src: "/logo.svg",
    alt: "FaaS Platform",
    title: "FaaS Platform",
    description: "Serverless Functions",
  },
  navGroups: [
    {
      title: "Overview",
      defaultOpen: true,
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          href: "/dashboard"
        },
        { label: "Functions", icon: Code2, href: "/functions" },
      ],
    },
    {
      title: "Development",
      defaultOpen: true,
      items: [
        { label: "Logs", icon: ScrollText, href: "/logs" },
      ],
    },
    {
      title: "Team",
      defaultOpen: false,
      items: [
        { label: "Members", icon: Users, href: "/team/members" },
        { label: "Vault", icon: Key, href: "/vault" },
        { label: "Dependencies", icon: Package, href: "/depsets" },
      ],
    },
  ],
  footerGroup: {
    title: "Support",
    items: [
      { label: "Account", icon: User, href: "/account" },
      { label: "Help Center", icon: HelpCircle, href: "/help" },
      { label: "Settings", icon: Settings, href: "/settings" },
    ],
  },
  user: {
    name: "John Doe",
    email: "john@example.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
  },
  workspaces: [
    {
      id: "1",
      name: "Personal",
      logo: "/logo.svg",
      plan: "Free",
    },
    {
      id: "2",
      name: "Acme Corp",
      logo: "/logo.svg",
      plan: "Team",
    },
    {
      id: "3",
      name: "Startup Inc",
      logo: "/logo.svg",
      plan: "Enterprise",
    },
  ],
  activeWorkspace: "1",
};

// Helper to get active workspace
export const getActiveWorkspace = (data: SidebarData) => {
  return data.workspaces?.find((w) => w.id === data.activeWorkspace);
};
