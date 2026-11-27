import { WorkOS } from '@workos-inc/node';

export const SESSION_COOKIE = 'wl_session';
export const STATE_COOKIE = 'wl_oauth_state';

// Read at request time from the server environment (Vercel env vars). Never bundled to the client.
function config() {
	const e = process.env;
	const sealKey = e.WORKOS_COOKIE_PASSWORD ?? '';
	if (!e.WORKOS_API_KEY || !e.WORKOS_CLIENT_ID || sealKey.length < 32) {
		throw new Error('WorkOS auth is not configured: need WORKOS_API_KEY, WORKOS_CLIENT_ID and a 32+ char WORKOS_COOKIE_PASSWORD');
	}
	// Fail closed: with no allowlist nobody gets in, even with a valid AuthKit account.
	const allowed = new Set((e.ALLOWED_EMAILS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
	return { apiKey: e.WORKOS_API_KEY, clientId: e.WORKOS_CLIENT_ID, sealKey, allowed };
}

let client: WorkOS | null = null;
const workos = () => (client ??= new WorkOS(config().apiKey, { clientId: config().clientId }));

export const cookieOpts = { path: '/', httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7 };

// Requires a verified email so an unverified sign-up cannot claim an allowlisted address.
export const isAllowed = (user: { email?: string; emailVerified?: boolean } | null | undefined) =>
	!!user?.email && user.emailVerified === true && config().allowed.has(user.email.toLowerCase());

export function authorizationUrl(origin: string, state: string) {
	return workos().userManagement.getAuthorizationUrl({
		provider: 'authkit',
		clientId: config().clientId,
		redirectUri: `${origin}/auth/callback`,
		state
	});
}

export function exchangeCode(code: string) {
	return workos().userManagement.authenticateWithCode({
		clientId: config().clientId,
		code,
		session: { sealSession: true, cookiePassword: config().sealKey }
	});
}

const load = (sealed: string) =>
	workos().userManagement.loadSealedSession({ sessionData: sealed, cookiePassword: config().sealKey });

/** Returns the user and, when the access token was refreshed, a new sealed session to store. */
export async function readSession(sealed: string | undefined) {
	if (!sealed) return { user: null, resealed: null };
	const session = load(sealed);
	const auth = await session.authenticate();
	if (auth.authenticated) return { user: auth.user, resealed: null };
	const refreshed = await session.refresh().catch(() => null);
	if (refreshed?.authenticated && refreshed.sealedSession) return { user: refreshed.user, resealed: refreshed.sealedSession };
	return { user: null, resealed: null };
}

export async function logoutUrl(sealed: string | undefined) {
	if (!sealed) return null;
	try {
		return await load(sealed).getLogoutUrl();
	} catch {
		return null;
	}
}
