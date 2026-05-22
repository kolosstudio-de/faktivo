"use client"

import * as React from "react"
import { z } from "zod"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Wand2,
  Zap,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  clearLoginAttempts,
  getLoginRateStatus,
  recordFailedLoginAttempt,
} from "@/lib/auth/login-rate-limit"

type Mode = "signin" | "signup" | "magic"
type Busy = null | Mode | "demo" | "google" | "apple"

// OAuth-Provider werden NUR angezeigt, wenn in .env.local aktiviert.
// → Google: braucht Google Cloud Console Setup (kostenlos)
// → Apple: braucht Apple Developer Account (99 €/Jahr)
// Anleitung: scripts/deploy/OAUTH-SETUP.md
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === "true"
const APPLE_ENABLED = process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED === "true"

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const emailSchema = z.string().email()

/**
 * Plain-useState-Implementierung — bewusst KEIN react-hook-form,
 * weil dessen Controller-Pattern in Next 16 + React 19 + Turbopack
 * dazu führt, dass Inputs „tot" sind (Tippen geht nicht). Mit plain
 * useState funktioniert alles wie erwartet, identisch zur WaitlistForm.
 */
export function LoginForm() {
  const t = useTranslations("Auth")
  const router = useRouter()
  const [mode, setMode] = React.useState<Mode>("signin")
  const [magicSent, setMagicSent] = React.useState(false)
  const [confirmSent, setConfirmSent] = React.useState(false)
  const [busy, setBusy] = React.useState<Busy>(null)

  // Form state — eine Quelle der Wahrheit für alle Modi.
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [passwordConfirm, setPasswordConfirm] = React.useState("")
  const [errors, setErrors] = React.useState<{
    email?: string
    password?: string
    passwordConfirm?: string
  }>({})

  // ---------- Login rate-limit (client-side UX shield) ----------
  // We track failed attempts per email in localStorage. After 5 within 5
  // minutes, the form is disabled and a countdown is shown. Supabase has
  // its own server-side throttling — this just stops the user from
  // hammering the submit button.
  const [rateBlock, setRateBlock] = React.useState<{
    blocked: boolean
    secondsRemaining: number
  }>({ blocked: false, secondsRemaining: 0 })

  // Re-evaluate the rate-limit status whenever the email changes and
  // tick a countdown every second while blocked.
  React.useEffect(() => {
    if (mode !== "signin") {
      setRateBlock({ blocked: false, secondsRemaining: 0 })
      return
    }
    const status = getLoginRateStatus(email)
    setRateBlock({
      blocked: !status.allowed,
      secondsRemaining: status.secondsRemaining,
    })
    if (status.allowed) return
    const handle = window.setInterval(() => {
      const next = getLoginRateStatus(email)
      setRateBlock({
        blocked: !next.allowed,
        secondsRemaining: next.secondsRemaining,
      })
      if (next.allowed) window.clearInterval(handle)
    }, 1000)
    return () => window.clearInterval(handle)
  }, [email, mode])

  const goToDashboard = () => {
    router.push("/dashboard")
    router.refresh()
  }

  // ---------- Validation ----------
  const validateSignIn = () => {
    const errs: typeof errors = {}
    if (!emailSchema.safeParse(email).success) errs.email = t("emailPlaceholder")
    if (password.length < 6) errs.password = t("passwordTooShort")
    setErrors(errs)
    return Object.keys(errs).length === 0
  }
  const validateSignUp = () => {
    const errs: typeof errors = {}
    if (!emailSchema.safeParse(email).success) errs.email = t("emailPlaceholder")
    if (!PASSWORD_REGEX.test(password)) errs.password = t("passwordTooShort")
    if (password !== passwordConfirm) errs.passwordConfirm = t("passwordMismatch")
    setErrors(errs)
    return Object.keys(errs).length === 0
  }
  const validateMagic = () => {
    const errs: typeof errors = {}
    if (!emailSchema.safeParse(email).success) errs.email = t("emailPlaceholder")
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ---------- Sign In ----------
  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateSignIn()) return

    // Hard gate: server may still allow this, but our UX shield says no.
    const pre = getLoginRateStatus(email)
    if (!pre.allowed) {
      setRateBlock({ blocked: true, secondsRemaining: pre.secondsRemaining })
      toast.error(t("errorRateLimitTitle"), {
        description: t("errorRateLimitDescription", {
          seconds: pre.secondsRemaining,
        }),
      })
      return
    }

    const supabase = createClient()
    setBusy("signin")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(null)
    if (!error) {
      clearLoginAttempts(email)
      toast.success(t("signIn"))
      goToDashboard()
      return
    }
    // Record the failure and update the countdown.
    const post = recordFailedLoginAttempt(email)
    setRateBlock({
      blocked: !post.allowed,
      secondsRemaining: post.secondsRemaining,
    })

    const msg = error.message.toLowerCase()
    if (msg.includes("email not confirmed")) toast.error(t("errorEmailNotConfirmed"))
    else if (msg.includes("invalid")) {
      // Show remaining-attempts hint to be transparent.
      if (post.allowed && post.remainingAttempts > 0) {
        toast.error(t("errorInvalid"), {
          description: t("errorAttemptsRemaining", {
            count: post.remainingAttempts,
          }),
        })
      } else if (!post.allowed) {
        toast.error(t("errorRateLimitTitle"), {
          description: t("errorRateLimitDescription", {
            seconds: post.secondsRemaining,
          }),
        })
      } else {
        toast.error(t("errorInvalid"))
      }
    } else {
      toast.error(t("error"), { description: error.message })
    }
  }

  // ---------- Sign Up ----------
  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateSignUp()) return
    const supabase = createClient()
    setBusy("signup")
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setBusy(null)
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes("already") || msg.includes("registered")) {
        toast.error(t("errorExists"))
        setMode("signin")
      } else {
        toast.error(t("error"), { description: error.message })
      }
      return
    }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      toast.error(t("errorExists"))
      setMode("signin")
      return
    }
    setConfirmSent(true)
  }

  // ---------- Magic Link ----------
  const onMagic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateMagic()) return
    const supabase = createClient()
    setBusy("magic")
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setBusy(null)
    if (error) {
      toast.error(t("error"), { description: error.message })
      return
    }
    setMagicSent(true)
    toast.success(t("magicSent"))
  }

  // ---------- OAuth ----------
  const onOAuth = async (provider: "google" | "apple") => {
    setBusy(provider)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setBusy(null)
      toast.error(t("error"), { description: error.message })
    }
  }

  // ---------- Demo ----------
  const onDemo = async () => {
    setBusy("demo")
    try {
      const provision = await fetch("/api/auth/demo", { method: "POST" })
      const data = await provision.json()
      if (!provision.ok || !data.ok) throw new Error(data.error ?? "Demo failed")
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) throw error
      toast.success(t("demoLogin"))
      goToDashboard()
    } catch (e) {
      toast.error(t("error"), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setBusy(null)
    }
  }

  // ---------- Render: confirmation states ----------
  if (magicSent) {
    return (
      <ConfirmationView
        title={t("magicSent")}
        hint={t("magicSentHint")}
        onBack={() => {
          setMagicSent(false)
          setEmail("")
        }}
        backLabel={t("back")}
      />
    )
  }
  if (confirmSent) {
    return (
      <ConfirmationView
        title={t("checkEmail")}
        hint={t("magicSentHint")}
        onBack={() => {
          setConfirmSent(false)
          setMode("signin")
          setPassword("")
          setPasswordConfirm("")
        }}
        backLabel={t("back")}
      />
    )
  }

  // ---------- Render ----------
  return (
    <div className="grid gap-4">
      {/* Mode tabs */}
      <div className="bg-muted/50 grid grid-cols-3 gap-1 rounded-lg p-1 text-xs">
        <ModeTab
          active={mode === "signin"}
          onClick={() => {
            setMode("signin")
            setErrors({})
          }}
          icon={<KeyRound className="size-3" />}
          label={t("tabSignIn")}
        />
        <ModeTab
          active={mode === "signup"}
          onClick={() => {
            setMode("signup")
            setErrors({})
          }}
          icon={<ArrowRight className="size-3" />}
          label={t("tabSignUp")}
        />
        <ModeTab
          active={mode === "magic"}
          onClick={() => {
            setMode("magic")
            setErrors({})
          }}
          icon={<Wand2 className="size-3" />}
          label={t("tabMagic")}
        />
      </div>

      {mode === "signin" ? (
        <form onSubmit={onSignIn} className="grid gap-3">
          <Field label={t("email")} error={errors.email}>
            <Input
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label={t("password")} error={errors.password}>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={rateBlock.blocked}
            />
          </Field>
          {rateBlock.blocked ? (
            <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-lg border p-3 text-xs">
              <p className="font-medium">{t("errorRateLimitTitle")}</p>
              <p className="mt-1 opacity-90">
                {t("errorRateLimitCountdown", {
                  seconds: rateBlock.secondsRemaining,
                })}
              </p>
            </div>
          ) : null}
          <Button
            type="submit"
            size="lg"
            disabled={busy !== null || rateBlock.blocked}
          >
            {busy === "signin" ? <Loader2 className="animate-spin" /> : <KeyRound className="size-4" />}
            {rateBlock.blocked
              ? t("errorRateLimitCountdown", {
                  seconds: rateBlock.secondsRemaining,
                })
              : t("signIn")}
          </Button>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-center text-xs underline-offset-2 hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </form>
      ) : mode === "signup" ? (
        <form onSubmit={onSignUp} className="grid gap-3">
          <Field label={t("email")} error={errors.email}>
            <Input
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label={t("password")} error={errors.password}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label={t("passwordConfirm")} error={errors.passwordConfirm}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" size="lg" disabled={busy !== null}>
            {busy === "signup" ? <Loader2 className="animate-spin" /> : <ArrowRight className="size-4" />}
            {t("signUp")}
          </Button>
          <p className="text-muted-foreground text-center text-[10px]">
            {t("termsAccept")}{" "}
            <Link href="/agb" className="underline">AGB</Link> ·{" "}
            <Link href="/datenschutz" className="underline">Datenschutz</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={onMagic} className="grid gap-3">
          <Field label={t("email")} error={errors.email}>
            <Input
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" size="lg" disabled={busy !== null}>
            {busy === "magic" ? <Loader2 className="animate-spin" /> : <Mail className="size-4" />}
            {t("sendMagicLink")}
          </Button>
          <p className="text-muted-foreground text-center text-[10px]">
            {t("magicHint")}
          </p>
        </form>
      )}

      {/* Divider — nur zeigen wenn mind. ein OAuth-Provider aktiv */}
      {(GOOGLE_ENABLED || APPLE_ENABLED) && (
        <div className="relative my-1 flex items-center">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground px-3 text-[10px] uppercase tracking-wider">
            {t("or")}
          </span>
          <div className="bg-border h-px flex-1" />
        </div>
      )}

      {/* OAuth buttons — nur die, die in .env aktiviert sind */}
      <div className="grid gap-2">
        {GOOGLE_ENABLED && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy !== null}
            onClick={() => onOAuth("google")}
          >
            {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon className="size-4" />}
            {t("continueWithGoogle")}
          </Button>
        )}
        {APPLE_ENABLED && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy !== null}
            onClick={() => onOAuth("apple")}
          >
            {busy === "apple" ? <Loader2 className="animate-spin" /> : <AppleIcon className="size-4" />}
            {t("continueWithApple")}
          </Button>
        )}
      </div>

      <div className="bg-border h-px" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy !== null}
        onClick={onDemo}
        className="border-dashed"
      >
        {busy === "demo" ? <Loader2 className="animate-spin" /> : <Zap className="size-4 text-amber-500" />}
        {t("demoLogin")}
      </Button>
      <p className="text-muted-foreground text-center text-[10px]">
        {t("demoHint")}
      </p>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  )
}

function ConfirmationView({
  title,
  hint,
  onBack,
  backLabel,
}: {
  title: string
  hint: string
  onBack: () => void
  backLabel: string
}) {
  return (
    <div className="grid gap-3 text-center">
      <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
        <CheckCircle2 className="size-6" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground text-xs">
        {hint}{" "}
        <a
          href="http://127.0.0.1:54324"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          (Mailpit lokal)
        </a>
      </p>
      <Button variant="link" size="sm" onClick={onBack}>
        ← {backLabel}
      </Button>
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M17.05 12.03c-.04-3.54 2.89-5.24 3.02-5.32-1.65-2.41-4.21-2.74-5.12-2.78-2.18-.22-4.25 1.28-5.36 1.28-1.12 0-2.82-1.25-4.64-1.21-2.39.04-4.6 1.39-5.83 3.53-2.49 4.32-.64 10.71 1.79 14.21 1.19 1.71 2.6 3.62 4.45 3.55 1.79-.07 2.46-1.15 4.62-1.15s2.77 1.15 4.66 1.11c1.92-.04 3.14-1.74 4.32-3.46 1.36-1.99 1.92-3.92 1.95-4.02-.04-.02-3.74-1.43-3.78-5.69zM13.5 2.34c.99-1.2 1.65-2.86 1.47-4.51-1.42.06-3.14.94-4.16 2.13-.91 1.05-1.71 2.74-1.49 4.36 1.58.12 3.2-.8 4.18-1.98z" />
    </svg>
  )
}
