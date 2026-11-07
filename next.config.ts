import type { NextConfig } from "next";
import { pageAliases } from "./lib/public-routes";
import { analyticsContentSecurityPolicy, siteContentSecurityPolicy } from "./lib/content-security-policy";

const nextConfig: NextConfig = {
  serverExternalPackages:["@libsql/client"],
  async redirects() {
    return [
      ...["cruzycabs.vercel.app","cruzycabs-arvinder.vercel.app"].map(host=>({source:"/:path*",has:[{type:"host" as const,value:host}],destination:"https://cruzycabs.co.nz/:path*",permanent:true})),
      ...Object.entries(pageAliases).map(([from, to]) => ({ source: `/${from}`, destination: `/${to}`, permanent: true })),
    ];
  },
  async headers(){return [{source:"/:path*",headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"Referrer-Policy",value:"no-referrer"},
    {key:"X-Frame-Options",value:"DENY"},
    {key:"Permissions-Policy",value:"geolocation=(self), camera=(), microphone=()"},
    {key:"Content-Security-Policy",value:siteContentSecurityPolicy},
  ]},{source:"/(api|account|manage-booking|thank-you|admin|dispatch|driver|partner|sign-in)/:path*",headers:[{key:"Cache-Control",value:"no-store"},{key:"X-Robots-Tag",value:"noindex, nofollow"}]},{source:"/analytics-frame",headers:[{key:"Cache-Control",value:"no-store"},{key:"X-Robots-Tag",value:"noindex, nofollow"},{key:"Content-Security-Policy",value:analyticsContentSecurityPolicy},{key:"X-Frame-Options",value:"SAMEORIGIN"}]}];},
};

export default nextConfig;
