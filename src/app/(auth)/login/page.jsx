"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

import AuthLayout, {
  AuthField,
  PasswordToggle,
} from "@/components/layout/AuthLayout";
import Form from "@/components/forms/Form";
import FormInput from "@/components/forms/FormInput";

import { loginSchema } from "@/validations";
import { useLoginMutation } from "@/redux/api/authApi";
import { errorMessage } from "@/redux/api/baseApi";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { token, ready, expired, isAuthenticated, role } = useAuth();

  console.log("REDUX AUTH STATE:", {
    role,
    ready,
    isAuthenticated,
  });

  const [login, { isLoading }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

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

  const onSubmit = async (values) => {
    if (isLoading) return;

    setServerError("");

    try {
      const result = await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      }).unwrap();
      console.log("LOGIN API RESPONSE:", result);
      console.log("LOGIN USER ROLE:", result?.user?.role);

      if (!result?.token || !result?.user) {
        const message = "Invalid login response from the server.";
        setServerError(message);
        toast.error(message);
        return;
      }

      const firstName = result.user.name?.split(" ")[0] || "User";

      toast.success(`Welcome back, ${firstName}!`);

      const userRole = result.user.role;

      if (userRole === "super-admin") {
        router.replace("/super-admin/dashboard");
      } else if (userRole === "admin" || userRole === "employee") {
        router.replace("/dashboard");
      } else {
        toast.error("Your account role is not supported.");
      }
    } catch (error) {
      const message = errorMessage(
        error,
        "Login failed. Please try again."
      );

      setServerError(message);
      toast.error(message);
    }
  };

  return (
    <AuthLayout
      eyebrow="Your rental workspace"
      title="Welcome back"
      subtitle="Sign in to manage your rental business."
      footer={
        <>
          New to Rent a Car?{" "}
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
          className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Sign in unsuccessful</p>
            <p className="mt-1 text-xs leading-5">{serverError}</p>
          </div>
        </div>
      )}

      <Form form={form} onSubmit={onSubmit} className="space-y-5">
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
            <>
              <Link
                href="/forgot-password"
                className="absolute right-0 top-0 text-[13px] font-semibold leading-5 text-primary hover:underline"
              >
                Forgot password?
              </Link>

              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            </>
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

        <button
          type="submit"
          className="btn btn-primary btn-lg w-full"
          disabled={isLoading || !ready || !!token}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in to Rent a Car
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </Form>
    </AuthLayout>
  );
}