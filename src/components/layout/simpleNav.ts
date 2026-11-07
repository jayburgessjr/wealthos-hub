import { Home, ClipboardList, Wallet, Sprout, GraduationCap, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SimpleNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** The item is active when the path equals `to` or starts with any prefix. */
  prefixes: string[];
}

/** Plain-language navigation for simple mode, mapped onto existing routes. */
export const simpleNavItems: SimpleNavItem[] = [
  { to: "/home", label: "Home", icon: Home, prefixes: ["/home"] },
  { to: "/household/future/goals", label: "My plan", icon: ClipboardList, prefixes: ["/household/future"] },
  { to: "/household/money-out/budget", label: "Money", icon: Wallet, prefixes: ["/household/money-in", "/household/money-out", "/household/manage"] },
  { to: "/wealth", label: "Grow", icon: Sprout, prefixes: ["/wealth"] },
  { to: "/learn", label: "Learn", icon: GraduationCap, prefixes: ["/learn"] },
  { to: "/invs/strategy", label: "Coach", icon: MessageCircle, prefixes: ["/invs/strategy"] },
];

export function isSimpleItemActive(item: SimpleNavItem, pathname: string): boolean {
  return item.prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
