import { create } from 'zustand'

const safeParseUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || null
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

const useAuthStore = create((set) => ({
  user: safeParseUser(),
  token: localStorage.getItem('token') || null,
  initialized: false,

  login: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },

  setInitialized: (value) => {
    set({ initialized: value })
  },
}))

export default useAuthStore