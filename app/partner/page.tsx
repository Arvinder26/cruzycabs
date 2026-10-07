import type { Metadata } from "next";
export const metadata:Metadata={title:'partner workspace',robots:{index:false,follow:false}};
import { OperationsConsole } from "../OperationsConsole";
import { getStaffAccess, StaffAccessDenied } from "../staff-auth";
export const dynamic = "force-dynamic";
export default async function PartnerPage() { const access = await getStaffAccess("partner"); if (!access.user || !access.allowed) return <StaffAccessDenied reason={access.reason} />; return <OperationsConsole surface="partner" userEmail={access.user.email} />; }
