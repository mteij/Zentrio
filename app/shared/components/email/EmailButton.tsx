import { ComponentChildren } from "preact";
import { emailStyles } from "../../constants/styles.ts";

interface EmailButtonProps {
  href: string;
  children: ComponentChildren;
  variant?: 'primary' | 'secondary';
}

export function EmailButton({ href, children, variant = 'primary' }: EmailButtonProps) {
  const buttonStyle = variant === 'primary' 
    ? emailStyles.button
    : { ...emailStyles.button, backgroundColor: '#666666' };

  return (
    <a href={href} style={buttonStyle}>
      {children}
    </a>
  );
}