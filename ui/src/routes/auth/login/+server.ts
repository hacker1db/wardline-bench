import { redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { STATE_COOKIE, authorizationUrl } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies }) => {
	const state = randomBytes(24).toString('base64url');
	cookies.set(STATE_COOKIE, state, { path: '/auth', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
	redirect(303, authorizationUrl(url.origin, state), { external: ['https://api.workos.com'] });
};
