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
  minLength?: number
  inputMode?: string
  pattern?: string
  autoComplete?: string
  ariaDescribedBy?: string
  onChange?: (e: any) => void
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
  minLength,
  inputMode,
  pattern,
  autoComplete,
  ariaDescribedBy,
  onChange
}: InputProps) {
  if (type === 'password') {
    return (
      <div className="password-input-container" style={{ position: 'relative', width: '100%' }}>
        <input
          ref={(el: HTMLInputElement | null) => {
            if (el) {
              el.style.setProperty('padding-right', '50px', 'important');
            }
          }}
          onChange={onChange}
          type="password"
          id={id}
          name={name}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          value={value}
          className={`${className} password-input`}
          style={{ ...style }}
          min={min}
          max={max}
          step={step}
          list={list}
          maxLength={maxLength}
          minLength={minLength}
          inputMode={inputMode}
          pattern={pattern}
          autoComplete={autoComplete}
          aria-describedby={ariaDescribedBy}
        />
        <button
          type="button"
          className="password-toggle-btn"
          aria-label="Toggle password visibility"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#b3b3b3',
            zIndex: 2,
            borderRadius: '50%',
            transition: 'color 0.2s, background-color 0.2s',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.color = '#fff';
            target.style.backgroundColor = 'rgba(255,255,255,0.1)';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.color = '#b3b3b3';
            target.style.backgroundColor = 'transparent';
          }}
          onClick={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const input = btn.previousElementSibling as HTMLInputElement;
            const eye = btn.querySelector('.icon-eye') as HTMLElement;
            const eyeOff = btn.querySelector('.icon-eye-off') as HTMLElement;
            
            if (input && input.type === 'password') {
              input.type = 'text';
              if (eye) eye.style.display = 'none';
              if (eyeOff) eyeOff.style.display = 'inline-block';
            } else if (input) {
              input.type = 'password';
              if (eye) eye.style.display = 'inline-block';
              if (eyeOff) eyeOff.style.display = 'none';
            }
          }}
        >
          <span className="iconify icon-eye" data-icon="mdi:eye" data-inline="false" style={{ fontSize: '20px' }}></span>
          <span className="iconify icon-eye-off" data-icon="mdi:eye-off" data-inline="false" style={{ fontSize: '20px', display: 'none' }}></span>
        </button>
      </div>
    )
  }

  return (
    <input
      onChange={onChange}
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
      minLength={minLength}
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