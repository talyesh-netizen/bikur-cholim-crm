import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Change password</h1>
        <p className="text-sm text-muted-foreground">
          Replace the password you were given (or your old one) with one only you know.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
