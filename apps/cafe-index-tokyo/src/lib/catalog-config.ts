import fs from 'node:fs';
import path from 'node:path';
import { catalogError } from './catalog';

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export type CatalogKind = 'file' | 'supabase';

/** Which key the Supabase provider will send. Anon is preferred so RLS applies. */
export function supabaseKeyChoice(): { name: string; value: string } | null {
  const anon = env('SUPABASE_ANON_KEY');
  if (anon) return { name: 'SUPABASE_ANON_KEY', value: anon };
  const role = env('SUPABASE_SERVICE_ROLE_KEY');
  if (role) return { name: 'SUPABASE_SERVICE_ROLE_KEY', value: role };
  const secret = env('SUPABASE_SECRET_KEY');
  if (secret) return { name: 'SUPABASE_SECRET_KEY', value: secret };
  return null;
}

export function catalogSourceKind(): CatalogKind {
  if (env('NEXT_PUBLIC_SUPABASE_ANON_KEY') || env('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY') || env('NEXT_PUBLIC_SUPABASE_SECRET_KEY')) {
    throw catalogError(
      'Do not put Supabase keys in NEXT_PUBLIC_* variables. Those are embedded in the client bundle. Use SUPABASE_ANON_KEY or a server-only key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY).',
    );
  }
  const dir = env('CATALOG_DATA_DIR');
  const url = env('SUPABASE_URL');
  const key = supabaseKeyChoice();
  if (dir && (url || key)) {
    throw catalogError(
      'Set only one catalog source. Both CATALOG_DATA_DIR and Supabase credentials are set, so the build is stopping.',
    );
  }
  if (url && !key) {
    throw catalogError(
      'SUPABASE_URL is set but no key is set. Add SUPABASE_ANON_KEY (preferred; RLS applies) or a server-only key SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY. Never commit the key.',
    );
  }
  if (key && !url) {
    throw catalogError(
      `${key.name} is set but SUPABASE_URL is not. Set both, or unset the key and use CATALOG_DATA_DIR for a local JSON export.`,
    );
  }
  if (dir) return 'file';
  if (url && key) return 'supabase';
  throw catalogError(
    [
      'No catalog data source is configured, so the build is stopping instead of emitting an empty site.',
      '',
      'Local JSON (development, or CI with the labelled demo fixture):',
      '  CATALOG_DATA_DIR=/absolute/path/outside/this/repo npm run build',
      '  CATALOG_DATA_DIR=fixtures/demo npm run build',
      '',
      'Supabase (read-only at build time; do not commit keys):',
      '  SUPABASE_URL=https://<project>.supabase.co SUPABASE_ANON_KEY=<anon-key> npm run build',
      '',
      'See .env.example. Catalog JSON and the source database are not stored in this repo.',
    ].join('\n'),
  );
}

/** Fail fast, before Next compiles, when the chosen source is unusable. */
export function assertCatalogConfigured(): void {
  if (catalogSourceKind() !== 'file') return;
  const root = path.resolve(process.env.CATALOG_DATA_DIR!.trim());
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw catalogError(
      `CATALOG_DATA_DIR is not a directory: ${root}. Point it at JSON written by tools/export_site_data.py outside this repo, or at fixtures/demo for the labelled demo set.`,
    );
  }
  for (const file of ['shops-index.json', 'events.json', 'meta.json']) {
    if (!fs.existsSync(path.join(root, file))) {
      throw catalogError(
        `CATALOG_DATA_DIR (${root}) is missing ${file}. Point it at a full export, or at fixtures/demo for tests and CI. Refusing to build an empty site.`,
      );
    }
  }
}
