import { h } from "preact";
import { formStyles } from "../../constants/styles.ts";

interface FormButtonProps {
  children: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: (e: Event) => void;
  className?: string;
  isLoading?: boolean;
  loadingText?: string;
}

export function FormButton(props: FormButtonProps) {
  const {
    children,
    type = "submit",
    disabled = false,
    isLoading = false,
    loadingText = "Loading...",
    className = "",
    ...buttonProps
  } = props;

  return (
    <button
      type={type}
      class={`${formStyles.button} ${className}`}
      disabled={disabled || isLoading}
      {...buttonProps}
    >
      {isLoading ? loadingText : children}
    </button>
  );
}