/** @type {import('next').NextConfig} */
const nextConfig = { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://fidulync.com"),};

export default nextConfig;
