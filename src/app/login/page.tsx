import { isProviderIdSsoConfigured } from '@/lib/provider-id-sso'
import { LoginClient } from './LoginClient'

export default function LoginPage() {
  return <LoginClient ssoEnabled={isProviderIdSsoConfigured()} />
}
