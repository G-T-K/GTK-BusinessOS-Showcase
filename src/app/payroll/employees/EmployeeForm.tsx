type Employee = {
  id: string;
  fullName: string;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  departmentId: string | null;
  jobTitle: string;
  employmentDate: Date;
  employmentType: string;
  basicSalary: unknown;
  salaryCurrency: string;
  userId: string | null;
  status: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  mobileMoneyProvider: string | null;
  mobileMoneyNumber: string | null;
  taxNumber: string | null;
  nssaNumber: string | null;
};

export function EmployeeForm({
  action,
  employee,
  departments,
  users,
}: {
  action: (formData: FormData) => void | Promise<void>;
  employee?: Employee;
  departments: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
}) {
  return (
    <form action={action} className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      {employee && <input type="hidden" name="employeeId" value={employee.id} />}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="fullName" required value={employee?.fullName} />
        <Field label="National ID" name="nationalId" value={employee?.nationalId ?? ""} />
        <Field label="Phone number" name="phone" value={employee?.phone ?? ""} />
        <Field label="Email address" name="email" type="email" value={employee?.email ?? ""} />
        <Field label="Job title" name="jobTitle" required value={employee?.jobTitle} />
        <Select label="Department" name="departmentId" value={employee?.departmentId ?? ""} options={departments.map((item): [string, string] => [item.id, item.name])} empty="Unassigned" />
        <label className="text-sm font-medium text-gray-700">Employment date<input name="employmentDate" type="date" required defaultValue={employee?.employmentDate.toISOString().slice(0, 10)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label>
        <Select label="Employment type" name="employmentType" required value={employee?.employmentType ?? "PERMANENT"} options={["PERMANENT", "CONTRACT", "TEMPORARY", "CASUAL", "INTERN"].map((item): [string, string] => [item, item.replace("_", " ")])} />
        <Field label="Basic salary" name="basicSalary" type="number" step="0.01" min="0" required value={employee ? Number(employee.basicSalary) : ""} />
        <label className="text-sm font-medium text-gray-700">Salary currency<input name="salaryCurrency" type="text" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" defaultValue={employee?.salaryCurrency ?? "USD"} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-normal uppercase" /><span className="mt-1 block text-xs font-normal text-gray-500">Use an ISO three-letter currency code, such as USD or ZIG.</span></label>
        <Select label="Linked user account" name="userId" value={employee?.userId ?? ""} empty="No login linked" options={users.map((item): [string, string] => [item.id, `${item.name} (${item.email})`])} />
        {employee && <Select label="Employment status" name="status" value={employee.status} options={["ACTIVE", "INACTIVE", "TERMINATED"].map((item): [string, string] => [item, item])} />}
      </section>
      <label className="block text-sm font-medium text-gray-700">Residential address<textarea name="address" rows={2} maxLength={500} defaultValue={employee?.address ?? ""} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label>
      <section className="grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm font-semibold text-gray-800">Payment details</p>
        <Field label="Bank name" name="bankName" value={employee?.bankName ?? ""} />
        <Field label="Bank account name" name="bankAccountName" value={employee?.bankAccountName ?? ""} />
        <Field label="Bank account number" name="bankAccountNumber" value={employee?.bankAccountNumber ?? ""} />
        <Field label="Mobile money provider" name="mobileMoneyProvider" value={employee?.mobileMoneyProvider ?? ""} />
        <Field label="Mobile money number" name="mobileMoneyNumber" value={employee?.mobileMoneyNumber ?? ""} />
      </section>
      <section className="grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm font-semibold text-gray-800">Tax and social security</p>
        <Field label="Tax identification number" name="taxNumber" value={employee?.taxNumber ?? ""} />
        <Field label="NSSA number" name="nssaNumber" value={employee?.nssaNumber ?? ""} />
      </section>
      <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 sm:w-auto">{employee ? "Save employee changes" : "Create employee"}</button>
    </form>
  );
}

function Field({ label, name, type = "text", required = false, value, step, min }: {
  label: string; name: string; type?: string; required?: boolean; value?: string | number; step?: string; min?: string;
}) {
  return <label className="text-sm font-medium text-gray-700">{label}<input name={name} type={type} required={required} maxLength={type === "number" ? undefined : 500} step={step} min={min} defaultValue={value} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label>;
}

function Select({ label, name, options, value, empty, required = false }: {
  label: string; name: string; options: [string, string][]; value?: string; empty?: string; required?: boolean;
}) {
  return <label className="text-sm font-medium text-gray-700">{label}<select name={name} required={required} defaultValue={value} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-normal">{empty && <option value="">{empty}</option>}{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
