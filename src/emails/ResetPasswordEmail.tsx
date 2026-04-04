import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface ResetPasswordEmailProps {
  url: string;
}

export const ResetPasswordEmail = ({
  url,
}: ResetPasswordEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Reset your password at Backing & Score</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Password Reset</Heading>
          <Text style={text}>
            Hello,
          </Text>
          <Text style={text}>
            You requested a password reset for your Backing & Score account. Please click the button below to set a new password.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={url}>
              Reset Password
            </Button>
          </Section>
          <Text style={text}>
            Or copy and paste this link into your browser:{" "}
            <Link href={url} style={link}>
              {url}
            </Link>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you did not request this, please ignore this email. Your account remains secure. This link will expire in 1 hour.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default ResetPasswordEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  marginBottom: "64px",
  borderRadius: "12px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  maxWidth: "560px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
  textAlign: "center" as const,
};

const text = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const link = {
  color: "#0066ff",
  textDecoration: "underline",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#e11d48", // Rose 600 for attention
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};
