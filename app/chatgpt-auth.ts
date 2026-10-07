import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { identity,type Identity } from "../lib/auth";
export type ChatGPTUser=Identity;
export async function getChatGPTUser(){return identity(await headers());}
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(!user)redirect(chatGPTSignInPath(returnTo));return user;}
export function chatGPTSignInPath(returnTo:string){return `/sign-in?next=${encodeURIComponent(returnTo.startsWith("/")&&!returnTo.startsWith("//")?returnTo:"/account")}`;}
export function chatGPTSignOutPath(){return "/sign-in?signout=1";}
