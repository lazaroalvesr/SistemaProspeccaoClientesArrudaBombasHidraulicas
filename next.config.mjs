/** @type {import('next').NextConfig} */
import path from "node:path";

const nextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;
