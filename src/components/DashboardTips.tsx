"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Lightbulb, Pause, Play } from "lucide-react";

type DashboardPerformance = {
  overdueCount: number;
  outstandingLabel: string;
  lowStockCount: number;
  salesToday: number;
  salesLabel: string;
  collectionsToday: number;
  collectionsLabel: string;
  expensesToday: number;
  expensesLabel: string;
  stockValueLabel: string;
};

type BusinessTip = {
  category: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  priority?: "attention";
};

function buildTips(performance: DashboardPerformance): BusinessTip[] {
  const tips: BusinessTip[] = [];

  if (performance.overdueCount > 0) {
    tips.push({
      category: "Receivables",
      title: "Bring overdue invoices back into focus",
      detail: `${performance.overdueCount} invoice${performance.overdueCount === 1 ? " is" : "s are"} past due, totaling ${performance.outstandingLabel}. A timely reminder can help move payment forward.`,
      href: "/sales/invoices",
      action: "Review invoices",
      priority: "attention",
    });
  } else {
    tips.push({
      category: "Receivables",
      title: "Keep payment records current",
      detail: "No overdue invoices are flagged. Recording payments against the correct invoices keeps customer balances reliable.",
      href: "/sales/invoices",
      action: "Review invoices",
    });
  }

  if (performance.lowStockCount > 0) {
    tips.push({
      category: "Inventory",
      title: "Protect sales from stock gaps",
      detail: `${performance.lowStockCount} product${performance.lowStockCount === 1 ? " is" : "s are"} at or below reorder level. Review availability before your next busy period.`,
      href: "/inventory",
      action: "Review stock",
      priority: "attention",
    });
  } else {
    tips.push({
      category: "Inventory",
      title: "Keep reorder points useful",
      detail: performance.stockValueLabel
        ? `No low-stock alerts are active across ${performance.stockValueLabel} of inventory. Check reorder levels as supplier lead times change.`
        : "Keep product counts and reorder levels current so stock alerts can guide purchasing.",
      href: "/inventory",
      action: "Check inventory",
    });
  }

  if (performance.expensesToday > performance.salesToday && performance.expensesToday > 0) {
    tips.push({
      category: "Cost control",
      title: "Keep an eye on today's spending",
      detail: `Tracked expenses (${performance.expensesLabel}) are ahead of sales (${performance.salesLabel}) so far today. Check whether any costs can be planned or deferred.`,
      href: "/expenses",
      action: "Review expenses",
    });
  } else {
    tips.push({
      category: "Cost control",
      title: "Capture costs as they happen",
      detail: performance.expensesToday > 0
        ? `Tracked expenses are ${performance.expensesLabel} today. Recording each cost keeps the daily view complete.`
        : "No expenses are recorded today yet. Log costs as they happen to keep your business picture current.",
      href: "/expenses",
      action: "Review expenses",
    });
  }

  if (performance.collectionsToday > 0) {
    tips.push({
      category: "Cash flow",
      title: "Keep collections moving",
      detail: `${performance.collectionsLabel} collected today. Reconcile payments against open invoices while the activity is fresh.`,
      href: "/sales/invoices",
      action: "Check invoices",
    });
  }

  if (performance.salesToday > 0) {
    tips.push({
      category: "Daily trading",
      title: "Build on today's sales activity",
      detail: `${performance.salesLabel} in sales recorded today. Compare the day’s pace with recent reports before adjusting stock or staffing.`,
      href: "/reports",
      action: "View reports",
    });
  } else {
    tips.push({
      category: "Daily trading",
      title: "Make the next sale easier to close",
      detail: "Keep popular products easy to find and confirm their availability before preparing a quotation.",
      href: "/inventory",
      action: "Check inventory",
    });
  }

  if (performance.stockValueLabel !== "") {
    tips.push({
      category: "Stock planning",
      title: "Use stock value to guide purchasing",
      detail: `Current stock is valued at ${performance.stockValueLabel}. Review reorder levels alongside stock value to keep cash available for fast-moving items.`,
      href: "/purchases",
      action: "Review purchases",
    });
  }

  return tips;
}

export function DashboardTips({ performance }: { performance: DashboardPerformance }) {
  const tips = buildTips(performance);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const activeTip = tips[activeIndex] ?? tips[0];

  useEffect(() => {
    if (isPaused || tips.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % tips.length);
    }, 9000);

    return () => window.clearInterval(timer);
  }, [isPaused, tips.length]);

  function moveTip(direction: number) {
    setActiveIndex((index) => (index + direction + tips.length) % tips.length);
  }

  return (
    <aside aria-label="Business performance tips" className="rounded-xl border border-gray-200 border-t-2 border-t-green-700 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
            <Lightbulb size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Business pulse</h2>
            <p className="text-xs text-gray-500">Tips based on today&apos;s activity</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => moveTip(-1)}
            aria-label="Previous business tip"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            aria-label={isPaused ? "Resume rotating tips" : "Pause rotating tips"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            {isPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => moveTip(1)}
            aria-label="Next business tip"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div key={activeIndex} aria-live="polite" className="dashboard-tip-enter mt-5 min-h-36">
        <p className={`text-xs font-semibold uppercase tracking-wide ${activeTip.priority ? "text-amber-700" : "text-green-700"}`}>
          {activeTip.category}
        </p>
        <h3 className="mt-2 text-base font-semibold text-gray-900">{activeTip.title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-gray-600">{activeTip.detail}</p>
        <Link href={activeTip.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-800">
          {activeTip.action}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-1.5" aria-label={`Tip ${activeIndex + 1} of ${tips.length}`}>
        {tips.map((tip, index) => (
          <span
            key={`${tip.category}-${tip.title}`}
            className={`h-1 rounded-full transition-all duration-300 ${index === activeIndex ? "w-6 bg-green-700" : "w-2 bg-gray-200"}`}
          />
        ))}
      </div>
    </aside>
  );
}