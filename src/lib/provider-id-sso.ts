import type { OAuthConfig } from 'next-auth/providers'
import type { UserRole } from '@/types'

interface ProviderOrganization {
  hcode?: string | null
  hname_th?: string | null
  hname_eng?: string | null
  position?: string | null
  position_type?: string | null
  license_id_verify?: boolean
  is_hr_admin?: boolean
  is_director?: boolean
}

export interface ProviderIdSsoProfile {
  id?: string
  provider_id?: string
  account_id?: string
  name_prefix?: string | null
  name?: string | null
  surname?: string | null
  birthdate?: string | null
  mobile_no?: string | null
  hash_cid?: string | null
  name_th?: string | null
  name_eng?: string | null
  organizations?: ProviderOrganization[]
}

interface ProviderTokenResponse {
  token_type: string
  expires_in: number
  access_token: string
  user: ProviderIdSsoProfile
}

export function isProviderIdSsoConfigured() {
  return Boolean(
    process.env.SSO_URL &&
      process.env.SSO_CLIENT_ID &&
      process.env.SSO_CLIENT_SECRET &&
      process.env.SSO_REDIRECT_URI,
  )
}

export function mapProviderProfileRole(profile: ProviderIdSsoProfile): UserRole {
  const organizations = profile.organizations ?? []
  if (organizations.some((org) => org.is_hr_admin || org.is_director)) return 'admin'
  if (organizations.some((org) => org.position_type?.toLowerCase().includes('ems'))) return 'ems'
  if (organizations.length > 0) return 'officer'
  return 'viewer'
}

function profileName(profile: ProviderIdSsoProfile) {
  if (profile.name_th) return profile.name_th
  if (profile.name_eng) return profile.name_eng
  return [profile.name, profile.surname].filter(Boolean).join(' ') || profile.provider_id || 'Provider ID User'
}

export function providerIdSsoProvider(): OAuthConfig<ProviderIdSsoProfile> {
  const ssoUrl = process.env.SSO_URL
  const clientId = process.env.SSO_CLIENT_ID
  const clientSecret = process.env.SSO_CLIENT_SECRET
  const redirectUri = process.env.SSO_REDIRECT_URI

  if (!ssoUrl || !clientId || !clientSecret || !redirectUri) {
    throw new Error('Provider ID SSO is not configured')
  }

  return {
    id: 'provider-id-sso',
    name: 'Provider ID SSO',
    type: 'oauth',
    checks: ['state'],
    authorization: {
      url: new URL('/authorize', ssoUrl).toString(),
      params: {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: undefined,
      },
    },
    token: {
      url: new URL('/api/oauth/token', ssoUrl).toString(),
      async request({ params }: { params: { code?: string } }) {
        const response = await fetch(new URL('/api/oauth/token', ssoUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: params.code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        })

        if (!response.ok) {
          throw new Error(`Provider ID SSO token exchange failed: ${response.status}`)
        }

        const data = (await response.json()) as ProviderTokenResponse
        return {
          tokens: {
            access_token: data.access_token,
            token_type: data.token_type,
            expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 900),
            user: data.user,
          },
        }
      },
    },
    userinfo: {
      url: new URL('/api/oauth/introspect', ssoUrl).toString(),
      async request({ tokens }: { tokens: Record<string, unknown> }) {
        return (tokens as typeof tokens & { user?: ProviderIdSsoProfile }).user ?? {}
      },
    },
    profile(profile) {
      const providerId = profile.provider_id ?? profile.id ?? profile.account_id
      return {
        id: providerId ?? crypto.randomUUID(),
        email: providerId ? `${providerId}@provider-id.local` : `${crypto.randomUUID()}@provider-id.local`,
        name: profileName(profile),
        role: mapProviderProfileRole(profile),
      }
    },
  }
}
