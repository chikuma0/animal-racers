/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BUILD_REVISION:
      process.env.NEXT_PUBLIC_BUILD_REVISION ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "local-working-tree",
  },
};
export default nextConfig;
