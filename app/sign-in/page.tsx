import { SignIn } from "./SignIn";
import type { Metadata } from "next";
export const metadata:Metadata={title:"Sign in",robots:{index:false,follow:false}};
export default function Page(){return <SignIn/>;}
