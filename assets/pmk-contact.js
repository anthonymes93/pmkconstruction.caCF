/* Cloudflare deployment refresh — no functional changes. */
(()=>{"use strict";
const forms=[...document.querySelectorAll("form.pmk-contact-form")];
if(!forms.length)return;
let turnstileReady=false;
const widgetIds=new Map();
const setStatus=(form,message,error=false)=>{const e=form.querySelector(".pmk-status");e.textContent=message;e.classList.toggle("error",error)};
const loadTurnstile=async()=>{
  try{
    const response=await fetch("/api/contact",{cache:"no-store"});
    if(!response.ok)throw Error("Security configuration unavailable");
    const config=await response.json();
    if(!config.turnstileSiteKey)throw Error("TURNSTILE_SITE_KEY is not configured");
    const script=document.createElement("script");
    script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async=true;
    script.onload=()=>{
      if(!window.turnstile){forms.forEach(form=>setStatus(form,"Security verification failed to load. Please refresh.",true));return}
      forms.forEach(form=>{
        try{const id=window.turnstile.render(form.querySelector(".pmk-turnstile"),{sitekey:config.turnstileSiteKey,theme:"auto"});widgetIds.set(form,id)}
        catch(error){console.error("Turnstile render error",error);setStatus(form,"Security verification could not initialize.",true)}
      });
      turnstileReady=true;
    };
    script.onerror=()=>forms.forEach(form=>setStatus(form,"Security verification failed to load. Please refresh.",true));
    document.head.appendChild(script);
  }catch(error){
    console.error("Contact form configuration error",error);
    forms.forEach(form=>setStatus(form,"Security verification is unavailable. Please try again later.",true));
  }
};
forms.forEach(form=>form.addEventListener("submit",async event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form).entries());
  if(data.email&&!data.email.trim()&&!data.phone.trim()){setStatus(form,"Please provide an email address or phone number.",true);return}
  if(!data.email&&!data.phone?.trim()){setStatus(form,"Please provide a phone number.",true);return}
  if(!turnstileReady||!window.turnstile||!widgetIds.has(form)){setStatus(form,"Security verification is still loading. Please try again.",true);return}
  const token=window.turnstile.getResponse(widgetIds.get(form));
  if(!token){setStatus(form,"Please complete the security check.",true);return}
  const button=form.querySelector(".pmk-submit");
  button.disabled=true;
  setStatus(form,"Sending your message…");
  try{
    const result=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,kind:form.dataset.formKind,turnstileToken:token})});
    const json=await result.json().catch(()=>({}));
    if(!result.ok)throw Error(json.error||"Unable to send your message.");
    form.querySelector(".pmk-fields").hidden=true;
    const success=form.querySelector(".pmk-success");
    success.hidden=false;
    success.focus({preventScroll:true});
  }catch(error){
    setStatus(form,error.message||"Unable to send your message.",true);
    window.turnstile.reset(widgetIds.get(form));
  }finally{button.disabled=false}
},true));
loadTurnstile();
})();