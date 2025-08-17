import { useSignal } from "@preact/signals";
import { validateEmail } from "../utils/api.ts";

export interface AuthFormState {
  error: string | null;
  isLoading: boolean;
  message: string | null;
}

export function useAuthForm() {
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);
  const message = useSignal<string | null>(null);

  const clearMessages = () => {
    error.value = null;
    message.value = null;
  };

  const setError = (errorMessage: string) => {
    error.value = errorMessage;
    isLoading.value = false;
  };

  const setMessage = (successMessage: string) => {
    message.value = successMessage;
    error.value = null;
    isLoading.value = false;
  };

  const setLoading = (loading: boolean) => {
    isLoading.value = loading;
    if (loading) clearMessages();
  };

  const makeApiCall = async <T>(
    url: string,
    data: Record<string, unknown>,
    options: {
      method?: string;
      onSuccess?: (response: T) => void;
      onError?: (error: string) => void;
    } = {}
  ) => {
    const { method = "POST", onSuccess, onError } = options;
    
    setLoading(true);
    
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage: string;
        
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorData.message || "Request failed";
        } catch {
          errorMessage = text || "Request failed";
        }
        
        if (onError) {
          onError(errorMessage);
        } else {
          setError(errorMessage);
        }
        return null;
      }

      const result = await response.json();
      setLoading(false);
      if (onSuccess) {
        onSuccess(result);
      }
      return result;
    } catch (_err) {
      const errorMessage = "Network error occurred";
      if (onError) {
        onError(errorMessage);
      } else {
        setError(errorMessage);
      }
      return null;
    }
  };

  const validateEmailField = (email: string): boolean => {
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  return {
    error,
    isLoading,
    message,
    clearMessages,
    setError,
    setMessage,
    setLoading,
    makeApiCall,
    validateEmailField
  };
}