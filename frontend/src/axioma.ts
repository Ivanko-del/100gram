/**
 * Thin typed wrapper around the vendored `AxiomaSDK` global (public/axioma-sdk.js,
 * loaded via <script defer> in index.html). AxiomaSDK talks to a completely
 * separate Firebase project ("axioma-bank") with its own accounts - a player
 * logs in with their Аксіома nick/password, not their 100 ГРАМ account, and
 * only after they already have a card there (opened inside the Аксіома app
 * itself; this SDK cannot create one).
 *
 * All amounts are Аксіома's virtual ₴ - see README for the exchange rate
 * used when converting a withdrawal into ГРАМ.
 */

export interface AxiomaCard {
  number: string;
  last4: string;
  expiry: string;
  holder: string;
  balance: number;
  frozen: boolean;
  skin: string;
  customPhotoUrl: string;
  limitLeft: number;
}

export interface AxiomaAccount {
  nick: string;
  name: string;
  card: AxiomaCard;
  partners: Record<string, { user: string; linkedAt: number }>;
}

interface AxiomaSdkGlobal {
  init(opts?: { emulatorHost?: string }): unknown;
  login(nick: string, password: string): Promise<void>;
  logout(): Promise<void>;
  onChange(cb: (account: AxiomaAccount | null) => void): () => void;
  link(projectId: string, projectUser: string): Promise<void>;
  unlink(projectId: string): Promise<void>;
  withdrawFromCard(amount: number, opts: { project?: string; title?: string; subtitle?: string }): Promise<true>;
  depositToCard(amount: number, opts: { project?: string; title?: string; subtitle?: string }): Promise<true>;
  readonly account: AxiomaAccount | null;
  readonly nick: string | null;
}

declare global {
  interface Window {
    AxiomaSDK?: AxiomaSdkGlobal;
  }
}

/** Our id in Аксіома's `partners` map - keep in sync if it's ever renamed. */
export const AXIOMA_PROJECT_ID = "100gram";

/** Live Аксіома Банк site - a player without a card yet opens one there
 * (this SDK can only log in to an existing account, never create one). */
export const AXIOMA_SITE_URL = "https://aksioma-bay.vercel.app/";

/** ГРАМ awarded per 1 virtual ₴ withdrawn from Аксіома. 1:1 keeps the numbers simple; change here only. */
export const AXIOMA_EXCHANGE_RATE = 1;

export class AxiomaError extends Error {}

function sdk(): AxiomaSdkGlobal {
  if (!window.AxiomaSDK) throw new AxiomaError("Аксіома тимчасово недоступна (не завантажився SDK)");
  return window.AxiomaSDK;
}

export function axiomaAvailable(): boolean {
  return typeof window !== "undefined" && !!window.AxiomaSDK;
}

export function initAxioma(): void {
  if (window.AxiomaSDK) window.AxiomaSDK.init();
}

export async function axiomaLogin(nick: string, password: string): Promise<void> {
  try {
    await sdk().login(nick, password);
  } catch (err) {
    throw err instanceof AxiomaError ? err : new AxiomaError(err instanceof Error ? err.message : "Не вдалося увійти в Аксіому");
  }
}

export function axiomaLogout(): Promise<void> {
  return window.AxiomaSDK?.logout() ?? Promise.resolve();
}

export function subscribeAxioma(cb: (account: AxiomaAccount | null) => void): () => void {
  if (!window.AxiomaSDK) {
    cb(null);
    return () => {};
  }
  return window.AxiomaSDK.onChange(cb);
}

export async function linkAxioma(myUsername: string): Promise<void> {
  await sdk().link(AXIOMA_PROJECT_ID, myUsername);
}

export async function unlinkAxioma(): Promise<void> {
  await sdk().unlink(AXIOMA_PROJECT_ID);
}

/** Debits the Аксіома card. Throws AxiomaError with a player-facing message
 * (insufficient funds, card frozen, over the daily limit, ...) on failure. */
export async function withdrawFromAxioma(amount: number, title: string): Promise<void> {
  try {
    await sdk().withdrawFromCard(amount, { project: AXIOMA_PROJECT_ID, title });
  } catch (err) {
    throw err instanceof AxiomaError ? err : new AxiomaError(err instanceof Error ? err.message : "Не вдалося списати з картки Аксіоми");
  }
}

/** Credits the Аксіома card back (e.g. a refund). */
export async function depositToAxioma(amount: number, title: string): Promise<void> {
  try {
    await sdk().depositToCard(amount, { project: AXIOMA_PROJECT_ID, title });
  } catch (err) {
    throw err instanceof AxiomaError ? err : new AxiomaError(err instanceof Error ? err.message : "Не вдалося зарахувати на картку Аксіоми");
  }
}
