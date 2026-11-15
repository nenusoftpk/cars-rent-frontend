"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  Building2,
  UserRound,
  ShieldCheck,
  KeyRound,
  Lock,
  Save,
  Loader2,
  Mail,
  Phone,
  BadgeCheck,
  Eye,
  EyeOff,
  Receipt,
  CalendarClock,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  LogOut,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/common/SectionCard";
import Tabs from "@/components/common/Tabs";
import { Avatar } from "@/components/common/SmartImage";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import NetworkError from "@/components/feedback/NetworkError";

import Form from "@/components/forms/Form";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";

import { useAuth } from "@/hooks/useAuth";
import { useListParams } from "@/hooks/useListParams";

import { baseApi, errorMessage } from "@/redux/api/baseApi";

import {
  useGetMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useUpdateEmailMutation,
  useLogoutAllDevicesMutation,
} from "@/redux/api/authApi";

import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useResetSettingsMutation,
} from "@/redux/api/settingApi";

import {
  useGetMyBusinessQuery,
  useUpdateMyBusinessMutation,
} from "@/redux/api/businessApi";

import { logout } from "@/redux/slices/authSlice";

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const TAB_TITLES = {
  profile: "My Profile",
  password: "Account Security",
  email: "Change Email",
  sessions: "Sessions",
  business: "Business Information",
  receipt: "Receipt & Billing Rules",
  display: "Date & Time Preferences",
};

const RECEIPT_FIELDS = [
  "invoicePrefix",
  "bookingPrefix",
  "paymentPrefix",
  "customerPrefix",
  "receiptHeader",
  "receiptFooter",
  "receiptPaperSize",
];

const DISPLAY_FIELDS = [
  "dateFormat",
  "timezone",
  "defaultCurrency",
  "reminderDaysBefore",
];

const PREFIX_FIELDS = [
  "invoicePrefix",
  "bookingPrefix",
  "paymentPrefix",
  "customerPrefix",
];

const SETTINGS_DEFAULTS = {
  invoicePrefix: "INV",
  bookingPrefix: "BK",
  paymentPrefix: "PAY",
  customerPrefix: "CUS",
  receiptHeader: "",
  receiptFooter: "Thank you for choosing us",
  receiptPaperSize: "a4",
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Karachi",
  defaultCurrency: "PKR",
  reminderDaysBefore: 7,
};

const PAPER_SIZES = [
  { value: "a4", label: "A4" },
  { value: "a5", label: "A5" },
  { value: "80mm", label: "Thermal 80 mm" },
  { value: "58mm", label: "Thermal 58 mm" },
];

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "27/05/2025" },
  { value: "MM/DD/YYYY", label: "05/27/2025" },
  { value: "YYYY-MM-DD", label: "2025-05-27" },
];

const TIMEZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kolkata",
  "Europe/London",
  "UTC",
];

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function unwrapData(response) {
  return response?.data ?? response ?? {};
}

function getRoleLabel(role) {
  if (role === "super-admin") return "Super Admin";
  if (role === "admin") return "Business Owner";
  return "Employee";
}

function selectFields(values, keys) {
  return Object.fromEntries(
    keys
      .filter((key) => values[key] !== undefined)
      .map((key) => [key, values[key]])
  );
}

function getPasswordError(value) {
  if (value.length < 8) {
    return "Password must contain at least 8 characters.";
  }
  if (value.length > 128) {
    return "Password cannot exceed 128 characters.";
  }
  if (!/[A-Z]/.test(value)) {
    return "Include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(value)) {
    return "Include at least one lowercase letter.";
  }
  if (!/[0-9]/.test(value)) {
    return "Include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Include at least one special character.";
  }
  return "";
}

function SaveButton({ loading, label = "Save Changes", disabled = false }) {
  return (
    <button type="submit" disabled={loading || disabled} className="btn btn-primary">
      {loading ? (
        <Loader2 size={17} className="animate-spin" />
      ) : (
        <Save size={17} />
      )}
      {loading ? "Saving..." : label}
    </button>
  );
}

function InformationRow({ label, value, icon: Icon }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 py-3 text-sm last:border-0">
      <span className="flex items-center gap-2 text-muted">
        {Icon && <Icon size={16} />}
        {label}
      </span>
      <span className="max-w-full break-words font-semibold text-heading">
        {value || "—"}
      </span>
    </div>
  );
}

function AdminNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
      <Lock size={18} className="mt-0.5 shrink-0" />
      <p className="text-sm">
        Only the business administrator can change these settings.
      </p>
    </div>
  );
}

// --------------------------------------------------
// PROFILE TAB
// --------------------------------------------------

function ProfileTab({ sessionUser }) {
  const { data, isLoading, error, refetch } = useGetMeQuery();
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();

  const profile = unwrapData(data);
  const user =
    profile?.user ?? (profile?.name ? profile : sessionUser) ?? {};

  const form = useForm({
    defaultValues: { name: "", phone: "" },
    mode: "onTouched",
  });

  const { reset, setError, formState: { isDirty } } = form;

  useEffect(() => {
    reset({
      name: user.name || "",
      phone: user.phone || "",
    });
  }, [user.name, user.phone, reset]);

  const onSubmit = async (values) => {
    const name = values.name?.trim() || "";
    const phone = values.phone?.trim() || "";

    if (name.length < 2 || name.length > 100) {
      setError("name", {
        type: "manual",
        message: "Name must contain 2 to 100 characters.",
      });
      toast.error("Please enter a valid name.");
      return;
    }

    if (!phone) {
      setError("phone", {
        type: "manual",
        message: "Phone number is required.",
      });
      toast.error("Phone number is required.");
      return;
    }

    try {
      await updateProfile({ name, phone }).unwrap();
      toast.success("Profile updated successfully.");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Unable to update your profile."));
    }
  };

  if (isLoading && !sessionUser) {
    return <LoadingSkeleton rows={4} cols={2} />;
  }

  if (error && !sessionUser) {
    return <NetworkError error={error} onRetry={refetch} />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-soft p-5">
        <Avatar src={user.photo} name={user.name || "User"} size={80} />

        <div className="min-w-0 flex-1">
          <h3 className="break-words text-xl font-extrabold text-heading">
            {user.name || "My Account"}
          </h3>
          <p className="mt-1 break-all text-sm text-muted">
            {user.email || "No email available"}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <BadgeCheck size={14} />
            {getRoleLabel(user.role)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="btn btn-neutral btn-sm"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-line p-5">
        <div className="mb-5 flex items-center gap-3">
          <UserRound size={20} className="text-primary" />
          <div>
            <h3 className="font-bold text-heading">Personal Information</h3>
            <p className="text-xs text-muted">
              Manage your personal account details.
            </p>
          </div>
        </div>

        <Form form={form} onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              name="name"
              label="Full Name"
              required
              autoComplete="name"
              placeholder="Enter your full name"
            />
            <FormInput
              name="phone"
              label="Phone Number"
              required
              type="tel"
              autoComplete="tel"
              placeholder="Enter your phone number"
            />
          </div>

          <div className="rounded-xl border border-line bg-soft p-4">
            <InformationRow label="Email Address" value={user.email} icon={Mail} />
            <InformationRow
              label="Account Role"
              value={getRoleLabel(user.role)}
              icon={ShieldCheck}
            />
            <InformationRow
              label="Account Status"
              value={user.status}
              icon={BadgeCheck}
            />
            {user.lastLoginAt && (
              <InformationRow
                label="Last Login"
                value={new Date(user.lastLoginAt).toLocaleString()}
                icon={CalendarClock}
              />
            )}
          </div>

          <p className="text-xs leading-5 text-muted">
            Your profile photo is stored on your user account. Photo replacement
            requires the backend profile upload endpoint to support multipart files.
          </p>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                reset({
                  name: user.name || "",
                  phone: user.phone || "",
                })
              }
              disabled={!isDirty || isSaving}
              className="btn btn-neutral"
            >
              <RotateCcw size={16} />
              Reset
            </button>
            <SaveButton loading={isSaving} disabled={!isDirty} label="Save Profile" />
          </div>
        </Form>
      </div>
    </div>
  );
}

// --------------------------------------------------
// SECURITY TAB (Change Password)
// --------------------------------------------------

function SecurityTab() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onTouched",
  });

  const { reset, setError, watch } = form;
  const newPassword = watch("newPassword") || "";

  const passwordChecks = [
    { label: "At least 8 characters", passed: newPassword.length >= 8 },
    { label: "Uppercase letter", passed: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter", passed: /[a-z]/.test(newPassword) },
    { label: "Number", passed: /[0-9]/.test(newPassword) },
    { label: "Special character", passed: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const onSubmit = async (values) => {
    if (!values.currentPassword) {
      setError("currentPassword", {
        type: "manual",
        message: "Current password is required.",
      });
      return;
    }

    const passwordError = getPasswordError(values.newPassword || "");
    if (passwordError) {
      setError("newPassword", { type: "manual", message: passwordError });
      toast.error(passwordError);
      return;
    }

    if (values.currentPassword === values.newPassword) {
      setError("newPassword", {
        type: "manual",
        message: "Choose a different password.",
      });
      return;
    }

    if (values.newPassword !== values.confirmPassword) {
      setError("confirmPassword", {
        type: "manual",
        message: "Passwords do not match.",
      });
      toast.error("Passwords do not match.");
      return;
    }

    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();

      reset();
      dispatch(logout());
      dispatch(baseApi.util.resetApiState());

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("rac_auth");
      }

      toast.success("Password updated. Please sign in again.");
      router.replace("/login");
    } catch (err) {
      toast.error(errorMessage(err, "Unable to change your password."));
    }
  };

  const PasswordInput = ({ name, label, visible, toggle, autoComplete }) => (
    <div className="relative">
      <FormInput
        name={name}
        label={label}
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        inputClassName="pr-12"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        className="absolute bottom-2 right-3 rounded-md p-2 text-muted hover:text-heading"
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <ShieldCheck size={21} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <h3 className="font-semibold text-heading">Keep your account secure</h3>
          <p className="mt-1 text-sm text-muted">
            Use a strong password that you do not use for other accounts.
            Changing your password will log you out of all devices.
          </p>
        </div>
      </div>

      <Form form={form} onSubmit={onSubmit} className="space-y-5">
        <PasswordInput
          name="currentPassword"
          label="Current Password"
          visible={showCurrent}
          toggle={() => setShowCurrent((v) => !v)}
          autoComplete="current-password"
        />
        <PasswordInput
          name="newPassword"
          label="New Password"
          visible={showNew}
          toggle={() => setShowNew((v) => !v)}
          autoComplete="new-password"
        />
        <PasswordInput
          name="confirmPassword"
          label="Confirm New Password"
          visible={showConfirm}
          toggle={() => setShowConfirm((v) => !v)}
          autoComplete="new-password"
        />

        <div className="rounded-xl border border-line bg-soft p-4">
          <h4 className="mb-3 text-sm font-bold text-heading">
            Password Requirements
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {passwordChecks.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <BadgeCheck
                  size={15}
                  className={item.passed ? "text-emerald-600" : "text-muted"}
                />
                <span className={item.passed ? "text-heading" : "text-muted"}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="flex items-start gap-2 text-xs text-muted">
          <AlertCircle size={15} className="shrink-0" />
          Changing your password invalidates your current session. You will need
          to log in again.
        </p>

        <div className="flex justify-end">
          <SaveButton loading={isLoading} label="Change Password" />
        </div>
      </Form>
    </div>
  );
}

// --------------------------------------------------
// EMAIL TAB (Update login email)
// --------------------------------------------------

function EmailTab({ sessionUser }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const [updateEmail, { isLoading }] = useUpdateEmailMutation();

  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      newEmail: "",
      currentPassword: "",
    },
    mode: "onTouched",
  });

  const { setError } = form;

  const onSubmit = async (values) => {
    const newEmail = String(values.newEmail || "").trim().toLowerCase();
    const currentPassword = values.currentPassword || "";

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError("newEmail", {
        type: "manual",
        message: "Please enter a valid email address.",
      });
      return;
    }

    if (!currentPassword) {
      setError("currentPassword", {
        type: "manual",
        message: "Current password is required.",
      });
      return;
    }

    if (
      sessionUser?.email &&
      newEmail === String(sessionUser.email).toLowerCase()
    ) {
      setError("newEmail", {
        type: "manual",
        message: "This is already your current email.",
      });
      return;
    }

    try {
      await updateEmail({ newEmail, currentPassword }).unwrap();

      dispatch(logout());
      dispatch(baseApi.util.resetApiState());

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("rac_auth");
      }

      toast.success(
        "Email updated. Please log in again and verify your new email."
      );
      router.replace("/login");
    } catch (err) {
      toast.error(errorMessage(err, "Unable to update email."));
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
        <Mail size={21} className="mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-heading">Change login email</h3>
          <p className="mt-1 text-sm text-muted">
            Your current email is{" "}
            <strong className="text-heading">
              {sessionUser?.email || "—"}
            </strong>
            . After changing it you must log in again. The new email will need
            verification.
          </p>
        </div>
      </div>

      <Form form={form} onSubmit={onSubmit} className="space-y-5">
        <FormInput
          name="newEmail"
          label="New Email Address"
          type="email"
          required
          autoComplete="email"
          placeholder="new@example.com"
        />

        <div className="relative">
          <FormInput
            name="currentPassword"
            label="Current Password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            inputClassName="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute bottom-2 right-3 rounded-md p-2 text-muted hover:text-heading"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <p className="flex items-start gap-2 text-xs text-muted">
          <AlertCircle size={15} className="shrink-0" />
          Updating your email ends all active sessions for security.
        </p>

        <div className="flex justify-end">
          <SaveButton loading={isLoading} label="Update Email" />
        </div>
      </Form>
    </div>
  );
}

// --------------------------------------------------
// SESSIONS TAB
// --------------------------------------------------

function SessionsTab() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [logoutAll, { isLoading }] = useLogoutAllDevicesMutation();

  const handleLogoutAll = async () => {
    const confirmed = window.confirm(
      "Log out from all devices? You will need to sign in again on every device."
    );
    if (!confirmed) return;

    try {
      await logoutAll().unwrap();
      dispatch(logout());
      dispatch(baseApi.util.resetApiState());

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("rac_auth");
      }

      toast.success("Logged out from all devices.");
      router.replace("/login");
    } catch (err) {
      toast.error(errorMessage(err, "Unable to log out from all devices."));
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-soft p-4">
        <KeyRound size={21} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <h3 className="font-semibold text-heading">Active sessions</h3>
          <p className="mt-1 text-sm text-muted">
            End every active login (this browser and all other devices). You will
            need to sign in again.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line p-5">
        <p className="mb-4 text-sm text-muted">
          Use this if you suspect unauthorized access or want to force a fresh
          login everywhere.
        </p>

        <button
          type="button"
          onClick={handleLogoutAll}
          disabled={isLoading}
          className="btn btn-danger"
        >
          {isLoading ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <LogOut size={17} />
          )}
          {isLoading ? "Logging out…" : "Log out of all devices"}
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------
// BUSINESS TAB (Admin only)
// --------------------------------------------------

function BusinessTab({ canEdit }) {
  const { data, isLoading, error, refetch } = useGetMyBusinessQuery();
  const [updateBusiness, { isLoading: isSaving }] =
    useUpdateMyBusinessMutation();

  const businessResponse = unwrapData(data);
  const business = businessResponse?.business ?? businessResponse;

  const form = useForm({
    defaultValues: { businessName: "" },
    mode: "onTouched",
  });

  const { reset, setError, formState: { isDirty } } = form;

  useEffect(() => {
    reset({ businessName: business?.businessName || "" });
  }, [business?.businessName, reset]);

  const onSubmit = async (values) => {
    if (!canEdit) return;

    const businessName = values.businessName?.trim() || "";

    if (businessName.length < 2 || businessName.length > 150) {
      setError("businessName", {
        type: "manual",
        message: "Business name must be between 2 and 150 characters.",
      });
      toast.error("Invalid business name.");
      return;
    }

    try {
      await updateBusiness({ businessName }).unwrap();
      toast.success("Business name updated successfully.");
      refetch();
    } catch (err) {
      toast.error(
        errorMessage(err, "Unable to update business information.")
      );
    }
  };

  if (isLoading) return <LoadingSkeleton rows={3} cols={2} />;
  if (error) return <NetworkError error={error} onRetry={refetch} />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-soft p-4">
        <Building2 size={21} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <h3 className="font-bold text-heading">Rental Business</h3>
          <p className="mt-1 text-sm text-muted">
            Your business record contains the business name and
            platform-controlled status.
          </p>
        </div>
      </div>

      {!canEdit && <AdminNotice />}

      <Form form={form} onSubmit={onSubmit} className="space-y-5">
        <fieldset disabled={!canEdit || isSaving} className="space-y-5">
          <FormInput
            name="businessName"
            label="Business Name"
            required
            placeholder="e.g. City Rent A Car"
            autoComplete="organization"
          />

          <div className="rounded-xl border border-line p-4">
            <InformationRow
              label="Business Status"
              value={business?.status}
              icon={BadgeCheck}
            />
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <SaveButton
                loading={isSaving}
                disabled={!isDirty}
                label="Save Business Name"
              />
            </div>
          )}
        </fieldset>
      </Form>
    </div>
  );
}

// --------------------------------------------------
// RECEIPT & DISPLAY SETTINGS (Admin only)
// --------------------------------------------------

function PendingField({ label, hint, children }) {
  return (
    <div>
      <label className="label">
        {label}
        <span className="ml-2 badge badge-warning">Backend pending</span>
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function PreferencesTab({ tab, canEdit }) {
  const { data, isLoading, error, refetch } = useGetSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] =
    useUpdateSettingsMutation();
  const [resetSettings, { isLoading: isResetting }] =
    useResetSettingsMutation();

  const settingsResponse = unwrapData(data);
  const settings = settingsResponse?.settings ?? settingsResponse;

  const form = useForm({
    defaultValues: SETTINGS_DEFAULTS,
    mode: "onTouched",
  });

  const { reset, setError, watch, formState: { isDirty } } = form;

  useEffect(() => {
    reset({ ...SETTINGS_DEFAULTS, ...settings });
  }, [data, reset]);

  const values = watch();

  const fields = useMemo(
    () => (tab === "receipt" ? RECEIPT_FIELDS : DISPLAY_FIELDS),
    [tab]
  );

  const fail = (name, message) => {
    setError(name, { type: "manual", message });
    toast.error(message);
  };

  const onSubmit = async (formValues) => {
    if (!canEdit) return;

    const payload = selectFields(formValues, fields);

    if (tab === "receipt") {
      for (const key of PREFIX_FIELDS) {
        const value = String(payload[key] ?? "").trim().toUpperCase();
        if (value.length < 1 || value.length > 10) {
          fail(key, "Prefix must be 1 to 10 characters.");
          return;
        }
        payload[key] = value;
      }

      for (const key of ["receiptHeader", "receiptFooter"]) {
        payload[key] = String(payload[key] ?? "").trim();
        if (payload[key].length > 1000) {
          fail(key, "Maximum 1000 characters.");
          return;
        }
      }
    } else {
      payload.defaultCurrency = String(payload.defaultCurrency ?? "")
        .trim()
        .toUpperCase();

      if (
        payload.defaultCurrency.length < 3 ||
        payload.defaultCurrency.length > 10
      ) {
        fail(
          "defaultCurrency",
          "Currency must be 3 to 10 characters, e.g. PKR."
        );
        return;
      }

      const days = Number(payload.reminderDaysBefore);
      if (!Number.isInteger(days) || days < 0 || days > 365) {
        fail(
          "reminderDaysBefore",
          "Reminder days must be a whole number from 0 to 365."
        );
        return;
      }
      payload.reminderDaysBefore = days;
    }

    try {
      await updateSettings(payload).unwrap();
      toast.success("Settings updated successfully.");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Unable to save settings."));
    }
  };

  const handleReset = async () => {
    if (!canEdit) return;

    const confirmed = window.confirm(
      "Reset ALL application settings to defaults? Prefixes, receipt text and display preferences will go back to their original values."
    );
    if (!confirmed) return;

    try {
      await resetSettings().unwrap();
      toast.success("Settings reset successfully.");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err, "Unable to reset settings."));
    }
  };

  if (isLoading) return <LoadingSkeleton rows={4} cols={2} />;
  if (error) return <NetworkError error={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {!canEdit && <AdminNotice />}

      <Form form={form} onSubmit={onSubmit} className="space-y-6">
        <fieldset
          disabled={!canEdit || isSaving || isResetting}
          className="space-y-6"
        >
          {tab === "receipt" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Receipt size={20} className="text-primary" />
                  <div>
                    <h3 className="font-bold text-heading">
                      Numbering & Receipt Text
                    </h3>
                    <p className="text-xs text-muted">
                      Prefixes are saved in capital letters (maximum 10
                      characters).
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormInput name="bookingPrefix" label="Booking Prefix" placeholder="BK" />
                  <FormInput name="invoicePrefix" label="Invoice Prefix" placeholder="INV" />
                  <FormInput name="paymentPrefix" label="Payment / Receipt Prefix" placeholder="PAY" />
                  <FormInput name="customerPrefix" label="Customer Prefix" placeholder="CUS" />
                </div>

                <FormSelect
                  name="receiptPaperSize"
                  label="Receipt Paper Size"
                  placeholder={null}
                  options={PAPER_SIZES}
                />

                <FormInput
                  name="receiptHeader"
                  as="textarea"
                  label="Receipt Header"
                  placeholder="Business name, address, phone…"
                />
                <FormInput
                  name="receiptFooter"
                  as="textarea"
                  label="Receipt Footer Message"
                  placeholder="Thank you for choosing us"
                />

                <div className="space-y-4 rounded-xl border border-dashed border-line p-4">
                  <p className="text-xs text-muted">
                    These billing rules exist on screen but the backend has
                    nowhere to save them yet, so they are disabled.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <PendingField label="Free KM / Day">
                      <input className="input" type="number" disabled placeholder="0" />
                    </PendingField>
                    <PendingField label="Extra KM Rate">
                      <input className="input" type="number" disabled placeholder="0" />
                    </PendingField>
                    <PendingField label="Grace Hours">
                      <input className="input" type="number" disabled placeholder="0" />
                    </PendingField>
                  </div>
                </div>
              </div>

              <div className="h-fit rounded-2xl border border-line bg-soft p-5">
                <h3 className="mb-4 text-sm font-bold text-heading">
                  Receipt Preview
                </h3>
                <div className="rounded-xl border border-line bg-white p-5 text-center shadow-sm">
                  {values.receiptHeader && (
                    <p className="mb-3 whitespace-pre-line text-xs text-muted">
                      {values.receiptHeader}
                    </p>
                  )}
                  <h4 className="text-base font-extrabold text-heading">
                    PAYMENT RECEIPT
                  </h4>
                  <p className="mt-2 text-xs text-muted">
                    {(values.paymentPrefix || "PAY").toUpperCase() + "-0001"}
                  </p>
                  <div className="my-5 border-t border-dashed border-line" />
                  <div className="space-y-2 text-left text-sm">
                    <div className="flex justify-between">
                      <span>Payment</span>
                      <strong>Rs. 10,000</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Method</span>
                      <strong>Cash</strong>
                    </div>
                  </div>
                  <div className="my-5 border-t border-dashed border-line" />
                  <p className="whitespace-pre-line text-xs text-muted">
                    {values.receiptFooter || "Thank you for choosing us"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl space-y-5">
              <div className="flex items-center gap-3">
                <CalendarClock size={20} className="text-primary" />
                <div>
                  <h3 className="font-bold text-heading">
                    Date, Time & Reminders
                  </h3>
                  <p className="text-xs text-muted">
                    Choose how dates appear and how early reminders start.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelect
                  name="dateFormat"
                  label="Date Format"
                  placeholder={null}
                  options={DATE_FORMATS}
                />
                <FormSelect
                  name="timezone"
                  label="Time Zone"
                  placeholder={null}
                  options={TIMEZONES}
                />
                <FormInput
                  name="defaultCurrency"
                  label="Currency Code"
                  placeholder="PKR"
                />
                <FormInput
                  name="reminderDaysBefore"
                  label="Remind Me Days Before"
                  type="number"
                  min="0"
                  max="365"
                />
              </div>
            </div>
          )}
        </fieldset>

        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={handleReset}
              disabled={isResetting || isSaving}
              className="btn btn-neutral"
            >
              {isResetting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RotateCcw size={16} />
              )}
              Reset All Settings
            </button>
            <SaveButton
              loading={isSaving}
              disabled={!isDirty || isResetting}
              label="Save Preferences"
            />
          </div>
        )}
      </Form>
    </div>
  );
}

// --------------------------------------------------
// MAIN SETTINGS PAGE
// --------------------------------------------------

export default function SettingsPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  const { params, setParams } = useListParams({
    tab: "profile",
  });

  const requestedTab = params.tab;

  // Super Admin tabs
  const superAdminTabs = [
    { value: "profile", label: "My Profile" },
    { value: "password", label: "Security" },
    { value: "email", label: "Change Email" },
    { value: "sessions", label: "Sessions" },
  ];

  // Admin / Employee tabs
  const tenantTabs = [
    { value: "profile", label: "My Profile" },
    { value: "password", label: "Security" },
    { value: "email", label: "Change Email" },
    { value: "sessions", label: "Sessions" },
    { value: "business", label: "Business" },
    { value: "receipt", label: "Receipt & Bill" },
    { value: "display", label: "Date & Time" },
  ];

  const canEditBusiness = Boolean(isAdmin || user?.role === "admin");

  const availableTabs = isSuperAdmin
    ? superAdminTabs
    : tenantTabs.filter(
        (item) =>
          canEditBusiness ||
          !["business", "receipt", "display"].includes(item.value)
      );

  const tab = Object.prototype.hasOwnProperty.call(TAB_TITLES, requestedTab)
    ? requestedTab
    : "profile";

  const activeTab = availableTabs.some((item) => item.value === tab)
    ? tab
    : "profile";

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={
          isSuperAdmin
            ? "Manage your Super Admin profile, security and sessions."
            : "Manage your profile, security, business and application preferences."
        }
      />

      <PageContainer>
        <div className="space-y-5">
          <div className="card px-3 pt-2">
            <Tabs
              value={activeTab}
              onChange={(value) => setParams({ tab: value })}
              tabs={availableTabs}
            />
          </div>

          <SectionCard title={TAB_TITLES[activeTab]}>
            {activeTab === "profile" && <ProfileTab sessionUser={user} />}
            {activeTab === "password" && <SecurityTab />}
            {activeTab === "email" && <EmailTab sessionUser={user} />}
            {activeTab === "sessions" && <SessionsTab />}

            {activeTab === "business" && (
              <BusinessTab canEdit={canEditBusiness} />
            )}

            {["receipt", "display"].includes(activeTab) && (
              <PreferencesTab
                key={activeTab}
                tab={activeTab}
                canEdit={canEditBusiness}
              />
            )}
          </SectionCard>
        </div>
      </PageContainer>
    </>
  );
}