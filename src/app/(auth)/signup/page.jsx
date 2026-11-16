"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Building2,
  UserRound,
  LockKeyhole,
  Check,
  CheckCircle2,
  Circle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Mail,
  AlertCircle,
  UploadCloud,
  ImagePlus,
  X,
  Camera,
} from "lucide-react";

import AuthLayout, {
  AuthActions,
  AuthField,
  DemoVideosButton,
  PasswordToggle,
} from "@/components/layout/AuthLayout";
import Form from "@/components/forms/Form";
import FormInput from "@/components/forms/FormInput";
import PhoneInput from "@/components/forms/PhoneInput";

import { signupSchema } from "@/validations";
import { useSignupMutation } from "@/redux/api/authApi";
import { errorMessage } from "@/redux/api/baseApi";
import { useAuth } from "@/hooks/useAuth";

// ======================================================
// CONSTANTS
// ======================================================

const DEFAULT_VALUES = {
  businessName: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value) => value.length >= 8 },
  { label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value) => /[a-z]/.test(value) },
  { label: "One number", test: (value) => /[0-9]/.test(value) },
  {
    label: "One special character",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

// ======================================================
// SECTION HEADER
// ======================================================

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
        <Icon size={19} />
      </div>

      <div className="min-w-0">
        <h2 className="text-base font-bold text-heading">{title}</h2>
        <p className="mt-0.5 text-sm leading-5 text-muted">{description}</p>
      </div>
    </div>
  );
}

// ======================================================
// IMAGE UPLOAD (compact)
// ======================================================

function ImageUpload({
  label,
  description,
  value,
  onChange,
  disabled = false,
  variant = "avatar",
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");

  // Object URLs must be revoked, so this effect is required.
  useEffect(() => {
    if (!value) {
      setPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(value);
    setPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [value]);

  const handleFile = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only JPG, PNG and WEBP images are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image size must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    onChange(file);

    // Allow selecting the same file again.
    event.target.value = "";
  };

  const removeImage = () => {
    onChange(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const isAvatar = variant === "avatar";

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-[#9fc0ee] bg-white/70 p-3 sm:flex-nowrap">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        disabled={disabled}
        className="hidden"
        aria-label={label}
      />

      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden border border-[#c3d6f4] bg-white ${
          isAvatar ? "h-16 w-16 rounded-full" : "h-16 w-20 rounded-xl"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={isAvatar ? "Owner profile preview" : "Business logo preview"}
            className={`h-full w-full ${
              isAvatar ? "object-cover" : "object-contain"
            }`}
          />
        ) : isAvatar ? (
          <Camera size={24} className="text-muted" />
        ) : (
          <Building2 size={26} className="text-muted" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-heading">
          {label}
          <span className="ml-1 font-normal text-muted">(Optional)</span>
        </p>

        <p className="mt-0.5 truncate text-xs text-muted">
          {value ? value.name : description}
        </p>

        <p className="mt-0.5 text-[11px] text-muted">
          JPG, PNG or WEBP · Maximum 5 MB
        </p>
      </div>

      <div className="flex w-full shrink-0 gap-2 sm:w-auto">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="btn btn-neutral btn-sm"
        >
          {preview ? <ImagePlus size={14} /> : <UploadCloud size={14} />}
          {preview ? "Change" : "Choose image"}
        </button>

        {preview && (
          <button
            type="button"
            disabled={disabled}
            onClick={removeImage}
            className="btn btn-sm border-red-200 bg-white text-red-600 hover:bg-red-50"
          >
            <X size={14} />
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ======================================================
// PASSWORD FIELD
// ======================================================

function PasswordField({ name, label, placeholder, visible, onToggle }) {
  return (
    <AuthField
      trailing={<PasswordToggle visible={visible} onToggle={onToggle} />}
    >
      <FormInput
        name={name}
        label={label}
        required
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete="new-password"
        inputClassName="pr-12"
      />
    </AuthField>
  );
}

// ======================================================
// PASSWORD REQUIREMENTS
// ======================================================

function PasswordRequirements({ password = "" }) {
  const checks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));

  const passedCount = checks.filter((rule) => rule.passed).length;

  const allPassed =
    passedCount === PASSWORD_RULES.length && password.length <= 128;

  return (
    <div className="rounded-xl border border-[#c3d6f4] bg-white/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-heading">
          Password requirements
        </p>

        <span
          className={`text-xs font-medium ${
            allPassed ? "text-emerald-600" : "text-muted"
          }`}
        >
          {allPassed
            ? "All requirements met"
            : `${passedCount} of ${PASSWORD_RULES.length} completed`}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-1.5" aria-hidden="true">
        {PASSWORD_RULES.map((rule, index) => (
          <div
            key={rule.label}
            className={`h-1.5 rounded-full transition-colors ${
              index < passedCount
                ? allPassed
                  ? "bg-success"
                  : "bg-primary"
                : "bg-[#c3d6f4]"
            }`}
          />
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {checks.map((rule) => (
          <div key={rule.label} className="flex items-center gap-2 text-xs">
            {rule.passed ? (
              <CheckCircle2
                size={15}
                className="shrink-0 text-emerald-600"
              />
            ) : (
              <Circle size={15} className="shrink-0 text-slate-400" />
            )}

            <span className={rule.passed ? "text-heading" : "text-muted"}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>

      {password.length > 128 && (
        <p className="mt-3 text-xs text-red-600">
          Password cannot exceed 128 characters.
        </p>
      )}
    </div>
  );
}

// ======================================================
// SERVER VALIDATION ERROR HELPER
// ======================================================

function getServerFieldErrors(error) {
  const data = error?.data;

  if (!data || typeof data !== "object") {
    return [];
  }

  const details =
    data.errors ||
    data.details ||
    data.validationErrors ||
    data.error?.details ||
    [];

  if (Array.isArray(details)) {
    return details
      .map((item) => ({
        field:
          item?.field ||
          (Array.isArray(item?.path) ? item.path.join(".") : item?.path) ||
          item?.name,
        message: item?.message,
      }))
      .filter(
        (item) =>
          typeof item.field === "string" && typeof item.message === "string"
      );
  }

  if (details && typeof details === "object") {
    return Object.entries(details).map(([field, message]) => ({
      field,
      message: Array.isArray(message) ? message.join(", ") : String(message),
    }));
  }

  return [];
}

// ======================================================
// SIGNUP PAGE
// ======================================================

export default function SignupPage() {
  const router = useRouter();

  const { token, ready } = useAuth();

  const [signup, { isLoading }] = useSignupMutation();

  const [avatarFile, setAvatarFile] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [serverError, setServerError] = useState("");

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });

  const {
    control,
    setError,
    clearErrors,
    formState: { isSubmitting },
  } = form;

  const password = useWatch({
    control,
    name: "password",
    defaultValue: "",
  });

  const confirmPassword = useWatch({
    control,
    name: "confirmPassword",
    defaultValue: "",
  });

  const passwordsMatch = Boolean(confirmPassword) && password === confirmPassword;
  const passwordsDiffer = Boolean(confirmPassword) && password !== confirmPassword;

  const submitting = isLoading || isSubmitting;

  // ====================================================
  // REDIRECT AUTHENTICATED USERS
  // ====================================================

  useEffect(() => {
    if (ready && token) {
      router.replace("/dashboard");
    }
  }, [ready, token, router]);

  // ====================================================
  // SUBMIT
  // ====================================================

  const onSubmit = async (values) => {
    if (isLoading || !ready || token) return;

    setServerError("");
    clearErrors();

    // Multipart FormData is required for image uploads.
    // Do NOT set a Content-Type header: the browser adds the boundary.
    const payload = new FormData();

    payload.append("businessName", values.businessName.trim());
    payload.append("name", values.name.trim());
    payload.append("email", values.email.trim().toLowerCase());
    payload.append("phone", values.phone.trim());
    payload.append("password", values.password);
    payload.append("confirmPassword", values.confirmPassword);

    // Must match the backend Multer field name: { name: "avatar", maxCount: 1 }

    if (avatarFile) {
      payload.append("avatar", avatarFile);
    }

    try {
      const result = await signup(payload).unwrap();

      if (!result?.token || !result?.user) {
        const message =
          "Registration response is incomplete. Please log in or contact support.";

        setServerError(message);
        toast.error(message);
        return;
      }

      // authApi.js saves credentials automatically.
      toast.success(
        "Account created successfully! Your 3-day free trial has started."
      );

      router.replace("/dashboard");
    } catch (error) {
      const message = errorMessage(
        error,
        "Registration failed. Please try again."
      );

      setServerError(message);

      if (error?.status === 409) {
        setError(
          "email",
          {
            type: "server",
            message: "This email address is already registered.",
          },
          { shouldFocus: true }
        );
      }

      const fieldErrors = getServerFieldErrors(error);

      for (const { field, message: fieldMessage } of fieldErrors) {
        if (Object.prototype.hasOwnProperty.call(DEFAULT_VALUES, field)) {
          setError(field, {
            type: "server",
            message: fieldMessage,
          });
        }
      }

      if (
        error?.status === "FETCH_ERROR" ||
        error?.status === "TIMEOUT_ERROR"
      ) {
        toast.error(
          "Unable to connect to the server. Check your internet connection."
        );
      } else {
        toast.error(message);
      }
    }
  };

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <AuthLayout
      mode="signup"
      wide
      title="Create your account"
      subtitle="Register as Admin and start your 3-day free trial."
    >
      {serverError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Registration unsuccessful</p>
            <p className="mt-1 text-xs leading-5">{serverError}</p>
          </div>
        </div>
      )}

      {/* No inner scroll container: the card body in AuthLayout scrolls. */}
      <Form form={form} onSubmit={onSubmit} className="space-y-4">
        {/* ====================================
            BUSINESS INFORMATION
        ==================================== */}

        <section className="space-y-4 rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm">
          <SectionHeader
            icon={Building2}
            title="Business information"
            description="Tell us the name of your rental business."
          />

          <FormInput
            name="businessName"
            label="Business Name"
            required
            placeholder="e.g. City Rent A Car"
            autoComplete="organization"
          />
        </section>

        {/* ====================================
            OWNER INFORMATION
        ==================================== */}

        <section className="space-y-4 rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm">
          <SectionHeader
            icon={UserRound}
            title="Owner information"
            description="These details will be used for your administrator account."
          />

          <ImageUpload
            label="Profile Photo"
            description="Add a photo for your administrator profile."
            value={avatarFile}
            onChange={setAvatarFile}
            disabled={submitting}
            variant="avatar"
          />

          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <FormInput
              name="name"
              label="Owner Full Name"
              required
              placeholder="Enter your full name"
              autoComplete="name"
            />

            <FormInput
              name="email"
              label="Email Address"
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
            />

            <PhoneInput name="phone" required />

            <p className="flex items-start gap-2 text-xs leading-5 text-muted sm:self-end sm:pb-3">
              <Mail size={14} className="mt-0.5 shrink-0" />
              Your email address will be used to log in and recover your
              account.
            </p>
          </div>
        </section>

        {/* ====================================
            ACCOUNT SECURITY
        ==================================== */}

        <section className="space-y-4 rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm">
          <SectionHeader
            icon={LockKeyhole}
            title="Account security"
            description="Create a secure password for your account."
          />

          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <PasswordField
              name="password"
              label="Password"
              placeholder="Create password"
              visible={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />

            <PasswordField
              name="confirmPassword"
              label="Confirm Password"
              placeholder="Repeat password"
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
            />
          </div>

          <PasswordRequirements password={password || ""} />

          {passwordsMatch && (
            <p className="flex items-center gap-2 text-xs font-medium text-emerald-600">
              <Check size={15} />
              Passwords match.
            </p>
          )}

          {passwordsDiffer && (
            <p className="flex items-center gap-2 text-xs font-medium text-red-600">
              <AlertCircle size={15} />
              Passwords do not match.
            </p>
          )}
        </section>

        {/* ====================================
            ADMIN NOTE
        ==================================== */}

        <div className="flex items-start gap-2 rounded-xl border border-[#c3d6f4] bg-white/60 p-3">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary" />

          <p className="text-xs leading-5 text-muted">
            Your account will be registered as a Business Administrator. You can
            create employees and manage their permissions after registration.
          </p>
        </div>

        {/* ====================================
            STICKY ACTIONS
            Pinned to the bottom of the scrolling card.
        ==================================== */}

        <AuthActions sticky>
          <button
            type="submit"
            disabled={submitting || !ready || Boolean(token)}
            className="btn btn-primary h-11 w-full text-[15px] shadow-md shadow-primary/25"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating your account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <DemoVideosButton />
        </AuthActions>
      </Form>
    </AuthLayout>
  );
}