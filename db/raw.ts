import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
