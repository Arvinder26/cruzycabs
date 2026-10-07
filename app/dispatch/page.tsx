import type { Metadata } from "next";
export const metadata:Metadata={title:'dispatch workspace',robots:{index:false,follow:false}};
import { OperationsConsole } from "../OperationsConsole";
import { getStaffAccess, StaffAccessDenied } from "../staff-auth";
export const dynamic = "force-dynamic";
export default async function DispatchPage() { const access = await getStaffAccess("dispatch"); if (!access.user || !access.allowed) return <StaffAccessDenied reason={access.reason} />; return <OperationsConsole surface="dispatch" userEmail={access.user.email} />; }
