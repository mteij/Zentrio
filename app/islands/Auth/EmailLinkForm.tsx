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
  const successMessage = useSignal("");
  const { error, isLoading, makeApiCall, validateEmailField } = useAuthForm();

  const handleFormSubmit = async (e: h.JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateEmailField(email.value)) return;

    await makeApiCall("/api/auth/login-or-signup", 
      { email: email.value },
      {
        onSuccess: (data) => {
          console.log('API call successful, full response:', JSON.stringify(data, null, 2));
          console.log('Response keys:', Object.keys(data || {}));
          console.log('data.redirectUrl:', (data as any)?.redirectUrl);
          console.log('data.data?.redirectUrl:', (data as any)?.data?.redirectUrl);
          
          // Try both possible response structures
          const redirectUrl = (data as any)?.redirectUrl || (data as any)?.data?.redirectUrl;
          
          if (redirectUrl) {
            console.log('Found redirectUrl:', redirectUrl);
            
            // Check if it's a signup success (new user)
            if (redirectUrl.includes('signup-success')) {
              successMessage.value = `Account created! We've sent a temporary password to ${email.value}. Please check your email and use it to log in.`;
              console.log('Set success message:', successMessage.value);
              // Delay redirect to show the message
              setTimeout(() => {
                console.log('Redirecting after delay to:', redirectUrl);
                globalThis.location.href = redirectUrl;
              }, 4000);
            } else {
              // Existing user - redirect immediately to password page
              console.log('Existing user, redirecting immediately to:', redirectUrl);
              globalThis.location.href = redirectUrl;
            }
          } else {
            console.error('No redirectUrl found in response. Full response:', data);
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
            onInput={(e) => (email.value = (e.currentTarget as HTMLInputElement)?.value || "")}
            placeholder="you@example.com"
            disabled={isLoading.value}
            required
          />
        </div>
        <ErrorMessage message={error.value} />
        {successMessage.value && (
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
        )}
        <FormButton
          type="submit"
          disabled={isLoading.value || !!successMessage.value}
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