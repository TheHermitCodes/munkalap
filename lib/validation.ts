import { z } from 'zod'
import { PRIORITIES, STATUSES } from './work-orders'
import { Constants } from './database.types'

// Server Actions are public HTTP endpoints: anyone can call them with any
// payload. Everything coming from a form is parsed here before use. RLS still
// decides *whether* the user may do it; this decides *what* they're asking for.

/** Empty form fields arrive as ''. Treat them as "not set". */
const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

const optionalText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable())
const optionalId = z.preprocess(blankToNull, z.guid().nullable())

export const idSchema = z.guid()

export const workOrderSchema = z.object({
  title: z.string().trim().min(1, 'Give the work order a title.').max(200, 'Keep the title under 200 characters.'),
  description: z.string().trim().max(10000).default(''),
  customer_id: optionalId,
  assignee_id: optionalId,
  priority: z.enum(PRIORITIES).default('normal'),
  due_date: z.preprocess(blankToNull, z.iso.date().nullable()),
})

/** A single field changed from the work order sidebar. */
export const workOrderFieldSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('status'), value: z.enum(STATUSES) }),
  z.object({ field: z.literal('priority'), value: z.enum(PRIORITIES) }),
  z.object({ field: z.literal('assignee_id'), value: optionalId }),
  z.object({ field: z.literal('customer_id'), value: optionalId }),
  z.object({ field: z.literal('due_date'), value: z.preprocess(blankToNull, z.iso.date().nullable()) }),
])

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first.').max(5000),
})

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customers need a name.').max(120),
  email: z.preprocess(blankToNull, z.email('That email address looks wrong.').max(254).nullable()),
  phone: optionalText(40),
  address: optionalText(300),
  notes: optionalText(2000),
})

export const organizationSchema = z.object({
  name: z.string().trim().min(1, 'Give your organization a name.').max(80),
})

export const invitationSchema = z.object({
  // Normalized here because the database only accepts lower-case, trimmed emails.
  email: z.string().trim().toLowerCase().pipe(z.email('That email address looks wrong.')),
  role: z.enum(Constants.public.Enums.org_role).default('member'),
})

export const roleSchema = z.enum(Constants.public.Enums.org_role)

export const signInSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Enter your password.'),
})

export const signUpSchema = z.object({
  full_name: z.string().trim().min(1, 'Tell us your name.').max(120),
  email: z.string().trim().pipe(z.email('Enter a valid email address.')),
  password: z.string().min(8, 'Use at least 8 characters.'),
})

/** First validation message, for showing next to a form. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Some of the values are not valid.'
}

export function formValues(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData)
}

export function isId(value: unknown): value is string {
  return idSchema.safeParse(value).success
}
