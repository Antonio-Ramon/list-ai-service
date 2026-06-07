export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  port: Number(process.env.PORT ?? 3000),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

if (!config.anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY is required');
}

if (!config.supabaseUrl) {
  throw new Error('SUPABASE_URL is required');
}

if (!config.supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}
