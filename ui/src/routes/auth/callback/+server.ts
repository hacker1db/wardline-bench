import { error, redirect } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { SESSION_COOKIE, STATE_COOKIE, cookieOpts, exchangeCode, isAllowed } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

const same = (a: string, b: string) => {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
};

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state') ?? '';
	const expected = cookies.get(STATE_COOKIE) ?? '';
	cookies.delete(STATE_COOKIE, { path: '/auth' });
	if (!code || !expected || !same(state, expected)) error(400, 'Invalid login state. Start again from the home page.');

	const auth = await exchangeCode(code).catch(() => null);
	if (!auth?.sealedSession) error(401, 'Login failed.');
	if (!isAllowed(auth.user)) error(403, 'This account is not on the allowlist.');

	cookies.set(SESSION_COOKIE, auth.sealedSession, cookieOpts);
	redirect(303, '/');
};
