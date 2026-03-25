import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Premium Plans",
  description:
    "Unlock unlimited plays, Practice Mode, and more with Backing & Score Premium. Affordable monthly and yearly plans for musicians.",
  openGraph: {
    title: "Pricing — Backing & Score Premium",
    description:
      "Unlock unlimited plays, Practice Mode, and more. Affordable plans for musicians.",
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
