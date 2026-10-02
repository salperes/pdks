/**
 * Portal SSO yardimcilari (saf fonksiyonlar).
 *
 * Portal, PDKS'i `https://pdks.mss.local/?sso_token=<jwt>` ile acar.
 * URL'de sso_token varsa, tarayicida kayitli (persist) bir oturum olsa bile
 * once SSO girisi yapilmalidir: aksi halde eski/sureli dolmus oturum ya da
 * BASKA bir kullanicinin oturumu portalin kimligine galip gelir.
 */

/** URL query string'inden sso_token degerini dondurur (yoksa null). */
export function getSsoToken(search: string): string | null {
  const token = new URLSearchParams(search).get('sso_token');
  return token && token.trim() ? token : null;
}

/**
 * Korumali bir sayfaya gelindiginde login sayfasina yonlendirilmeli mi?
 * - sso_token varsa: oturum durumundan BAGIMSIZ olarak evet (SSO once islenir)
 * - yoksa: yalnizca oturum yoksa
 */
export function shouldRedirectToLogin(isAuthenticated: boolean, search: string): boolean {
  if (getSsoToken(search)) return true;
  return !isAuthenticated;
}

/**
 * Login sayfasi, oturum acik kullaniciyi uygulamaya geri gondermeli mi?
 * sso_token varken veya SSO islemi surerken asla (once SSO tamamlanmali).
 */
export function shouldLeaveLoginPage(
  isAuthenticated: boolean,
  search: string,
  ssoInProgress: boolean,
): boolean {
  if (ssoInProgress) return false;
  if (getSsoToken(search)) return false;
  return isAuthenticated;
}

/** SSO sonrasi donulecek hedef yol: yalnizca uygulama ici, /login olmayan yollar. */
export function resolvePostLoginTarget(from: unknown): string {
  if (typeof from !== 'string') return '/';
  if (!from.startsWith('/') || from.startsWith('//')) return '/';
  if (from === '/login' || from.startsWith('/login?') || from.startsWith('/login/')) return '/';
  return from;
}
