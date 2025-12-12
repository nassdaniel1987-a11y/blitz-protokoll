// Supabase Edge Function: User löschen
// Nur für Admin-User zugänglich

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
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
      throw new Error('Nur Admins können User löschen')
    }

    // Request Body parsen
    const { userId } = await req.json()

    if (!userId) {
      throw new Error('User-ID ist erforderlich')
    }

    // Prüfen, dass der Admin sich nicht selbst löscht
    if (userId === user.id) {
      throw new Error('Du kannst dich nicht selbst löschen')
    }

    // Admin Supabase Client (mit Service Role Key)
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // User löschen
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User erfolgreich gelöscht'
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
