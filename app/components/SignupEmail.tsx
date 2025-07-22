import { h as _h } from "preact";
import { EmailTemplate } from "./EmailTemplate.tsx";

interface SignupEmailProps {
  email: string;
  password?: string;
}

export function SignupEmail({ email, password }: SignupEmailProps) {
  return (
    <EmailTemplate
      title="Welcome to StremioHub!"
      header="Welcome to StremioHub!"
      body={
        <>
          <p>
            Your account has been created successfully. You can now sign in
            using your email and the password below.
          </p>
          <div
            style={{
              margin: "30px 0",
              padding: "15px",
              backgroundColor: "#f0f0f0",
              borderRadius: "4px",
            }}
          >
            <p style={{ margin: "0 0 5px 0" }}>
              <strong>Email:</strong> {email}
            </p>
            <p style={{ margin: "0" }}>
              <strong>Password:</strong> {password}
            </p>
          </div>
          <p>
            We recommend changing your password after your first login. You can
            also sign in using a magic link or code sent to your email.
          </p>
        </>
      }
    />
  );
}
