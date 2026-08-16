import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this package — the host machine has an
  // unrelated package-lock.json above the repo that would otherwise make
  // Next.js infer the wrong root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
