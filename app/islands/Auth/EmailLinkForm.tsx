import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useAuthForm } from "../../shared/hooks/useAuthForm.ts";
import { FormInput } from "../../shared/components/forms/FormInput.tsx";
import { FormButton } from "../../shared/components/forms/FormButton.tsx";
import { ErrorMessage } from "../../shared/components/forms/ErrorMessage.tsx";

interface EmailLinkFormProps {
  // No props needed anymore as it's self-contained
}

export default function EmailLinkForm({}: EmailLinkFormProps) {
  const email = useSignal("");
  const { error, isLoading, makeApiCall, validateEmailField } = useAuthForm();

  const handleFormSubmit = async (e: h.JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateEmailField(email.value)) return;

    await makeApiCall("/api/auth/login-or-signup", 
      { email: email.value },
      {
        onSuccess: (data) => {
          console.log('API call successful, response:', data);
          if (data?.redirectUrl) {
            console.log('Redirecting to:', data.redirectUrl);
            globalThis.location.href = data.redirectUrl;
          } else {
            console.error('No redirectUrl in response:', data);
          }
        },
        onError: (error) => {
          console.error('API call failed:', error);
        }
      }
    );
  };

  return (
    <section role="form" class="animate-fadein">
      <form onSubmit={handleFormSubmit} class="space-y-4" autoComplete="on">
        <div>
          <label htmlFor="email" class="block text-sm font-medium text-gray-300 transition-all duration-200">
            Email Address
          </label>
          <FormInput
            type="email"
            id="email"
            name="email"
            value={email.value}
            onInput={(e) => (email.value = e.currentTarget.value)}
            placeholder="you@example.com"
            disabled={isLoading.value}
            required
          />
        </div>
        <ErrorMessage message={error.value} />
        <FormButton
          type="submit"
          disabled={isLoading.value}
          isLoading={isLoading.value}
          loadingText="Checking..."
        >
          Continue
        </FormButton>
      </form>
      <style>
        {`
          @keyframes fadein {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fadein {
            animation: fadein 0.5s cubic-bezier(.4,2,.6,1);
          }
        `}
      </style>
    </section>
  );
}