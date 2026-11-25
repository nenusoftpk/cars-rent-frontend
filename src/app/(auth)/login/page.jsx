"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail, UserRound } from "lucide-react";

import AuthLayout, {
  AppDownloadButtons,
  AuthActions,
  AuthField,
  DemoVideosButton,
  PasswordToggle,
} from "@/components/layout/AuthLayout";
import Form from "@/components/forms/Form";
import FormInput from "@/components/forms/FormInput";

import { loginSchema } from "@/validations";
import { useLoginMutation } from "@/redux/api/authApi";
import { errorMessage } from "@/redux/api/baseApi";
import { useAuth } from "@/hooks/useAuth";

// ======================================================
// REMEMBER ME (remembers the email address on this device)
// ======================================================

const REMEMBER_KEY = "rent-a-car:remembered-email";

const DEMO_CREDENTIALS = {
  email: "demoadmin@gmail.com",
  password: "Demo@12345",
};

function readRememberedEmail() {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) || "";
  } catch {
    return "";
  }
}

function saveRememberedEmail(email) {
  try {
    window.localStorage.setItem(REMEMBER_KEY, email);
  } catch {
    // Storage can be blocked (private mode). Login still works.
  }
}

function clearRememberedEmail() {
  try {
    window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // ignore
  }
}

// ======================================================
// LOGIN PAGE
// ======================================================

export default function LoginPage() {
  const router = useRouter();
  const { token, ready, expired, isAuthenticated, role } = useAuth();

  const [login, { isLoading }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isDemoLogin, setIsDemoLogin] = useState(false);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { setValue } = form;

  // Pre-fill the email if the user ticked "Remember me" last time.
  useEffect(() => {
    const saved = readRememberedEmail();

    if (saved) {
      setValue("email", saved, { shouldDirty: false });
      setRememberMe(true);
    }
  }, [setValue]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    if (role === "super-admin") {
      router.replace("/super-admin/dashboard");
    } else if (role === "admin" || role === "employee") {
      router.replace("/dashboard");
    }
  }, [ready, isAuthenticated, role, router]);

  useEffect(() => {
    if (ready && expired) {
      toast.error("Your session has expired. Please log in again.");
    }
  }, [ready, expired]);

  const handleLogin = async (values, demo = false) => {
    if (isLoading || !ready || token) return;

    setServerError("");
    setIsDemoLogin(demo);

    const email = values.email.trim().toLowerCase();

    try {
      const result = await login({
        email,
        password: values.password,
      }).unwrap();

      if (!result?.token || !result?.user) {
        const message = "Invalid login response from the server.";

        setServerError(message);
        toast.error(message);
        return;
      }

      // Do not change remembered email during demo login.
      if (!demo) {
        if (rememberMe) {
          saveRememberedEmail(email);
        } else {
          clearRememberedEmail();
        }
      }

      const firstName =
        result.user.name?.split(" ")[0] || "User";

      toast.success(
        demo
          ? "Welcome to the Demo Account!"
          : `Welcome back, ${firstName}!`
      );

      const userRole = result.user.role;

      if (userRole === "super-admin") {
        router.replace("/super-admin/dashboard");
      } else if (
        userRole === "admin" ||
        userRole === "employee"
      ) {
        router.replace("/dashboard");
      } else {
        toast.error("Your account role is not supported.");
      }
    } catch (error) {
      const message = errorMessage(
        error,
        demo
          ? "Demo login failed. Please try again."
          : "Login failed. Please try again."
      );

      setServerError(message);
      toast.error(message);
    } finally {
      setIsDemoLogin(false);
    }
  };

  const onSubmit = (values) => {
    return handleLogin(values, false);
  };

  const handleDemoLogin = () => {
    return handleLogin(DEMO_CREDENTIALS, true);
  };



  return (
    <AuthLayout
      mode="login"
      title="Welcome Back"
      subtitle="Sign in to your account."
      footer={
        <>
          Don&apos;t have an account yet?{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      {serverError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Sign in unsuccessful</p>
            <p className="mt-0.5 text-xs leading-5">{serverError}</p>
          </div>
        </div>
      )}

      <Form
        form={form}
        onSubmit={onSubmit}
        className="space-y-4 [@media(max-height:720px)]:space-y-3"
      >
        <AuthField icon={Mail}>
          <FormInput
            name="email"
            label="Email Address"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            inputClassName="pl-11"
          />
        </AuthField>

        <AuthField
          icon={Lock}
          trailing={
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />
          }
        >
          <FormInput
            name="password"
            label="Password"
            required
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            inputClassName="pl-11 pr-12"
          />
        </AuthField>

        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-heading">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-primary"
            />
            Remember me
          </label>

          <Link
            href="/forgot-password"
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="btn btn-primary h-11 w-full text-[15px] shadow-md shadow-primary/25 [@media(max-height:720px)]:h-10"
          disabled={isLoading || !ready || !!token}
        >
          {isLoading && !isDemoLogin ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Login
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </Form>

      <div className="mt-3 pb-4 [@media(max-height:720px)]:pb-3">
        <AuthActions>

          {/* ================= DEMO LOGIN ================= */}

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading || !ready || !!token}
            className="btn h-11 w-full bg-emerald-600 text-[15px] text-white shadow-md shadow-emerald-600/25 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 [@media(max-height:720px)]:h-10"
          >
            {isLoading && isDemoLogin ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                Opening Demo...
              </>
            ) : (
              <>
                <UserRound size={18} />
                Demo Login
              </>
            )}
          </button>

          {/* ================= DEMO VIDEOS ================= */}

          <DemoVideosButton />

          {/* ================= APP DOWNLOADS ================= */}

          <AppDownloadButtons />

        </AuthActions>
      </div>
    </AuthLayout>
  );
}