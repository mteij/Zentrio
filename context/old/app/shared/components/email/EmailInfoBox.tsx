import { ComponentChildren } from "preact";
import { emailStyles } from "../../constants/styles.ts";

interface EmailInfoBoxProps {
  children: ComponentChildren;
  variant?: 'code' | 'credentials' | 'info';
}

export function EmailInfoBox({ children, variant = 'info' }: EmailInfoBoxProps) {
  const backgroundColor = variant === 'code' 
    ? '#e8f4f8' 
    : variant === 'credentials' 
    ? '#f8f8f8' 
    : emailStyles.colors.infoBackground;

  return (
    <div style={{
      ...emailStyles.infoBox,
      backgroundColor,
      textAlign: 'center',
      fontFamily: 'monospace',
      fontSize: variant === 'code' ? '24px' : '16px',
      fontWeight: variant === 'code' ? 'bold' : 'normal'
    }}>
      {children}
    </div>
  );
}