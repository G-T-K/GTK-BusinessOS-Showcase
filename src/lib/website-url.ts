const WEBSITE_URL_ERROR = "Enter a valid website URL beginning with http:// or https://.";

export function normalizeWebsiteUrl(value: string): { value: string | null; error?: string } {
  const trimmedValue = value.trim();
  if (!trimmedValue) return { value: null };

  const authorityMatch = /^https?:\/\/([^/?#]+)/i.exec(trimmedValue);
  if (!authorityMatch || /\s|\\/.test(trimmedValue) || authorityMatch[1].includes("@")) {
    return { value: null, error: WEBSITE_URL_ERROR };
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    if (
      (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return { value: null, error: WEBSITE_URL_ERROR };
    }
  } catch {
    return { value: null, error: WEBSITE_URL_ERROR };
  }

  return { value: trimmedValue };
}
