// Supabase Edge Function: User erstellen
// Nur für Admin-User zugänglich

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authentifizierung prüfen
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Keine Authentifizierung')
    }

    // Supabase Client mit User-Token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Aktuellen User holen
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('User nicht gefunden')
    }

    // Prüfen ob User Admin ist
    const isAdmin = user.user_metadata?.is_admin === true
    if (!isAdmin) {
      throw new Error('Nur Admins können User erstellen')
    }

    // Request Body parsen
    const { username, password } = await req.json()

    if (!username || !password) {
      throw new Error('Username und Password sind erforderlich')
    }

    // Email generieren
    const email = `${username}@blitz-protokoll.local`

    // Admin Supabase Client (mit Service Role Key)
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // User erstellen
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        must_change_password: true // User muss Passwort ändern
      }
    })

    if (createError) {
      throw createError
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user?.id,
          email: newUser.user?.email,
          created_at: newUser.user?.created_at
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
