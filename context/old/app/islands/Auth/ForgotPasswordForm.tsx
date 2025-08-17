import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useAuthForm } from "../../shared/hooks/useAuthForm.ts";
import { useToast } from "../../shared/hooks/useToast.ts";
import { FormInput } from "../../shared/components/forms/FormInput.tsx";
import { FormButton } from "../../shared/components/forms/FormButton.tsx";
import { ErrorMessage } from "../../shared/components/forms/ErrorMessage.tsx";

interface ForgotPasswordFormProps {
  initialEmail?: string;
}

export default function ForgotPasswordForm({ initialEmail = "" }: ForgotPasswordFormProps) {
  const email = useSignal(initialEmail);
  const { success } = useToast();
  const { error, isLoading, makeApiCall, validateEmailField } = useAuthForm();

  const handleFormSubmit = async (e: h.JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateEmailField(email.value)) return;

    await makeApiCall("/api/auth/request-password-reset", 
      { email: email.value },
      {
        onSuccess: (data: { message?: string }) => {
          success(data.message || "If a user with that email exists, a reset link has been sent.");
        }
      }
    );
  };

  return (
    <form onSubmit={handleFormSubmit} class="space-y-4">
      <FormInput
        type="email"
        name="email"
        placeholder="you@example.com"
        value={email.value}
        onInput={(e) => email.value = (e.target as HTMLInputElement).value}
        disabled={isLoading.value}
        required
      />
      <ErrorMessage message={error.value} />
      <FormButton
        type="submit"
        disabled={isLoading.value}
        isLoading={isLoading.value}
        loadingText="Sending..."
      >
        Send Reset Link
      </FormButton>
      <div class="text-center">
        <a 
          href="/auth/login" 
          class="text-gray-400 hover:text-white text-sm"
        >
          Back to login
        </a>
      </div>
    </form>
  );
}