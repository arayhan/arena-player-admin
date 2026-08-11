import type { NextConfig } from "next";

// No `reactCompiler: true` here, deliberately: it needs
// `babel-plugin-react-compiler`, which this repo does not install — v1 has
// exactly one client component (the proof-image reload button), so there is
// nothing for the compiler to optimise. See docs/architecture.md,
// "Deliberately absent".
const nextConfig: NextConfig = {};

export default nextConfig;
