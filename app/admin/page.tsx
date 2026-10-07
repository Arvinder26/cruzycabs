import type { Metadata } from "next";
export const metadata:Metadata={title:'admin workspace',robots:{index:false,follow:false}};
import { OperationsConsole } from "../OperationsConsole";
import { getStaffAccess, StaffAccessDenied } from "../staff-auth";
export const dynamic = "force-dynamic";
export default async function AdminPage() { const access = await getStaffAccess("admin"); if (!access.user || !access.allowed) return <StaffAccessDenied reason={access.reason} />; return <OperationsConsole surface="admin" userEmail={access.user.email} />; }
