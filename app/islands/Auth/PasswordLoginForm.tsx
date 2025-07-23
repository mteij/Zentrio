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
        onSuccess: (data) => {
          if (data.redirectUrl) {
            globalThis.location.href = data.redirectUrl;
          }
        }
      }
    );
  };

  return (
    <form onSubmit={handlePasswordLogin} class="space-y-4">
      <ErrorMessage message={error.value} />
      <FormInput
        type="email"
        name="email"
        placeholder="Email"
        value={email}
        disabled
        required
      />
      <FormInput
        type="password"
        name="password"
        placeholder="Password"
        value={password.value}
        onInput={(e) => password.value = e.currentTarget.value}
        disabled={isLoading.value}
        required
      />
      <FormButton
        type="submit"
        disabled={isLoading.value}
        isLoading={isLoading.value}
        loadingText="Signing In..."
      >
        Sign In
      </FormButton>
      <div class="text-center text-sm">
        <button
          type="button"
          onClick={handleSendCode}
          disabled={isLoading.value}
          class="text-red-500 hover:underline disabled:text-gray-400"
        >
          Email me a login code
        </button>
      </div>
    </form>
  );
}
