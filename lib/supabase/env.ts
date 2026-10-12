// NEXT_PUBLIC_* values are inlined into the browser bundle at build time,
// which is why they're referenced literally here.
export const supabaseUrl = required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
export const supabaseKey = required(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
)

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in from \`supabase status\`.`)
  }
  return value
}
