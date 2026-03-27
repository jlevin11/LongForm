'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateKeyPair, encryptPrivateKey, storePrivateKey } from '@/lib/crypto'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    fullName: '',
    firmName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'generating'>('form')

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setStep('generating')

    try {
      // 1. Generate RSA keypair
      const { publicKey, privateKey } = await generateKeyPair()

      // 2. Encrypt private key with password
      const { encryptedPrivateKey, salt, iv } = await encryptPrivateKey(
        privateKey,
        form.password
      )

      // 3. Create Supabase auth account
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (authError) throw new Error(authError.message)
      if (!authData.user) throw new Error('Signup failed — no user returned')

      // 4. Save profile with public key and encrypted private key
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: form.email,
        full_name: form.fullName,
        firm_name: form.firmName || null,
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey,
        key_salt: salt,
        key_iv: iv,
      })
      if (profileError) throw new Error(profileError.message)

      // 5. Store private key in sessionStorage
      storePrivateKey(authData.user.id, privateKey)

      toast.success('Account created! Welcome to Contract Git.')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setStep('form')
      toast.error(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'generating') {
    return (
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-2xl mb-5 animate-pulse">
            <KeyRound className="h-6 w-6 text-[#1e3a5f]" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Generating your keys…</h2>
          <p className="text-sm text-slate-500">
            We&apos;re creating your personal RSA encryption keypair. This only takes a moment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-xl mb-4">
            <KeyRound className="h-5 w-5 text-[#1e3a5f]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Your encryption keys will be generated automatically
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Firm name <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={form.firmName}
              onChange={(e) => update('firmName', e.target.value)}
              placeholder="Smith & Associates LLP"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="you@firm.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Important:</strong> Your password is used to encrypt your private key. If you
            forget it, you cannot recover your contracts. There is no password reset.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1e3a5f] text-white font-medium py-2.5 rounded-lg hover:bg-[#2d5282] transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-[#1e3a5f] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
