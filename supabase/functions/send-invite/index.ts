// Sends the invitation email for an invitation that already exists.
//
// Why an Edge Function: it holds the email provider's API key, which must never
// reach the browser. The function lives next to the database it serves, so a
// future mobile app or a database webhook could reuse it unchanged.
//
// Why the caller's JWT and not the service role key: the function sees exactly
// what the caller is allowed to see. RLS only shows invitations to owners of
// the organization, so a member (or a stranger with a guessed id) gets a 404,
// and nothing here re-implements that rule.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'Missing Authorization header' }, 401)

  const body = await req.json().catch(() => null)
  const invitationId = body?.invitationId
  if (typeof invitationId !== 'string') return json({ error: 'invitationId is required' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })

  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('email, token, role, accepted_at, expires_at, organization:organizations(name)')
    .eq('id', invitationId)
    .maybeSingle()

  if (error) return json({ error: error.message }, 400)
  // "Doesn't exist" and "not yours" look the same, on purpose.
  if (!invitation) return json({ error: 'Invitation not found' }, 404)
  if (invitation.accepted_at || new Date(invitation.expires_at) <= new Date()) {
    return json({ error: 'Invitation is no longer pending' }, 409)
  }

  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000'
  const inviteUrl = `${siteUrl}/invite/${invitation.token}`
  const orgName = invitation.organization?.name ?? 'an organization'

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    // Local development without an email provider: the app shows the link instead.
    console.log(`[send-invite] RESEND_API_KEY not set. Invite link for ${invitation.email}: ${inviteUrl}`)
    return json({ sent: false })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('INVITE_FROM_EMAIL') ?? 'Munkalap <onboarding@resend.dev>',
      to: invitation.email,
      subject: `You're invited to ${orgName} on Munkalap`,
      text: `You've been invited to join ${orgName} on Munkalap.\n\nAccept the invitation: ${inviteUrl}\n\nThe link expires in 7 days.`,
      // The org name is user input, so it's escaped before going into HTML.
      html: `<p>You've been invited to join <strong>${escapeHtml(orgName)}</strong> on Munkalap.</p>
<p><a href="${escapeHtml(inviteUrl)}">Accept the invitation</a></p>
<p style="color:#666">The link expires in 7 days.</p>`,
    }),
  })

  if (!response.ok) {
    console.error('[send-invite] Email provider error', response.status, await response.text())
    return json({ error: 'The email provider rejected the message' }, 502)
  }

  return json({ sent: true })
})
