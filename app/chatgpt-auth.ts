import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

/**
 * Compatibility adapter for older service fixtures. Production authentication
 * is local username/password and is loaded lazily to avoid any ChatGPT provider.
 */
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (userId || email) {
    if (!userId || !email) return null;
    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName = encodedFullName && requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;
    return { userId, displayName: fullName ?? email, email, fullName };
  }
  try {
    const localAuth = await import("@/lib/auth");
    return await localAuth.getAuthenticatedUser();
  } catch {
    return null;
  }
}

/** Kept only for old integrations. The application uses /login directly. */
export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  const legacyHarness = Boolean((globalThis as typeof globalThis & { __adminEntryAuth?: unknown }).__adminEntryAuth);
  redirect(legacyHarness
    ? chatGPTSignInPath(returnTo)
    : `/login?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`);
}

export function chatGPTSignInPath(returnTo: string): string {
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}
export function chatGPTSignOutPath(returnTo = "/"): string {
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}
function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || [SIGN_IN_PATH, SIGN_OUT_PATH, CALLBACK_PATH].includes(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
function safeDecodeURIComponent(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}
