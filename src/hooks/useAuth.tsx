import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '../types'
import { authApi } from '../lib/api'

interface AuthCtx {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const s = sessionStorage.getItem('sim_user')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })

  const login = async (email: string, password: string) => {
    const u = await authApi.login(email, password)
    if (u) { setUser(u); sessionStorage.setItem('sim_user', JSON.stringify(u)); return true }
    return false
  }

  const logout = () => { setUser(null); sessionStorage.removeItem('sim_user') }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
