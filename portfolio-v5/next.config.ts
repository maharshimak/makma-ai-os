import type {NextConfig} from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig:NextConfig={
  reactStrictMode:true,
  output:"export",
  trailingSlash:true,
  basePath,
  assetPrefix:basePath || undefined
};

export default nextConfig;
