// Supabase Edge Function: User Passwort zurücksetzen
// Nur für Admin-User zugänglich

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
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
      throw new Error('Nur Admins können Passwörter zurücksetzen')
    }

    // Request Body parsen
    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword) {
      throw new Error('User-ID und neues Passwort sind erforderlich')
    }

    // Prüfen, dass der Admin sich nicht selbst über diese Funktion das Passwort ändert (optional, aber sicherer)
    // Man kann sich zwar selbst ändern, aber meist gibt es dafür eine eigene Route 'change-password'.
    // Hier erlauben wir es prinzipiell, oder auch nicht.
    // Falls der Admin sein eigenes PW vergessen hat, kann er sich nicht einloggen um es zu ändern.
    // Wenn er eingeloggt ist, kann er es ändern.
    // Lassen wir es zu.

    // Admin Supabase Client (mit Service Role Key)
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // User Metadata holen, um existierende Werte nicht zu überschreiben?
    // updateUserById merged user_metadata normalerweise.
    // Wir setzen must_change_password auf true.

    // User aktualisieren
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: newPassword,
        user_metadata: {
            must_change_password: true
        }
      }
    )

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Passwort erfolgreich aktualisiert'
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
