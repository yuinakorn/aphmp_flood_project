import { isProviderIdSsoConfigured } from '@/lib/provider-id-sso'
import { LoginClient } from './LoginClient'

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {}
  const error = Array.isArray(params.error) ? params.error[0] : params.error

  return <LoginClient ssoEnabled={isProviderIdSsoConfigured()} error={error ?? null} />
}
