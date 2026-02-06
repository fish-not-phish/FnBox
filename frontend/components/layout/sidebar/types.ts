import * as React from "react";

// Base nav item - used by simple sidebars
export type NavItem = {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href: string;
  isActive?: boolean;
  // Optional children for submenus
  children?: NavItem[];
};

// Nav group with optional collapsible state
export type NavGroup = {
  title: string;
  items: NavItem[];
  // Optional: default collapsed state
  defaultOpen?: boolean;
};

// User data for footer
export type UserData = {
  name: string;
  email: string;
  avatar: string;
};

// Workspace/Team data for switcher
export type Workspace = {
  id: string;
  name: string;
  logo: string;
  plan: string;
};

// Complete sidebar data structure
export type SidebarData = {
  // Logo/branding
  logo: {
    src: string;
    alt: string;
    title: string;
    description: string;
  };
  // Main navigation groups
  navGroups: NavGroup[];
  // Footer navigation group
  footerGroup: NavGroup;
  // User data for user footer
  user?: UserData;
  // Workspaces for switcher
  workspaces?: Workspace[];
  // Currently active workspace
  activeWorkspace?: string;
};
