import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, logoutUrl } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const sealed = cookies.get(SESSION_COOKIE);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, (await logoutUrl(sealed)) ?? '/auth/login', { external: ['https://api.workos.com'] });
};
