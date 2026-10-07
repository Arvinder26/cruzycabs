import type { Metadata } from "next";
export const metadata:Metadata={title:'driver workspace',robots:{index:false,follow:false}};
import { OperationsConsole } from "../OperationsConsole";
import { getStaffAccess, StaffAccessDenied } from "../staff-auth";
export const dynamic = "force-dynamic";
export default async function DriverPage() { const access = await getStaffAccess("driver"); if (!access.user || !access.allowed) return <StaffAccessDenied reason={access.reason} />; return <OperationsConsole surface="driver" userEmail={access.user.email} />; }
