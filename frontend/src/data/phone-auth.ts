import { ConfirmationResult, RecaptchaVerifier, linkWithPhoneNumber, signInWithPhoneNumber, unlink } from "firebase/auth";
import { auth } from "../firebase";
import { DataError } from "./firestore-api";

/** SMS verification through Firebase Phone Auth (invisible reCAPTCHA).
 * Docs: https://firebase.google.com/docs/auth/web/phone-auth */

let verifier: RecaptchaVerifier | null = null;

function freshVerifier(container: HTMLElement): RecaptchaVerifier {
  // A reCAPTCHA widget can only be rendered once per container, and a used
  // one can't be reused - so always start from a clean one.
  try {
    verifier?.clear();
  } catch {
    /* already gone */
  }
  container.innerHTML = "";
  verifier = new RecaptchaVerifier(auth, container, { size: "invisible" });
  return verifier;
}

const e164 = (digits: string) => "+" + digits;

/** Send a code to sign in with this number (no email/password needed). */
export function sendSignInCode(phoneDigits: string, container: HTMLElement): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, e164(phoneDigits), freshVerifier(container));
}

/** Send a code to attach this number to the currently signed-in account. */
export function sendLinkCode(phoneDigits: string, container: HTMLElement): Promise<ConfirmationResult> {
  const user = auth.currentUser;
  if (!user) throw new DataError("Спочатку увійди в акаунт");
  return linkWithPhoneNumber(user, e164(phoneDigits), freshVerifier(container));
}

/** Detach the verified phone from the account (before linking another). */
export async function unlinkPhone(): Promise<void> {
  const user = auth.currentUser;
  if (user?.providerData.some((p) => p.providerId === "phone")) await unlink(user, "phone");
}

export function isPhoneVerified(phoneDigits: string | null | undefined): boolean {
  const verified = auth.currentUser?.phoneNumber;
  return !!phoneDigits && verified === e164(phoneDigits);
}

export function phoneAuthError(e: unknown, fallback = "Не вдалося виконати дію з номером"): string {
  if (e instanceof DataError) return e.message;
  switch ((e as { code?: string })?.code) {
    case "auth/invalid-phone-number":
      return "Некоректний номер телефону";
    case "auth/missing-phone-number":
      return "Вкажи номер телефону";
    case "auth/too-many-requests":
      return "Забагато спроб. Спробуй трохи пізніше";
    case "auth/quota-exceeded":
      return "Ліміт SMS на сьогодні вичерпано";
    case "auth/invalid-verification-code":
    case "auth/missing-verification-code":
      return "Невірний код із SMS";
    case "auth/code-expired":
      return "Код застарів — запроси новий";
    case "auth/captcha-check-failed":
    case "auth/argument-error":
      return "Не пройдено перевірку reCAPTCHA — онови сторінку й спробуй ще раз";
    case "auth/credential-already-in-use":
    case "auth/account-exists-with-different-credential":
      return "Цей номер уже прив'язано до іншого акаунта";
    case "auth/provider-already-linked":
      return "До акаунта вже прив'язано номер";
    case "auth/operation-not-allowed":
      return "Вхід за номером не увімкнено в Firebase (Authentication → Sign-in method → Phone)";
    case "auth/billing-not-enabled":
      return "Для SMS потрібен план Blaze у Firebase";
    case "auth/unauthorized-domain":
      return "Цей домен не додано в Firebase → Authentication → Settings → Authorized domains";
    case "auth/network-request-failed":
      return "Немає з'єднання з мережею";
    case "auth/invalid-app-credential":
    case "auth/app-not-authorized":
    case "auth/missing-app-credential":
      return "Firebase відхилив запит на SMS (auth/invalid-app-credential). Перевір: план Blaze, регіон SMS у Authentication → Settings → SMS region policy, reCAPTCHA / App Check";
    case "auth/internal-error":
      return "Внутрішня помилка Firebase (auth/internal-error) — спробуй ще раз через хвилину";
    default: {
      // Show what Firebase actually said - a bare fallback hides the cause.
      const code = (e as { code?: string })?.code;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Phone auth error:", e);
      return `${fallback} (${code ?? msg})`;
    }
  }
}
