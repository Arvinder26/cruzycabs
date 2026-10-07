import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages:["@libsql/client"],
  async headers(){return [{source:"/:path*",headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"Referrer-Policy",value:"no-referrer"},
    {key:"X-Frame-Options",value:"DENY"},
    {key:"Permissions-Policy",value:"geolocation=(self), camera=(), microphone=()"},
    {key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"},
  ]},{source:"/(api|account|manage-booking|admin|dispatch|driver|partner|sign-in)/:path*",headers:[{key:"Cache-Control",value:"no-store"},{key:"X-Robots-Tag",value:"noindex, nofollow"}]}];},
};

export default nextConfig;
