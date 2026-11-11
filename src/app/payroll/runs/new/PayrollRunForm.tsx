"use client";

import { useState } from "react";
import { createPayrollDraft } from "../../actions";

type PayrollEmployee = {
  id: string;
  fullName: string;
  employeeNumber: string;
  departmentName: string | null;
  jobTitle: string;
  salaryCurrency: string;
  basicSalary: number;
  salaryComponents: {
    id: string;
    componentId: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    component: { name: string; kind: "EARNING" | "OTHER_DEDUCTION"; mode: "FIXED" | "VARIABLE"; active: boolean };
  }[];
};

export function PayrollRunForm({ employees }: { employees: PayrollEmployee[] }) {
  const currencies = Array.from(new Set(employees.map((employee) => employee.salaryCurrency)));
  const [currency, setCurrency] = useState(currencies[0] ?? "");
  const [month, setMonth] = useState(new Date().getUTCMonth() + 1);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const periodEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;

  return (
    <form action={createPayrollDraft} className="space-y-6">
      <section className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-4">
        <label className="text-sm text-gray-700">Month<select name="month" value={month} onChange={(event) => setMonth(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(Date.UTC(2020, index, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" })}</option>)}</select></label>
        <label className="text-sm text-gray-700">Year<input name="year" type="number" min="2000" max="2200" required value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
        <label className="text-sm text-gray-700">Salary currency<select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">{currencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm text-gray-700">Planned pay date<input name="payDate" type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">{currency} employees</h2>
        {employees.filter((employee) => employee.salaryCurrency === currency).map((employee) => {
          const components = employee.salaryComponents.filter((entry) =>
            entry.component.active
            && entry.component.mode === "VARIABLE"
            && entry.effectiveFrom <= periodEnd
            && (!entry.effectiveTo || entry.effectiveTo >= periodEnd),
          );
          return (
            <article key={employee.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <label className="flex flex-1 items-start gap-3">
                  <input type="checkbox" name="employeeIds" value={employee.id} defaultChecked className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600" />
                  <span><span className="block font-medium text-gray-900">{employee.fullName}</span><span className="block text-xs text-gray-500">{employee.employeeNumber} · {employee.departmentName ?? "No department"} · {employee.jobTitle}</span></span>
                </label>
                <span className="text-sm font-medium text-gray-800">{currency} {employee.basicSalary.toFixed(2)} basic</span>
              </div>
              {components.length > 0 && (
                <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  {components.map((entry) => (
                    <label key={entry.id} className="text-xs font-medium text-gray-600">{entry.component.name} ({entry.component.kind === "EARNING" ? "earning" : "deduction"})<input name={`variable_${employee.id}_${entry.componentId}`} type="number" step="0.01" min="0" defaultValue="0" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
      <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Payroll calculations use only the effective statutory tables configured for the selected period and currency. No Zimbabwean rates or thresholds are supplied by default.</p>
      <button className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Generate draft payroll</button>
    </form>
  );
}
