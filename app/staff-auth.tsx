import Link from "next/link";
import { getChatGPTUser } from "./chatgpt-auth";
import { hasRole,type Role } from "../lib/auth";
export type StaffRole=Role;
export async function getStaffAccess(requiredRole:Role){const user=await getChatGPTUser();return {user,allowed:Boolean(user&&user.mfaVerified&&hasRole(user.email,requiredRole)),reason:user?"Staff access requires the correct role and a recent authenticator sign-in.":"Please sign in to your staff account."};}
export function StaffAccessDenied({reason}:{reason:string}){return <main className="denied-page"><div><span className="eyebrow">Protected operations</span><h1>Access not granted.</h1><p>{reason}</p><Link className="button button-primary" href="/sign-in">Sign in</Link><Link href="/">Return to cruzycabs</Link></div></main>;}
