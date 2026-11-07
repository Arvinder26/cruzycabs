"use client";
import { useEffect,useRef,useState,type FormEvent } from "react";
import { SiteHeader } from "../SiteHeader";
import { SignOutButton } from "../SignOutButton";
import { internalPath } from "../../lib/navigation";

export function SignIn() {
  const [email,setEmail]=useState(""),[code,setCode]=useState(""),[totp,setTotp]=useState(""),[challenge,setChallenge]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
  const emailInput=useRef<HTMLInputElement>(null),codeInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(challenge)codeInput.current?.focus();},[challenge]);
  async function authenticate(verify:boolean) {
    setBusy(true);setMessage("");setFailed(false);
    try {
      const response=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(verify?{action:"verify",challenge,code,totp}:{action:"request",email})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Sign-in is unavailable. Please retry.");
      if(data.ok)window.location.assign(internalPath(new URLSearchParams(window.location.search).get("next"),internalPath(data.destination)));
      else {setChallenge(data.challenge);setCode("");setTotp("");setMessage("Check your email for a six-digit code. It expires in 10 minutes. Use the newest code if you request another.");codeInput.current?.focus();}
    } catch(error){setFailed(true);setMessage(error instanceof Error?error.message:"Sign-in failed. Please retry.");}
    finally{setBusy(false);}
  }
  function changeEmail(){setChallenge("");setCode("");setTotp("");setMessage("");setFailed(false);setTimeout(()=>emailInput.current?.focus(),0);}
  function submit(event:FormEvent){event.preventDefault();void authenticate(Boolean(challenge));}
  return <main className="utility-page"><SiteHeader compact/><section className="utility-shell"><div><h1>Sign in securely.</h1><p>We’ll email a one-time code. Staff also need their authenticator and assigned permissions.</p></div><form className="utility-card" onSubmit={submit} aria-busy={busy}>
    <label>Email<input ref={emailInput} type="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={Boolean(challenge)||busy} autoComplete="email"/></label>
    {challenge&&<><label>Six-digit code<input ref={codeInput} required value={code} onChange={e=>setCode(e.target.value)} pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" aria-describedby="signin-message"/></label><label>Staff authenticator code <small>staff only</small><input value={totp} onChange={e=>setTotp(e.target.value)} pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code"/></label></>}
    <p id="signin-message" role={failed?"alert":"status"}>{message}</p>
    <button className="button button-primary" disabled={busy}>{busy?"Please wait…":challenge?"Sign in":"Email me a code"}</button>
    {challenge&&<div className="panel-actions"><button type="button" className="text-button" disabled={busy} onClick={()=>void authenticate(false)}>Email me a new code</button><button type="button" className="text-button" disabled={busy} onClick={changeEmail}>Change email address</button></div>}
    <SignOutButton/>
  </form></section></main>;
}
