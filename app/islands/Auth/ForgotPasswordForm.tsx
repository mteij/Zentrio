import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useAuthForm } from "../../shared/hooks/useAuthForm.ts";
import { FormInput } from "../../shared/components/forms/FormInput.tsx";
import { FormButton } from "../../shared/components/forms/FormButton.tsx";
import { ErrorMessage } from "../../shared/components/forms/ErrorMessage.tsx";

interface ForgotPasswordFormProps {
  initialEmail?: string;
}

export default function ForgotPasswordForm({ initialEmail = "" }: ForgotPasswordFormProps) {
  const email = useSignal(initialEmail);
  const successMessage = useSignal("");
  const { error, isLoading, makeApiCall, validateEmailField } = useAuthForm();

  const handleFormSubmit = async (e: h.JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateEmailField(email.value)) return;

    await makeApiCall("/api/auth/request-password-reset", 
      { email: email.value },
      {
        onSuccess: (data) => {
          successMessage.value = data.message || "If a user with that email exists, a reset link has been sent.";
        }
      }
    );
  };

  if (successMessage.value) {
    return (
      <div class="space-y-4">
        <div class="p-4 bg-green-900 bg-opacity-50 border border-green-500 rounded-lg">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-200">{successMessage.value}</p>
            </div>
          </div>
        </div>
        <div class="text-center">
          <p class="text-gray-300 text-sm mb-4">
            Check your email for the reset link. It may take a few minutes to arrive.
          </p>
          <a 
            href="/login" 
            class="text-red-500 hover:underline"
          >
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleFormSubmit} class="space-y-4">
      <FormInput
        type="email"
        name="email"
        placeholder="you@example.com"
        value={email.value}
        onInput={(e) => email.value = e.currentTarget.value}
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
          href="/login" 
          class="text-gray-400 hover:text-white text-sm"
        >
          Back to login
        </a>
      </div>
    </form>
  );
}