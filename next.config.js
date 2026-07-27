/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // build liviano para la imagen de Docker
};

module.exports = nextConfig;
