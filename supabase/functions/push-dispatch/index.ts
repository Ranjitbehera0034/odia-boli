/**
 * push-dispatch/index.ts
 *
 * Edge Function: Push Notification Dispatcher
 * Trigger: HTTP POST (called internally by other edge functions)
 *
 * Body: { user_id: string, title: string, body: string, data?: object }
 *
 * Actions:
 * 1. Look up user's Expo push token from push_tokens table
 * 2. Send notification via Expo Push API
 * 3. Return delivery status
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';
import { handleCors, jsonOk, jsonError, corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors();

  try {
    if (req.method !== 'POST') {
      return jsonError('Method not allowed', 405);
    }

    const payload: PushPayload = await req.json();
    const { user_id, title, body, data } = payload;

    if (!user_id || !title || !body) {
      return jsonError('Missing required fields: user_id, title, body', 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Fetch push token for this user
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', user_id)
      .maybeSingle();

    if (tokenErr) throw tokenErr;
    if (!tokenRow?.expo_push_token) {
      return jsonOk({ success: true, message: 'No push token for user — skipped', delivered: false });
    }

    const expoToken = tokenRow.expo_push_token;

    // 2. Validate Expo push token format
    if (!expoToken.startsWith('ExponentPushToken[') && !expoToken.startsWith('ExpoPushToken[')) {
      return jsonError(`Invalid Expo push token format: ${expoToken}`, 400);
    }

    // 3. Send via Expo Push API
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoToken,
        title,
        body,
        data: data ?? {},
        sound: 'default',
        badge: 1,
        priority: 'high',
        channelId: 'default',
      }),
    });

    const expoResult = await expoRes.json();

    // 4. Check for Expo delivery errors
    if (expoResult.data?.status === 'error') {
      console.error('[push-dispatch] Expo error:', expoResult.data.message);
      return jsonOk({
        success: false,
        message: expoResult.data.message,
        delivered: false,
      });
    }

    return jsonOk({
      success: true,
      message: `Push notification sent to user ${user_id}`,
      delivered: true,
      expoTicketId: expoResult.data?.id,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[push-dispatch] Error:', msg);
    return jsonError(msg);
  }
});
