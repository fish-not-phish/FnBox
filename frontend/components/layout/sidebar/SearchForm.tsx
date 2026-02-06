"use client";

import { Search, Command as CommandIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { sidebarData } from "./data";

export const SearchForm = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  // Build searchable items from sidebar data
  const searchableItems = sidebarData.navGroups.flatMap((group) =>
    group.items.flatMap((item) => {
      const items = [{ label: item.label, url: item.href, group: group.title }];

      // Add nested items if they exist
      if (item.children) {
        item.children.forEach((subItem) => {
          items.push({
            label: `${item.label} > ${subItem.label}`,
            url: subItem.href,
            group: group.title,
          });
        });
      }

      return items;
    })
  );

  // Filter items based on search
  const filteredItems = search
    ? searchableItems.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      )
    : searchableItems;

  // Handle item selection
  const handleSelect = (url: string) => {
    setOpen(false);
    setSearch("");
    router.push(url);
  };

  // Close on escape
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <SidebarGroup className="py-0 group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <button
            onClick={() => setOpen(true)}
            className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <Search className="size-4 opacity-50" />
            <span className="flex-1 text-left text-muted-foreground">
              Search pages...
            </span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <CommandIcon className="size-3" />
              K
            </kbd>
          </button>
        </SidebarGroupContent>
      </SidebarGroup>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-[500px]">
          <Command>
            <CommandInput
              placeholder="Search pages..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {Object.entries(
                filteredItems.reduce((acc, item) => {
                  if (!acc[item.group]) acc[item.group] = [];
                  acc[item.group].push(item);
                  return acc;
                }, {} as Record<string, typeof filteredItems>)
              ).map(([group, items]) => (
                <CommandGroup key={group} heading={group}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.url}
                      onSelect={() => handleSelect(item.url)}
                      className="cursor-pointer"
                    >
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};
