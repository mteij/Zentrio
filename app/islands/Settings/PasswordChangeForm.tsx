import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useAuthForm } from "../../shared/hooks/useAuthForm.ts";
import { FormInput } from "../../shared/components/forms/FormInput.tsx";
import { FormButton } from "../../shared/components/forms/FormButton.tsx";
import { ErrorMessage } from "../../shared/components/forms/ErrorMessage.tsx";

export default function PasswordChangeForm() {
  const currentPassword = useSignal("");
  const newPassword = useSignal("");
  const confirmPassword = useSignal("");
  const successMessage = useSignal("");
  const { error, isLoading, makeApiCall } = useAuthForm();

  const handleSubmit = async (e: h.JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    successMessage.value = "";

    // Validation
    if (!currentPassword.value) {
      error.value = "Current password is required";
      return;
    }

    if (newPassword.value.length < 8) {
      error.value = "New password must be at least 8 characters long";
      return;
    }

    if (newPassword.value !== confirmPassword.value) {
      error.value = "New passwords do not match";
      return;
    }

    await makeApiCall("/api/auth/change-password", 
      { 
        currentPassword: currentPassword.value,
        newPassword: newPassword.value 
      },
      {
        onSuccess: () => {
          successMessage.value = "Password changed successfully!";
          // Clear form
          currentPassword.value = "";
          newPassword.value = "";
          confirmPassword.value = "";
        },
        onError: (_errorMessage) => {
          // Error is handled by the hook
        }
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-4 max-w-md">
      <div>
        <label htmlFor="currentPassword" class="block text-sm font-medium text-gray-300 mb-1">
          Current Password
        </label>
        <FormInput
          type="password"
          id="currentPassword"
          name="currentPassword"
          value={currentPassword.value}
          onInput={(e) => (currentPassword.value = (e.target as HTMLInputElement).value)}
          placeholder="Enter your current password"
          disabled={isLoading.value}
          required
        />
      </div>

      <div>
        <label htmlFor="newPassword" class="block text-sm font-medium text-gray-300 mb-1">
          New Password
        </label>
        <FormInput
          type="password"
          id="newPassword"
          name="newPassword"
          value={newPassword.value}
          onInput={(e) => (newPassword.value = (e.target as HTMLInputElement).value)}
          placeholder="Enter your new password"
          disabled={isLoading.value}
          required
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" class="block text-sm font-medium text-gray-300 mb-1">
          Confirm New Password
        </label>
        <FormInput
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          value={confirmPassword.value}
          onInput={(e) => (confirmPassword.value = (e.target as HTMLInputElement).value)}
          placeholder="Confirm your new password"
          disabled={isLoading.value}
          required
        />
      </div>

      <ErrorMessage message={error.value} />
      
      {successMessage.value && (
        <div class="p-3 bg-green-900 bg-opacity-50 border border-green-500 rounded-lg">
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
        disabled={isLoading.value}
        isLoading={isLoading.value}
        loadingText="Changing..."
      >
        Change Password
      </FormButton>
    </form>
  );
}