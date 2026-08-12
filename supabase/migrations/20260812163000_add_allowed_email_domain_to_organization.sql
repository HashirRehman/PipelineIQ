-- Add allowed_email_domain column to organizations table.
-- A value like 'recursolabs.com' restricts user invitations to that domain.
-- NULL or empty string allows user invitations from any domain.

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS allowed_email_domain TEXT DEFAULT 'recursolabs.com';

-- Set default allowed domain for existing organizations
UPDATE public.organizations 
SET allowed_email_domain = 'recursolabs.com' 
WHERE allowed_email_domain IS NULL;

COMMENT ON COLUMN public.organizations.allowed_email_domain IS 
'Allowed email domain for user invitations (e.g. recursolabs.com). NULL or empty allows any domain.';
