export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  port: Number(process.env.PORT ?? 3000),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};

if (!config.anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY is required');
}
