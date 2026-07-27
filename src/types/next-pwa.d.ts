declare module "next-pwa" {
  import type { NextConfig } from "next";
  const withPWA: (options: Record<string, unknown>) => (config: NextConfig) => NextConfig;
  export default withPWA;
}
