import { customFetch } from 'next-auth'
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
  sub?: string
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

  const tokenUrl = new URL('/api/oauth/token', ssoUrl).toString()
  const introspectUrl = new URL('/api/oauth/introspect', ssoUrl).toString()

  return {
    id: 'provider-id-sso',
    name: 'Provider ID SSO',
    type: 'oauth',
    clientId: clientId,
    clientSecret: clientSecret,
    client: {
      token_endpoint_auth_method: 'client_secret_post',
    },
    checks: ['state'],
    authorization: {
      url: new URL('/authorize', ssoUrl).toString(),
      params: {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: undefined,
        prompt: 'login',
      },
    },
    token: {
      url: tokenUrl,
    },
    userinfo: {
      url: introspectUrl,
      async request({ tokens }: { tokens: Record<string, unknown> }) {
        const accessToken = tokens.access_token
        if (typeof accessToken !== 'string') return {}

        const response = await fetch(introspectUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: accessToken,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        })

        if (!response.ok) return {}

        const profile = (await response.json()) as ProviderIdSsoProfile & { active?: boolean }
        return profile.active === false ? {} : profile
      },
    },
    async profile(profile) {
      const providerId = profile.provider_id ?? profile.sub ?? profile.id ?? profile.account_id

      // ถ้า SSO profile มี hash_cid → ตรวจ whitelist DB ก่อน (hash ตรงกับ users.cid_hash)
      // ถ้าเจอและ active → ใช้ role จาก DB; ถ้าไม่เจอหรือ suspended → fallback profile-based
      let role: UserRole = mapProviderProfileRole(profile)
      if (profile.hash_cid) {
        try {
          const { getDb } = await import('@/lib/db')
          const { users } = await import('@/db/schema')
          const { eq } = await import('drizzle-orm')
          const db = getDb()
          const [staff] = await db
            .select({ role: users.role, status: users.status })
            .from(users)
            .where(eq(users.cidHash, profile.hash_cid))
            .limit(1)
          if (staff?.status === 'active') role = staff.role as UserRole
        } catch {
          // DB ไม่พร้อม → ใช้ role จาก profile ต่อไป
        }
      }

      return {
        id: providerId ?? crypto.randomUUID(),
        email: providerId ? `${providerId}@provider-id.local` : `${crypto.randomUUID()}@provider-id.local`,
        name: profileName(profile),
        role,
      }
    },
    async [customFetch](input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url === tokenUrl && init?.body instanceof URLSearchParams) {
        const body = Object.fromEntries(init.body.entries())
        return fetch(input, {
          ...init,
          headers: {
            ...Object.fromEntries(new Headers(init.headers).entries()),
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      }

      return fetch(input, init)
    },
  }
}
