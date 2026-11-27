import index from '#lib/server/results.json';
import type { Index } from '#lib/bench.ts';
import type { PageServerLoad } from './$types';

// Rendered per request behind the auth hook; never prerendered to a public static file.
export const prerender = false;

export const load: PageServerLoad = () => ({ index: index as unknown as Index });
