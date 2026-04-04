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

interface VerificationEmailProps {
  url: string;
}

export const VerificationEmail = ({
  url,
}: VerificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address for Backing & Score</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Verify your Email</Heading>
          <Text style={text}>
            Welcome to <strong>Backing & Score</strong>. To complete your registration and unlock all platform features tailored for music practice, please click the verification button below.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={url}>
              Verify Email
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
            This verification link will expire in 24 hours. If you did not create an account, please ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default VerificationEmail;

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
  backgroundColor: "#0066ff",
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
