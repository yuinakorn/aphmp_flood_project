import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { UserRole } from '@/types'
import { isProviderIdSsoConfigured, providerIdSsoProvider } from '@/lib/provider-id-sso'

declare module 'next-auth' {
  interface User {
    role: UserRole
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
    }
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    ...(isProviderIdSsoConfigured() ? [providerIdSsoProvider()] : []),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // TODO: replace with DB lookup + bcrypt verify
        const DEMO_USERS = [
          { id: '1', email: 'admin@floodwatch.th', password: 'admin1234', name: 'Admin', role: 'admin' as UserRole },
          { id: '2', email: 'officer@floodwatch.th', password: 'officer1234', name: 'เจ้าหน้าที่', role: 'officer' as UserRole },
          { id: '3', email: 'viewer@floodwatch.th', password: 'viewer1234', name: 'ผู้ดู', role: 'viewer' as UserRole },
        ]
        const user = DEMO_USERS.find(
          (u) => u.email === credentials?.email && u.password === credentials?.password,
        )
        if (!user) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.role) {
        session.user.id = String(token.id ?? '')
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
