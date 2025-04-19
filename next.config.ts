import type { NextConfig } from 'next';

// Helper function to parse comma-separated hostnames from an environment variable
const parseAllowedHostnames = (envVar: string | undefined): string[] => {
  // Return empty array if envVar is undefined, null, or empty string
  if (!envVar) {
    return [];
  }
  // Split by comma, trim whitespace from each part, and filter out any empty strings
  return envVar.split(',').map(host => host.trim()).filter(Boolean);
};

// Initialize the array for remote patterns
const remotePatternsConfig: Required<NextConfig>['images']['remotePatterns'] = [];

// --- Add Production/Common Hostnames ---
const prodHostnames = parseAllowedHostnames(process.env.PROD_IMAGE_HOSTNAME_ALLOWLIST);

prodHostnames.forEach(hostname => {
  console.log(`Adding common/prod hostname for images: ${hostname}`);
  remotePatternsConfig.push({
    // protocol: 'https', // Recommended: Use HTTPS for production if possible
    hostname: hostname,
    // Omitting 'protocol' allows both http and https by default
  });
});


// --- Add Development-Specific Hostnames ---
// process.env.NODE_ENV is automatically set by Next.js ('development', 'production', 'test')
if (process.env.NODE_ENV === 'development') {
  const devHostname = process.env.DEV_IMAGE_HOSTNAME;

  if (devHostname) {
    // Check if this specific hostname wasn't already added via the allowlist
    if (!remotePatternsConfig.some(pattern => pattern.hostname === devHostname)) {
        console.log(`Adding development-only hostname for images: ${devHostname}`);
        remotePatternsConfig.push({
            protocol: 'http', // Keep 'http' specifically for the local dev IP as in your original config
            hostname: devHostname,
            // Add port/pathname here if needed for the dev server
            // port: '',
            // pathname: '/images/**',
        });
    } else {
         console.log(`Development hostname ${devHostname} was already included in common/prod list.`);
    }
  } else {
    console.log('DEV_IMAGE_HOSTNAME environment variable not set for development mode.');
  }
}

// --- Define the Next.js Config ---
const nextConfig: NextConfig = {
  /* other config options */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    // Use the dynamically generated remotePatterns array
    remotePatterns: remotePatternsConfig,
  },
};

// Log the final config being used (optional, for debugging)
console.log('Using image remote patterns:', JSON.stringify(remotePatternsConfig, null, 2));

export default nextConfig;
