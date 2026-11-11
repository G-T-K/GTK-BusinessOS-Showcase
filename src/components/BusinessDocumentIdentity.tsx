type BusinessIdentity = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo: Uint8Array | null;
  logoMimeType: string | null;
};

export function BusinessDocumentIdentity({ business }: { business: BusinessIdentity }) {
  const logoSrc = business.logo && business.logoMimeType
    ? `data:${business.logoMimeType};base64,${Buffer.from(business.logo).toString("base64")}`
    : null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      {logoSrc ? (
        <img src={logoSrc} alt={`${business.name} logo`} className="h-14 w-20 shrink-0 rounded border border-gray-200 bg-white object-contain p-1" />
      ) : (
        <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-50 text-sm font-semibold text-green-800">
          {business.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-gray-900">{business.name}</h2>
        {business.address && <p className="whitespace-pre-line text-xs text-gray-500">{business.address}</p>}
        <p className="flex flex-wrap gap-x-2 text-xs text-gray-500">
          {business.phone && <span>{business.phone}</span>}
          {business.email && <span>{business.email}</span>}
          {business.website && <span>{business.website}</span>}
        </p>
      </div>
    </div>
  );
}