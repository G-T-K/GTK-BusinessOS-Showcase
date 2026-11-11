"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { hasPermission, type Permission } from "@/lib/role-permissions";

const links = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard" },
  { href: "/customers", label: "Customers", permission: "sales" },
  { href: "/inventory", label: "Inventory", permission: "inventory" },
  { href: "/sales/quotations", label: "Quotations", permission: "sales" },
  { href: "/sales/invoices", label: "Invoices", permission: "sales" },
  { href: "/purchases", label: "Purchases", permission: "purchasing" },
  { href: "/purchases/bills", label: "Bills", permission: "finance" },
  { href: "/purchases/payables", label: "Payables", permission: "finance" },
  { href: "/expenses", label: "Expenses", permission: "finance" },
  { href: "/finance/accounts", label: "Accounts", permission: "finance" },
  { href: "/payroll", label: "Payroll", permission: "payroll" },
  { href: "/payroll/my-payslips", label: "My payslips", permission: "payrollSelf" },
  { href: "/reports", label: "Reports", permission: "reports" },
  { href: "/copilot", label: "Copilot", permission: "reports" },
  { href: "/settings/users", label: "Users", permission: "settings" },
  { href: "/settings/billing", label: "Billing", permission: "settings" },
  { href: "/settings/audit-log", label: "Audit Log", permission: "settings" },
  { href: "/settings/business", label: "Business profile", permission: "settings" },
] satisfies readonly { href: string; label: string; permission: Permission }[];

export function AppNavLinks({ companyName, role }: { companyName: string; role: unknown }) {
  const pathname = usePathname();
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollDirectionRef = useRef<-1 | 1>(1);
  const [scrollBounds, setScrollBounds] = useState({ left: false, right: false });
  const visibleLinks = links.filter((link) => hasPermission(role, link.permission));
  const activeHref = visibleLinks
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0]?.href;

  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const startAutoScroll = (direction: -1 | 1) => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;

    autoScrollDirectionRef.current = direction;
    if (autoScrollFrameRef.current !== null) return;

    const step = () => {
      const element = navRef.current;
      if (!element) {
        autoScrollFrameRef.current = null;
        return;
      }

      const maxScroll = element.scrollWidth - element.clientWidth;
      const nextScroll = Math.max(
        0,
        Math.min(maxScroll, element.scrollLeft + autoScrollDirectionRef.current * 4),
      );
      if (nextScroll === element.scrollLeft) {
        autoScrollFrameRef.current = null;
        return;
      }

      element.scrollLeft = nextScroll;
      autoScrollFrameRef.current = window.requestAnimationFrame(step);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      activeTabRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [pathname]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const updateScrollBounds = () => {
      const maxScroll = nav.scrollWidth - nav.clientWidth;
      const left = nav.scrollLeft > 0;
      const right = maxScroll - nav.scrollLeft > 1;
      setScrollBounds((current) => (
        current.left === left && current.right === right ? current : { left, right }
      ));
    };

    updateScrollBounds();
    nav.addEventListener("scroll", updateScrollBounds, { passive: true });
    window.addEventListener("resize", updateScrollBounds);
    const resizeObserver = new ResizeObserver(updateScrollBounds);
    resizeObserver.observe(nav);

    return () => {
      nav.removeEventListener("scroll", updateScrollBounds);
      window.removeEventListener("resize", updateScrollBounds);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
    }
  }, []);

  return (
    <div className="relative flex min-w-0 w-full flex-1 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <nav ref={navRef} className="flex w-full items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <span className="shrink-0 pl-1 text-sm font-semibold text-gray-900 md:hidden">
          GTK BusinessOS
        </span>
        {visibleLinks.map((link) => {
          const isActive = link.href === activeHref;

          return (
            <Link
              key={link.href}
              ref={isActive ? activeTabRef : null}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-green-700 to-green-500 font-semibold text-white shadow-md"
                  : "bg-gray-100 text-gray-500 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <span className="mx-1 h-6 w-px shrink-0 bg-gray-300 md:hidden" aria-hidden="true" />
        <span className="shrink-0 pr-4 text-sm text-gray-500 md:hidden">
          {companyName}
        </span>
        </nav>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-white to-transparent md:hidden" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white to-transparent md:hidden" />
        {scrollBounds.left && <button
          type="button"
          aria-label="Scroll navigation left"
          title="Hold to scroll left"
          onMouseEnter={() => startAutoScroll(-1)}
          onMouseLeave={stopAutoScroll}
          onClick={() => navRef.current?.scrollBy({ left: -180, behavior: "smooth" })}
          className="absolute inset-y-0 left-0 z-10 hidden w-8 items-center justify-start bg-gradient-to-r from-white via-white/90 to-transparent pl-1 text-gray-500 hover:text-green-700 md:flex"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>}
        {scrollBounds.right && <button
          type="button"
          aria-label="Scroll navigation right"
          title="Hold to scroll right"
          onMouseEnter={() => startAutoScroll(1)}
          onMouseLeave={stopAutoScroll}
          onClick={() => navRef.current?.scrollBy({ left: 180, behavior: "smooth" })}
          className="absolute inset-y-0 right-0 z-10 hidden w-8 items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent pr-1 text-gray-500 hover:text-green-700 md:flex"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>}
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-1"
      >
        <LogOut size={16} aria-hidden="true" />
        <span>Log out</span>
      </button>
    </div>
  );
}