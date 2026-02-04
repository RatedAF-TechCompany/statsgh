/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "statsgh.com",
      },
      {
        protocol: "https",
        hostname: "ofhejtwaigiqyejbvncz.supabase.co",
      },
    ],
  },
};

export default nextConfig;
