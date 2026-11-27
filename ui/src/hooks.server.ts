import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE, cookieOpts, isAllowed, readSession } from '#lib/server/auth.ts';

// Every route except /auth/* requires a WorkOS session for an allowlisted email.
export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/auth/')) return resolve(event);

	const { user, resealed } = await readSession(event.cookies.get(SESSION_COOKIE)).catch(() => ({ user: null, resealed: null }));
	if (!user) redirect(303, '/auth/login');
	if (!isAllowed(user)) {
		event.cookies.delete(SESSION_COOKIE, { path: '/' });
		return new Response('Forbidden: this account is not on the allowlist.', { status: 403 });
	}
	if (resealed) event.cookies.set(SESSION_COOKIE, resealed, cookieOpts);
	event.locals.user = { email: user.email };

	const res = await resolve(event);
	res.headers.set('cache-control', 'private, no-store');
	res.headers.set('x-robots-tag', 'noindex, nofollow');
	return res;
};
