import { formStyles } from "../../constants/styles.ts";

interface FormInputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onInput?: (e: Event) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
  maxLength?: number;
  pattern?: string;
}

export function FormInput(props: FormInputProps) {
  const {
    type = "text",
    className = "",
    ...inputProps
  } = props;

  return (
    <input
      type={type}
      class={`${formStyles.input} ${className}`}
      {...inputProps}
    />
  );
}