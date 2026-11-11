"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { updateBusinessProfile, type BusinessProfileActionState } from "./actions";
import { normalizeWebsiteUrl } from "@/lib/website-url";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const INITIAL_STATE: BusinessProfileActionState = {
  success: false,
  error: null,
  message: null,
};

function isBusinessProfileActionState(value: unknown): value is BusinessProfileActionState {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof value.success === "boolean" &&
    "error" in value &&
    (typeof value.error === "string" || value.error === null) &&
    "message" in value &&
    (typeof value.message === "string" || value.message === null)
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
    >
      {pending && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {pending ? "Processing and saving..." : "Save business profile"}
    </button>
  );
}

function ProcessingMessage({ pending }: { pending: boolean }) {
  if (!pending) return null;

  return (
    <p role="status" className="text-sm text-gray-600">
      Your logo is being resized and optimized. Please wait.
    </p>
  );
}

export function BusinessProfileForm({
  business,
  logoSrc,
}: {
  business: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  logoSrc: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<BusinessProfileActionState>(INITIAL_STATE);
  const [pending, setPending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const removeLogoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewSrc(null);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setPreviewSrc(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const websiteInput = form.elements.namedItem("website");
    if (websiteInput instanceof HTMLInputElement) {
      const result = normalizeWebsiteUrl(websiteInput.value);
      if (result.error) {
        setWebsiteError(result.error);
        websiteInput.focus();
        return;
      }

      websiteInput.value = result.value ?? "";
      setWebsiteError(null);
    }

    setState(INITIAL_STATE);
    setPending(true);
    void updateBusinessProfile(new FormData(form))
      .then((response: unknown) => {
        if (!isBusinessProfileActionState(response)) {
          console.error("Business profile action returned an invalid state", response);
          setState({
            success: false,
            error: "We couldn't save your business profile. Please try again.",
            message: null,
          });
          return;
        }

        const result = response;
        setState(result);
        if (result.success) {
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          if (removeLogoRef.current) removeLogoRef.current.checked = false;
          router.refresh();
        }
      })
      .catch((error: unknown) => {
        console.error("Business profile submission failed", error);
        setState({
          success: false,
          error: "We couldn't save your business profile. Please try again.",
          message: null,
        });
      })
      .finally(() => setPending(false));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setFileError(null);
    setState(INITIAL_STATE);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError("Choose a logo of 10 MB or less so it can be processed safely.");
      event.currentTarget.value = "";
      setSelectedFile(null);
      return;
    }

    const extension = file.name.toLowerCase().split(".").pop();
    const expectedMimeType = extension === "png" ? "image/png" : "image/jpeg";
    if (!["png", "jpg", "jpeg"].includes(extension ?? "") || (file.type && file.type !== expectedMimeType)) {
      setFileError("Choose a PNG, JPG, or JPEG image.");
      event.currentTarget.value = "";
      setSelectedFile(null);
      return;
    }

    if (removeLogoRef.current) removeLogoRef.current.checked = false;
    setSelectedFile(file);
  }

  const displayedLogo = previewSrc ?? logoSrc;

  return (
    <form
      onSubmit={validateBeforeSubmit}
      noValidate
      className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
    >
      <div>
        <label htmlFor="business-name" className="block text-sm font-medium text-gray-700">Business name</label>
        <input
          id="business-name"
          name="name"
          required
          maxLength={120}
          defaultValue={business.name}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div>
        <label htmlFor="business-address" className="block text-sm font-medium text-gray-700">Business address</label>
        <textarea
          id="business-address"
          name="address"
          rows={3}
          maxLength={500}
          defaultValue={business.address ?? ""}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="business-phone" className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            id="business-phone"
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={business.phone ?? ""}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label htmlFor="business-email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="business-email"
            name="email"
            type="email"
            maxLength={254}
            defaultValue={business.email ?? ""}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      <div>
        <label htmlFor="business-website" className="block text-sm font-medium text-gray-700">Website</label>
        <input
          id="business-website"
          name="website"
          type="url"
          maxLength={200}
          defaultValue={business.website ?? ""}
          placeholder="https://example.com"
          aria-invalid={Boolean(websiteError)}
          aria-describedby={websiteError ? "business-website-error" : undefined}
          onChange={() => {
            setWebsiteError(null);
            setState(INITIAL_STATE);
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        {websiteError && (
          <p id="business-website-error" role="alert" className="mt-1 text-sm text-red-600">
            {websiteError}
          </p>
        )}
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-5">
        <div>
          <label htmlFor="business-logo" className="block text-sm font-medium text-gray-700">Business logo</label>
          <p className="mt-1 text-xs text-gray-500">
            Your logo will automatically be resized and optimized for the best quality.
          </p>
          <p className="mt-1 text-xs text-gray-500">PNG, JPG, or JPEG; maximum upload size 10 MB.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {displayedLogo ? (
            <div className="space-y-1">
              <Image
                src={displayedLogo}
                alt={`${business.name} logo preview`}
                width={160}
                height={64}
                unoptimized
                className="h-16 max-w-40 rounded border border-gray-200 bg-white object-contain p-1"
              />
              {previewSrc && <p className="text-xs text-gray-500">Preview before saving</p>}
            </div>
          ) : (
            <div className="flex h-16 w-40 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400">
              No logo uploaded
            </div>
          )}
          <input
            ref={fileInputRef}
            id="business-logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            aria-describedby="business-logo-help"
            className="max-w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>
        <p id="business-logo-help" className="sr-only">
          Upload a PNG, JPG, or JPEG image. Images are validated and optimized on save.
        </p>
        {fileError && <p role="alert" className="text-sm text-red-600">{fileError}</p>}
        {logoSrc && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              ref={removeLogoRef}
              type="checkbox"
              name="removeLogo"
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Remove current logo
          </label>
        )}
      </div>

      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-green-700">{state.message}</p>}
      <div className="space-y-2">
        <SaveButton pending={pending} />
        <ProcessingMessage pending={pending} />
      </div>
    </form>
  );
}
