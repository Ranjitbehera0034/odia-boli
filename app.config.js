const fs = require('fs');
const path = require('path');

// Manually load .env variables into process.env if they are not already set.
// This ensures that local development runs correctly when running `npx expo start`.
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.substring(0, index).trim();
    const value = trimmed.substring(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      sentryDsn: process.env.SENTRY_DSN || '',
      posthogApiKey: process.env.POSTHOG_API_KEY || '',
    },
  };
};
