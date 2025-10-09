interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'range'
  id?: string
  name?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  value?: string
  className?: string
  style?: Record<string, string>
  min?: string
  max?: string
  step?: string
  list?: string
  maxLength?: string
  inputMode?: string
  pattern?: string
  autoComplete?: string
  ariaDescribedBy?: string
}

interface FormGroupProps {
  label?: string
  htmlFor?: string
  children: any
  className?: string
  id?: string
}

export function Input({
  type = 'text',
  id,
  name,
  placeholder,
  required = false,
  disabled = false,
  value,
  className = '',
  style,
  min,
  max,
  step,
  list,
  maxLength,
  inputMode,
  pattern,
  autoComplete,
  ariaDescribedBy
}: InputProps) {
  return (
    <input
      type={type}
      id={id}
      name={name}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      value={value}
      className={className}
      style={style}
      min={min}
      max={max}
      step={step}
      list={list}
      maxLength={maxLength}
      inputMode={inputMode}
      pattern={pattern}
      autoComplete={autoComplete}
      aria-describedby={ariaDescribedBy}
    />
  )
}

export function FormGroup({ label, htmlFor, children, className = '', id }: FormGroupProps) {
  return (
    <div id={id} className={`form-group ${className}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
    </div>
  )
}