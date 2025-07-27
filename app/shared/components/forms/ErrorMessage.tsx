import { formStyles } from "../../constants/styles.ts";

interface ErrorMessageProps {
  message: string | null;
  className?: string;
}

export function ErrorMessage({ message, className = "" }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <p class={`${formStyles.error} ${className}`}>
      {message}
    </p>
  );
}