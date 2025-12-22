/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lcysphtjcrhgopjrmjca.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: '46.62.209.244.nip.io',
                pathname: '/**',
            },
        ],
    },
    /* config options here */
};

module.exports = nextConfig;
