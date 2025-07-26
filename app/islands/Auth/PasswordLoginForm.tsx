import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useAuthForm } from "../../shared/hooks/useAuthForm.ts";
import { FormInput } from "../../shared/components/forms/FormInput.tsx";
import { FormButton } from "../../shared/components/forms/FormButton.tsx";
import { ErrorMessage } from "../../shared/components/forms/ErrorMessage.tsx";

interface PasswordLoginFormProps {
  email: string;
}

/**
 * Password login form component that handles both password authentication
 * and fallback to email code authentication
 */
export default function PasswordLoginForm({ email }: PasswordLoginFormProps) {
  const password = useSignal("");
  const successMessage = useSignal("");
  const { error, isLoading, makeApiCall } = useAuthForm();

  const handlePasswordLogin = async (e: h.JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();

    await makeApiCall("/api/auth/login-with-password", 
      { email, password: password.value },
      {
        onSuccess: () => {
          globalThis.location.href = "/profiles";
        }
      }
    );
  };

  const handleSendCode = async () => {
    await makeApiCall("/api/auth/send-login-code", 
      { email },
      {
        onSuccess: (data: { redirectUrl?: string; data?: { redirectUrl?: string } }) => {
          console.log('Send login code success:', data);
          // Handle both response structures: { redirectUrl } or { data: { redirectUrl } }
          const redirectUrl = data.redirectUrl || data.data?.redirectUrl;
          
          if (redirectUrl) {
            successMessage.value = `Login code sent to ${email}. Check your email!`;
            setTimeout(() => {
              console.log('Redirecting to:', redirectUrl);
              globalThis.location.href = redirectUrl;
            }, 2000);
          } else {
            console.error('No redirectUrl in response:', data);
            // Fallback - redirect manually
            const fallbackUrl = `/auth/code?email=${encodeURIComponent(email)}`;
            successMessage.value = `Login code sent to ${email}. Check your email!`;
            setTimeout(() => {
              console.log('Using fallback redirect to:', fallbackUrl);
              globalThis.location.href = fallbackUrl;
            }, 2000);
          }
        },
        onError: (error) => {
          console.error('Send login code error:', error);
        }
      }
    );
  };

  return (
    <div class="space-y-4">
      {/* Back button */}
      <div class="mb-4">
        <a
          href="/login"
          class="inline-flex items-center text-gray-400 hover:text-white transition-colors text-sm"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </a>
      </div>

      <form onSubmit={handlePasswordLogin} class="space-y-4">
        <ErrorMessage message={error.value} />
        
        {/* Success message for login code */}
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

        {/* Email field - darker and non-editable */}
        <div>
          <label htmlFor="email" class="block text-sm font-medium text-gray-300 mb-2">
            Email Address
          </label>
          <input
            type="email"
            name="email"
            id="email"
            value={email}
            disabled
            class="w-full bg-gray-800 text-gray-300 px-3 py-2 rounded focus:outline-none cursor-not-allowed border border-gray-600"
          />
        </div>

        <FormInput
          type="password"
          name="password"
          placeholder="Password"
          value={password.value}
          onInput={(e) => password.value = (e.target as HTMLInputElement).value}
          disabled={isLoading.value || !!successMessage.value}
          required
        />

        <FormButton
          type="submit"
          disabled={isLoading.value || !!successMessage.value}
          isLoading={isLoading.value}
          loadingText="Signing In..."
        >
          Sign In
        </FormButton>

        {/* Email login code as a proper gray button */}
        <FormButton
          type="button"
          onClick={handleSendCode}
          disabled={isLoading.value || !!successMessage.value}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500"
        >
          Email me a login code
        </FormButton>

        <div class="text-center text-sm">
          <a
            href={`/auth/forgot?email=${encodeURIComponent(email)}`}
            class="text-red-500 hover:underline"
          >
            Forgot your password?
          </a>
        </div>
      </form>
    </div>
  );
}
