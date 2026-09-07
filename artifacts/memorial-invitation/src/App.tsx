import { type ReactNode, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarDays, Check, CheckCircle2,
  ChevronRight, Copy, ExternalLink, Home as HomeIcon, ImagePlus, Info, Leaf, Link2,
  Loader2, LogIn, MapPin, Menu, Pencil, Phone, Plus, QrCode, RefreshCw, Search,
  Settings, ShieldCheck, Sparkles, Trash2, Upload, Users, X, XCircle
} from "lucide-react";
import {
  getGetAdminDashboardQueryKey, getGetEventQueryKey, getGetGuestQueryKey,
  getGetPublicInvitationQueryKey, getListAuditLogQueryKey, getListCheckInsQueryKey,
  getListGuestsQueryKey, getListProgrammeQueryKey, useAdmitInvitation, useCreateGuest,
  useCreateProgrammeItem, useDeleteGuest, useDeleteProgrammeItem, useDisableInvitation,
  useEnableInvitation, useGetAdminDashboard, useGetEvent, useGetGuest,
  useGetPublicInvitation, useHealthCheck, useImportGuests, useListAuditLog,
  useListCheckIns, useListGuests, useListProgramme, useLookupInvitation,
  useLookupPublicInvitation, useRegenerateInvitation, useRequestUploadUrl, useSubmitPaymentProof, useSubmitRsvp,
  useUpdateEvent, useUpdateGuest, useUpdateProgrammeItem,
  type AdminGuest, type AuditRecord, type CheckInRecord, type Event, type ProgrammeItem
} from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from "wouter";

const queryClient = new QueryClient();
const standingPhoto = "https://images.pexels.com/photos/7148462/pexels-photo-7148462.jpeg?auto=compress&cs=tinysrgb&w=900";
const seatedPhoto = "https://images.pexels.com/photos/10731998/pexels-photo-10731998.jpeg?auto=compress&cs=tinysrgb&w=900";
const dressCodeImage = "https://images.pexels.com/photos/4863033/pexels-photo-4863033.jpeg?auto=compress&cs=tinysrgb&w=1200";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const defaultAsoEbi = "ASO-EBI\n6 YARDS ONLY · ₦10,000\nSales end: 30th September, 2026\n\nPAYMENT INFORMATION\nOpay Account\nAccount Number: 8144963974\nAccount Name: Kasali Olawunmi\n\nNARRATION FOR PAYMENT\nDaddy Abatan\n\nSEND NOTIFICATIONS OF PAYMENT TO\n08027189122";
const locationMap = "/assets/locations-map.svg";

function formatDate(value?: string | null, long = false) {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: long ? "long" : "short", year: "numeric" }).format(date);
}

function formatTime(value?: string | null) {
  return value || "Time to be announced";
}

const WAKEKEEP_DATETIME = new Date("2026-10-15T16:00:00+01:00");
const BURIAL_DATETIME = new Date("2026-10-16T14:00:00+01:00");

function getNextEventDate(): Date {
  const now = new Date();
  if (now < WAKEKEEP_DATETIME) return WAKEKEEP_DATETIME;
  if (now < BURIAL_DATETIME) return BURIAL_DATETIME;
  return BURIAL_DATETIME;
}

function useCountdown(target: Date) {
  const [remaining, setRemaining] = useState(() => target.getTime() - Date.now());
  useEffect(() => {
    const interval = setInterval(() => setRemaining(target.getTime() - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);
  const clamped = Math.max(0, remaining);
  const days = Math.floor(clamped / 86400000);
  const hours = Math.floor((clamped % 86400000) / 3600000);
  const minutes = Math.floor((clamped % 3600000) / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  return { days, hours, minutes, seconds, isPast: remaining <= 0 };
}

function Countdown() {
  const target = useMemo(() => getNextEventDate(), []);
  const { days, hours, minutes, seconds, isPast } = useCountdown(target);
  const label = target === WAKEKEEP_DATETIME ? "Wake Keep" : "Burial";
  if (isPast) return null;
  const units = [
    { value: days, label: "Days" },
    { value: hours, label: "Hours" },
    { value: minutes, label: "Minutes" },
    { value: seconds, label: "Seconds" },
  ];
  return (
    <div className="mt-9" data-testid="section-countdown">
      <p className="mono-font text-xs uppercase text-[#e1b47d]">Counting down to {label}</p>
      <div className="mt-4 flex gap-3">
        {units.map((unit, index) => (
          <div key={unit.label} className="flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-background/20 bg-background/10 backdrop-blur-sm sm:h-20 sm:w-20">
              <span className="display-font text-2xl tabular-nums text-background sm:text-4xl">{String(unit.value).padStart(2, "0")}</span>
            </div>
            <span className="mono-font mt-2 text-[10px] uppercase tracking-[.1em] text-background/50">{unit.label}</span>
            {index < units.length - 1 && <span className="hidden" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DressCodeSection({ dressCode }: { dressCode?: string | null }) {
  return (
    <section id="dress-code" className="bg-[#ebe4d8] px-5 py-20 lg:px-10 lg:py-28" data-testid="section-dress-code">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="relative overflow-hidden rounded-[2rem] soft-shadow">
          <img src={dressCodeImage} alt="Purple fabric representing the dress code" className="h-full w-full object-cover" style={{ minHeight: 280 }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#252a3a]/60 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 text-background">
            <p className="mono-font text-[10px] uppercase tracking-[.18em] text-[#e1b47d]">Dress code</p>
            <p className="display-font mt-1 text-4xl">{dressCode || "Purple"}</p>
          </div>
        </div>
        <div>
          <p className="mono-font text-xs uppercase text-accent">06 · Dress code</p>
          <h2 className="display-font mt-5 text-4xl leading-tight sm:text-5xl">Wear a little of the memory.</h2>
          <p className="mt-5 max-w-md leading-7 text-muted-foreground">The family invites guests to honour Pa Emmanuel in <strong className="text-foreground">{dressCode || "Purple"}</strong>. This shared colour is a gentle way to stand together in remembrance.</p>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">If you are also purchasing Aso-Ebi, the family cloth coordinates with this colour.</p>
        </div>
      </div>
    </section>
  );
}

function invitationUrl(token: string) {
  return `${window.location.origin}${basePath}/invite/${token}`;
}

function venueDirections(venue: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

async function copyText(value: string, label: string) {
  if (!navigator.clipboard) {
    toast({ title: "Copy unavailable", description: "Please copy the value manually." });
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  } catch {
    toast({ title: "Copy failed", description: "Please copy the value manually." });
  }
}

function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "outline" | "danger" }) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-lg",
    quiet: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border border-border bg-card/50 hover:bg-secondary",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
  };
  return <button className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{label}</span><input className="focus-ring h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm font-normal outline-none transition focus:border-accent" {...props} />{hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}</label>;
}

function TextField({ label, hint, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{label}</span><textarea className="focus-ring min-h-28 w-full resize-y rounded-xl border border-input bg-background/60 px-3 py-3 text-sm font-normal outline-none transition focus:border-accent" {...props} />{hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}</label>;
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warm" | "bad" }) {
  const tones = { neutral: "bg-muted text-muted-foreground", good: "bg-[#dfeadf] text-[#355e3b]", warm: "bg-[#f0dfc5] text-[#805d2e]", bad: "bg-[#f2d8d5] text-[#87423d]" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${tones[tone]}`}>{children}</span>;
}

function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center rounded-3xl border border-border bg-card/60" data-testid="status-loading"><div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {label}</div></div>;
}

function ErrorBlock({ onRetry, label = "Something went wrong. Please try again." }: { onRetry?: () => void; label?: string }) {
  return <div className="rounded-3xl border border-[#dfb6b1] bg-[#f8e9e5] p-6 text-center" data-testid="status-error"><XCircle className="mx-auto mb-3 h-6 w-6 text-accent" /><p className="text-sm text-[#713e3b]">{label}</p>{onRetry && <Button variant="outline" className="mt-4 border-[#d7aaa5]" onClick={onRetry} data-testid="button-retry">Try again</Button>}</div>;
}

function BrandMark({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className="focus-ring inline-flex items-center gap-3" data-testid="link-brand"><img src={standingPhoto} alt="Pa Emmanuel Ayodele Abatan" className="h-9 w-9 rounded-full object-cover object-top ring-2 ring-[#e1b47d]/70" /><span className={`display-font text-lg ${dark ? "text-background" : "text-foreground"}`}>Remembering Emmanuel</span></Link>;
}

function AsoEbiSection({ information }: { information?: string | null }) {
  const lines = (information || defaultAsoEbi).split("\n");
  return <><section id="aso-ebi" className="bg-[#252a3a] px-5 py-20 text-background lg:px-10 lg:py-28" data-testid="section-aso-ebi"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div className="relative min-h-[300px] overflow-hidden rounded-[2rem] border border-[#e1b47d]/25 bg-[#352448] p-8 shadow-2xl"><div className="absolute -right-10 -top-14 h-56 w-56 rounded-full border-[28px] border-[#e1b47d]/15" /><div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full border-[20px] border-[#b186cb]/20" /><div className="relative flex h-full min-h-[235px] flex-col justify-between"><p className="mono-font text-[10px] uppercase tracking-[.18em] text-[#e1b47d]">Aso-Ebi · family cloth</p><p className="display-font max-w-xs text-5xl leading-none">A thoughtful way to stand together.</p><p className="text-sm text-background/60">Available to family and friends who would like to join the remembrance.</p></div></div><div><p className="mono-font text-xs uppercase text-[#e1b47d]">04 · Aso-Ebi</p><h2 className="display-font mt-5 text-4xl leading-tight sm:text-6xl">Wear a little of the memory.</h2><div className="mt-8 space-y-1 text-sm leading-7 text-background/70">{lines.map((line, index) => line ? <p key={`${line}-${index}`} className={index === 0 ? "font-bold uppercase tracking-[.12em] text-[#e1b47d]" : ""}>{line}</p> : <div key={`space-${index}`} className="h-3" />)}</div></div></div></section><LocationMap /></>;
}

function LocationMap() {
  return <><PaymentProofPanel /><section id="locations" className="border-y border-border bg-[#e8dfd0] px-5 py-16 lg:px-10 lg:py-24" data-testid="section-location-map"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center"><div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm"><img src={locationMap} alt="Illustrated route between the Waykeep and Burial venues" className="h-auto w-full" /></div><div><p className="mono-font text-xs uppercase text-accent">05 · Finding the gatherings</p><h2 className="display-font mt-4 text-4xl leading-tight sm:text-5xl">Two places, one remembrance.</h2><p className="mt-5 text-sm leading-7 text-muted-foreground">Open the venue you need in Google Maps for the latest directions. Search results may vary, so please confirm the location before travelling.</p><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><a href={venueDirections("Citadel Global Community Church (CGCC)")} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5"><MapPin className="h-4 w-4" /> Waykeep directions <ExternalLink className="h-4 w-4" /></a><a href={venueDirections("Ronnie D’Events")} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-bold transition hover:bg-secondary"><MapPin className="h-4 w-4 text-accent" /> Burial directions <ExternalLink className="h-4 w-4" /></a></div></div></div></section></>;
}

function PaymentProofPanel() {
  const match = window.location.pathname.match(/\/invite\/([^/]+)/);
  const token = match?.[1] || "";
  const invitationQuery = useGetPublicInvitation(token, { query: { queryKey: getGetPublicInvitationQueryKey(token), enabled: Boolean(token) } });
  const submitPayment = useSubmitPaymentProof();
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState(false);
  if (!token) return null;
  const status = submitted ? "pending" : invitationQuery.data?.paymentStatus || "unpaid";
  const code = invitationQuery.data?.invitationCode || "your invitation code";
  const whatsappHref = `https://wa.me/2348027189122?text=${encodeURIComponent(`Pa Emmanuel Aso-Ebi payment receipt\nInvitation code: ${code}\nTransaction reference: ${reference || "I will attach my receipt here"}`)}`;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (reference.trim().length < 3) return;
    submitPayment.mutate({ token, data: { reference: reference.trim() } }, { onSuccess: () => { setSubmitted(true); toast({ title: "Payment proof received", description: "The family will verify your receipt shortly." }); }, onError: () => toast({ title: "Payment proof could not be sent", description: "Please try again or send the receipt on WhatsApp." }) });
  };
  return <section className="border-t border-[#e1b47d]/20 bg-[#352448] px-5 py-16 text-background lg:px-10" data-testid="section-payment"><div className="mx-auto max-w-4xl"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mono-font text-xs uppercase text-[#e1b47d]">Aso-Ebi payment</p><h2 className="display-font mt-3 text-4xl sm:text-5xl">Stand with the family.</h2></div><StatusPill tone={status === "verified" ? "good" : status === "pending" ? "warm" : status === "declined" ? "bad" : "neutral"}>{status === "verified" ? "Payment confirmed" : status === "pending" ? "Proof pending" : status === "declined" ? "Needs attention" : "Not paid yet"}</StatusPill></div><div className="mt-8 grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><div className="rounded-2xl border border-background/15 bg-background/10 p-5"><p className="mono-font text-[10px] uppercase text-[#e1b47d]">Pay via Opay</p><p className="mt-4 text-sm leading-7 text-background/75">6 yards · ₦10,000</p><p className="mt-4 text-sm leading-7 text-background/75">Account number<br /><strong className="text-background">8144963974</strong></p><p className="mt-3 text-sm leading-7 text-background/75">Account name<br /><strong className="text-background">Kasali Olawunmi</strong></p><p className="mt-3 text-xs leading-5 text-background/55">Use “Daddy Abatan” as the payment narration.</p></div><form onSubmit={submit} className="rounded-2xl bg-background p-5 text-foreground"><p className="text-sm font-bold">Send your receipt</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Enter the transaction reference after paying. This records your proof for family verification; it does not claim automatic bank confirmation.</p><Field label="Transaction reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="e.g. OPAY-123456" disabled={status === "pending" || status === "verified"} /><div className="mt-4 flex flex-wrap gap-2"><Button type="submit" disabled={submitPayment.isPending || status === "pending" || status === "verified" || reference.trim().length < 3}>{submitPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {status === "pending" ? "Proof sent" : "Send proof"}</Button><a href={whatsappHref} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#dfeadf] px-5 text-sm font-semibold text-[#355e3b]"><Phone className="h-4 w-4" /> Send receipt on WhatsApp</a></div>{status === "pending" && <p className="mt-4 text-xs font-semibold text-[#805d2e]">Your payment proof is awaiting family verification.</p>}{status === "verified" && <p className="mt-4 text-xs font-semibold text-[#355e3b]">Your payment has been confirmed by the family.</p>}</form></div></div></section>;
}

function PublicNav() {
  return <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10"><BrandMark dark /><nav className="hidden items-center gap-5 text-sm font-semibold text-background/75 md:flex"><a href="#details" className="transition hover:text-background">The gathering</a><a href="#programme" className="transition hover:text-background">Programme</a><a href="#dress-code" className="transition hover:text-background">Dress code</a><a href="#aso-ebi" className="transition hover:text-background">Aso-Ebi</a><a href="#locations" className="transition hover:text-background">Map</a><Link href="/check-in" className="focus-ring inline-flex items-center gap-2 rounded-full border border-background/25 px-4 py-2 text-background transition hover:bg-background/10"><ShieldCheck className="h-4 w-4" /> Usher access</Link></nav><Link href="/sign-in" className="focus-ring rounded-full border border-background/30 px-4 py-2 text-xs font-bold uppercase tracking-[.12em] text-background md:hidden">Family sign in</Link></header>;
}

function MyInvitationLookup() {
  const [input, setInput] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [, setLocation] = useLocation();
  const lookup = useLookupPublicInvitation(submittedCode, { query: { enabled: false, queryKey: ["/api/public/invitations/code", submittedCode] } });
  useEffect(() => {
    if (submittedCode) void lookup.refetch();
  }, [lookup.refetch, submittedCode]);
  useEffect(() => {
    if (!submittedCode || !lookup.data) return;
    setLocation(`/invite/${lookup.data.token}`);
  }, [lookup.data, setLocation, submittedCode]);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const code = input.trim().toUpperCase();
    if (code.length < 4) return;
    setSubmittedCode(code);
  };
  return <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5" data-testid="form-my-invitation"><div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-accent" /><p className="text-sm font-bold">Open my invitation</p></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Enter the friendly code shared with you. No account or login is needed.</p><div className="mt-4 flex gap-2"><input value={input} onChange={event => setInput(event.target.value.toUpperCase())} placeholder="ADEWALE-4821" className="focus-ring h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 font-mono text-sm uppercase outline-none" data-testid="input-invitation-code" /><Button type="submit" className="px-4" disabled={lookup.isFetching}><Search className="h-4 w-4" /><span className="hidden sm:inline">Find</span></Button></div>{lookup.isError && submittedCode && <p className="mt-3 text-xs font-semibold text-destructive" data-testid="status-invalid-invitation">Invitation not found. Please check your invitation code.</p>}</form>;
}

function Home() {
  const eventQuery = useGetEvent();
  const programmeQuery = useListProgramme({ query: { queryKey: getListProgrammeQueryKey() } });
  const event = eventQuery.data;
  const programme = (programmeQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return <main className="grain min-h-[100dvh] bg-background"><section className="relative isolate min-h-[720px] overflow-hidden bg-[#252a3a] text-background"><img src={event?.backgroundImageUrl || standingPhoto} alt="Pa Emmanuel Ayodele Abatan" className="absolute inset-0 -z-20 h-full w-full object-cover object-top opacity-35" /><div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#252a3a_10%,rgba(37,42,58,.83)_42%,rgba(37,42,58,.38)_100%)]" /><PublicNav /><div className="mx-auto flex min-h-[720px] max-w-7xl items-end px-5 pb-16 pt-32 lg:items-center lg:px-10 lg:pb-4"><div className="max-w-2xl"><p className="mono-font mb-7 text-xs uppercase text-[#e1b47d]">A life held in memory · {event?.year || ""}</p><h1 className="display-font max-w-xl text-5xl leading-[1.03] tracking-[-.04em] sm:text-7xl lg:text-[88px]" data-testid="text-deceased-name">{event?.deceasedName || "Pa Emmanuel Ayodele Abatan"}</h1><p className="mt-6 max-w-lg text-lg leading-8 text-background/72">{event?.eventTitle || "In loving memory"}</p><div className="mt-9 flex flex-wrap gap-3"><a href="#details" className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full bg-secondary px-6 text-sm font-bold text-secondary-foreground transition hover:-translate-y-0.5">Remember with us <ArrowRight className="h-4 w-4" /></a><Link href="/sign-in" className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full border border-background/30 px-6 text-sm font-semibold text-background transition hover:bg-background/10"><LogIn className="h-4 w-4" /> Family access</Link></div><Countdown /></div></div></section><section id="details" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:py-28"><div><p className="mono-font text-xs uppercase text-accent">The gathering</p><h2 className="display-font mt-5 max-w-xl text-4xl leading-tight tracking-[-.03em] sm:text-6xl">A time to be close, to reflect, and to say thank you.</h2><p className="mt-7 max-w-xl text-base leading-8 text-muted-foreground">{event?.biography || "The family welcomes invited guests to gather in remembrance."}</p>{event?.tribute && <blockquote className="mt-8 border-l-2 border-secondary pl-5 font-serif text-xl italic leading-8 text-foreground/80">{event.tribute}</blockquote>}<div className="mt-8 max-w-md"><MyInvitationLookup /></div></div><div className="rounded-[2rem] bg-[#e7dcc8] p-7 sm:p-9" data-testid="card-event-details">{eventQuery.isLoading ? <LoadingBlock label="Loading event details" /> : eventQuery.isError ? <ErrorBlock onRetry={() => eventQuery.refetch()} /> : <div className="space-y-7"><div><p className="mono-font text-[10px] uppercase text-accent">Wake Keep</p><p className="display-font mt-2 text-3xl">{formatDate(event?.waykeepDate, true)}</p><p className="mt-1 text-sm font-bold text-foreground">4:00 PM</p><p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{event?.waykeepVenue}</p></div><div className="h-px bg-foreground/10" /><div><p className="mono-font text-[10px] uppercase text-accent">Burial service</p><p className="display-font mt-2 text-3xl">{formatDate(event?.burialDate, true)}</p><p className="mt-1 text-sm font-bold text-foreground">2:00 PM</p><p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{event?.burialVenue}</p></div><div className="flex items-start gap-3 text-sm text-muted-foreground"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>Dress code: {event?.dressCode}</span></div>{event?.mapUrl && <a href={event.mapUrl} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-accent">Open directions <ExternalLink className="h-4 w-4" /></a>}</div>}</div></section><section id="programme" className="border-y border-border bg-[#ebe4d8]"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.7fr_1.3fr] lg:px-10 lg:py-24"><div><p className="mono-font text-xs uppercase text-accent">02 · Programme</p><h2 className="display-font mt-5 text-4xl leading-tight sm:text-5xl">The shape of the days.</h2><p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">Programme details are shared here as the family confirms them.</p></div><ProgrammeList query={programmeQuery} /></div></section><section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:grid-cols-[.8fr_1.2fr] sm:items-center lg:px-10 lg:py-28"><img src={seatedPhoto} alt="Pa Emmanuel Ayodele Abatan seated for a portrait" className="mx-auto max-h-[600px] w-full max-w-sm rounded-[2rem] object-cover object-top soft-shadow" /><div><p className="mono-font text-xs uppercase text-accent">03 · In his own place</p><h2 className="display-font mt-5 max-w-xl text-4xl leading-tight sm:text-6xl">A gentle invitation for those who knew him.</h2><p className="mt-6 max-w-lg leading-8 text-muted-foreground">{event?.importantInformation || "Please bring your invitation with you. The family looks forward to welcoming you."}</p>{event?.contactInformation && <p className="mt-6 flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-accent" />{event.contactInformation}</p>}</div></section><DressCodeSection dressCode={event?.dressCode} /><AsoEbiSection information={event?.asoEbiInformation} /><footer className="bg-[#252a3a] px-5 py-10 text-background lg:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-center"><BrandMark dark /><p className="text-xs text-background/55">Made with care for the Abatan family.</p></div></footer></main>;
}

function ProgrammeList({ query }: { query: { data?: ProgrammeItem[]; isLoading: boolean; isError: boolean; refetch: () => unknown } }) {
  const programme = (query.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return <div className="space-y-3" data-testid="list-programme">{query.isLoading && <LoadingBlock label="Preparing the programme" />}{query.isError && <ErrorBlock onRetry={() => query.refetch()} />}{!query.isLoading && !query.isError && programme.length === 0 && <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Programme details will appear here.</div>}{programme.map((item, index) => <div key={item.id} className="group flex gap-4 rounded-2xl bg-card/70 p-5 transition hover:bg-card"><div className="mono-font pt-1 text-xs text-accent">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="display-font text-2xl">{item.title}</h3><span className="text-xs font-bold text-muted-foreground">{formatDate(item.date)}{item.time ? ` · ${formatTime(item.time)}` : ""}</span></div>{item.location && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><MapPin className="h-3 w-3" />{item.location}</p>}{item.description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>}</div><ChevronRight className="mt-1 h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" /></div>)}</div>;
}

function InvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const invitationQuery = useGetPublicInvitation(token, { query: { queryKey: getGetPublicInvitationQueryKey(token), enabled: Boolean(token) } });
  const rsvp = useSubmitRsvp();
  const [submitted, setSubmitted] = useState(false);
  const invitation = invitationQuery.data;
  if (invitationQuery.isLoading) return <AuthFrame><LoadingBlock label="Opening your invitation" /></AuthFrame>;
  if (invitationQuery.isError || !invitation) return <AuthFrame><ErrorBlock label="This invitation is unavailable." onRetry={() => invitationQuery.refetch()} /></AuthFrame>;
  const event = invitation.event;
  const submit = (response: "yes" | "no") => rsvp.mutate({ token, data: { response } }, { onSuccess: () => { setSubmitted(true); toast({ title: "RSVP submitted", description: "Thank you. Your RSVP has been recorded." }); }, onError: () => toast({ title: "RSVP could not be saved", description: "Something went wrong. Please try again." }) });
  return <main className="grain min-h-[100dvh] bg-[#e8dfd0] px-4 py-6 sm:py-10"><div className="mx-auto max-w-4xl"><div className="mb-8 flex items-center justify-between"><BrandMark /><Link href="/" className="focus-ring text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Memorial home</Link></div><div className="overflow-hidden rounded-[2rem] bg-card soft-shadow"><div className="grid md:grid-cols-[.9fr_1.1fr]"><div className="relative min-h-[460px] bg-[#252a3a]"><img src={event.photoUrl || standingPhoto} alt="Pa Emmanuel Ayodele Abatan" className="absolute inset-0 h-full w-full object-cover object-top opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-[#252a3a] via-transparent to-transparent" /><div className="absolute bottom-7 left-7 text-background"><p className="mono-font text-[10px] uppercase text-[#e1b47d]">You are warmly invited</p><p className="display-font mt-2 text-3xl">{invitation.guestName}</p><p className="mt-1 text-sm text-background/65">To gather in memory of {event.deceasedName}.</p></div></div><div className="p-7 sm:p-10"><p className="mono-font text-xs uppercase text-accent">Personal invitation</p><h1 className="display-font mt-4 text-4xl leading-tight">A place has been kept for you.</h1><p className="mt-5 leading-7 text-muted-foreground">Please confirm whether you will join the family. Your invitation admits <strong className="text-foreground">{invitation.admissionLimit} {invitation.admissionLimit === 1 ? "person" : "people"}</strong>.</p><div className="my-8 space-y-5 border-y border-border py-6"><div className="flex gap-4"><CalendarDays className="mt-1 h-5 w-5 text-accent" /><div><p className="font-bold">Wake Keep · {formatDate(event.waykeepDate, true)}</p><p className="mt-1 text-sm font-bold text-foreground">4:00 PM</p><p className="mt-1 text-sm text-muted-foreground">{event.waykeepVenue}</p></div></div><div className="flex gap-4"><Leaf className="mt-1 h-5 w-5 text-accent" /><div><p className="font-bold">Burial · {formatDate(event.burialDate, true)}</p><p className="mt-1 text-sm font-bold text-foreground">2:00 PM</p><p className="mt-1 text-sm text-muted-foreground">{event.burialVenue}</p></div></div><div className="flex gap-4"><Sparkles className="mt-1 h-5 w-5 text-accent" /><div><p className="font-bold">Dress code</p><p className="mt-1 text-sm text-muted-foreground">{event.dressCode}</p></div></div></div>{submitted || invitation.rsvpStatus !== "pending" ? <div className="rounded-2xl bg-[#e1ecdf] p-5" data-testid="status-rsvp-success"><CheckCircle2 className="h-6 w-6 text-[#355e3b]" /><p className="mt-3 font-bold text-[#355e3b]">Thank you. Your RSVP has been recorded.</p><p className="mt-1 text-sm text-[#4e6d51]">Your invitation code remains your admission pass.</p></div> : <div><p className="text-sm font-bold">Will you be joining us?</p><div className="mt-3 grid grid-cols-2 gap-3"><Button onClick={() => submit("yes")} disabled={rsvp.isPending}><Check className="h-4 w-4" /> I will attend</Button><Button variant="outline" onClick={() => submit("no")} disabled={rsvp.isPending}>Unable to attend</Button></div></div>}<div className="mt-6 flex flex-wrap gap-2"><Button variant="quiet" className="min-h-10 px-4 text-xs" onClick={() => copyText(window.location.href, "Invitation link")}><Copy className="h-4 w-4" /> Copy invitation</Button><Button variant="quiet" className="min-h-10 px-4 text-xs" onClick={() => copyText(invitation.invitationCode, "Invitation code")}><Copy className="h-4 w-4" /> Copy code</Button></div><p className="mono-font mt-8 text-[10px] uppercase text-muted-foreground">Code · {invitation.invitationCode}</p></div></div></div><div className="mt-6"><AsoEbiSection information={event.asoEbiInformation} /></div><div className="mt-6 rounded-[2rem] bg-[#ebe4d8] p-6 sm:p-10"><p className="mono-font text-xs uppercase text-accent">Programme</p><div className="mt-5"><ProgrammeList query={{ data: invitation.programme, isLoading: false, isError: false, refetch: () => undefined }} /></div></div></div></main>;
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="grain flex min-h-[100dvh] items-center justify-center bg-[#e8dfd0] px-4 py-8"><div className="w-full max-w-xl"><div className="mb-8 flex justify-center"><BrandMark /></div><div className="rounded-[2rem] bg-card p-6 soft-shadow sm:p-10">{children}</div></div></main>;
}

function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const nav = [{ href: "/admin", label: "Overview", icon: HomeIcon }, { href: "/admin/guests", label: "Guests", icon: Users }, { href: "/admin/invitations", label: "Invitations", icon: Link2 }, { href: "/admin/event", label: "Event settings", icon: Settings }, { href: "/admin/check-ins", label: "Check-in history", icon: ShieldCheck }, { href: "/admin/audit", label: "Audit log", icon: Info }];
  return <div className="grain min-h-[100dvh] bg-background md:flex"><aside className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-sidebar p-7 text-sidebar-foreground transition-transform duration-300 md:relative md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}><div className="flex items-center justify-between"><BrandMark dark /><button onClick={() => setOpen(false)} className="text-background/60 md:hidden"><X /></button></div><p className="mono-font mt-12 text-[10px] uppercase text-background/40">Family workspace</p><nav className="mt-4 space-y-1">{nav.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-background/70 transition hover:bg-sidebar-accent hover:text-background"><item.icon className="h-4 w-4" />{item.label}</Link>)}</nav><div className="absolute inset-x-7 bottom-8 rounded-2xl border border-background/10 bg-background/5 p-4"><p className="text-xs leading-5 text-background/60">A private space for keeping the welcome thoughtful and the details in order.</p><Link href="/check-in" className="mt-3 flex items-center gap-2 text-xs font-bold text-secondary"><QrCode className="h-4 w-4" /> Open usher check-in</Link></div></aside><div className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b border-border px-5 lg:px-10"><button className="rounded-full p-2 md:hidden" onClick={() => setOpen(true)}><Menu /></button><div className="hidden text-sm font-semibold text-muted-foreground md:block">Pa Emmanuel Ayodele Abatan</div><div className="flex items-center gap-4"><span className="hidden text-xs text-muted-foreground sm:block">Private family access</span><Link href="/" className="focus-ring text-xs font-bold text-accent">View memorial</Link></div></header><div className="px-5 py-8 lg:px-10 lg:py-12">{children}</div></div></div>;
}

function Protected({ children }: { children: ReactNode }) {
  if (!clerkPubKey) return <AuthFrame><ErrorBlock label="Authentication is not configured for this workspace." /></AuthFrame>;
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthFrame><LoadingBlock label="Checking family access" /></AuthFrame>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function StatCard({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value?: number; detail: string; icon: typeof Users; tone?: "default" | "warm" | "green" }) {
  return <div className={`rounded-2xl border border-border p-5 ${tone === "warm" ? "bg-[#f0dfc5]" : tone === "green" ? "bg-[#e1ecdf]" : "bg-card"}`}><div className="flex items-start justify-between"><p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-accent" /></div><p className="display-font mt-5 text-4xl">{value ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function AdminPage() {
  const dashboard = useGetAdminDashboard();
  const health = useHealthCheck();
  const [location] = useLocation();
  const guestsOnly = location === "/admin/guests" || location === "/admin/invitations";
  return <AdminShell><div className="mx-auto max-w-7xl">{!guestsOnly && <><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono-font text-xs uppercase text-accent">Overview</p><h1 className="display-font mt-3 text-5xl tracking-[-.04em]">A considered welcome.</h1><p className="mt-3 text-sm text-muted-foreground">Keep a clear view of who is coming, and make arrival feel easy.</p></div><div className="flex gap-2"><Link href="/admin/guests"><Button variant="outline"><Users className="h-4 w-4" /> Manage guests</Button></Link><Link href="/admin/event"><Button><Settings className="h-4 w-4" /> Event settings</Button></Link></div></div>{dashboard.isError ? <div className="mt-8"><ErrorBlock label="Access denied. Family admin access is required." onRetry={() => dashboard.refetch()} /></div> : dashboard.isLoading ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div> : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Total guests" value={dashboard.data?.totalInvited} detail={`${dashboard.data?.pending ?? 0} awaiting response`} icon={Users} /><StatCard label="RSVP attending" value={dashboard.data?.rsvpYes} detail={`${dashboard.data?.confirmed ?? 0} confirmed passes`} icon={CheckCircle2} tone="green" /><StatCard label="Checked in" value={dashboard.data?.checkedIn} detail={`${dashboard.data?.notCheckedIn ?? 0} yet to arrive`} icon={ShieldCheck} tone="warm" /><StatCard label="RSVP declined" value={dashboard.data?.rsvpNo} detail={`${dashboard.data?.disabled ?? 0} disabled passes`} icon={XCircle} /></div>}<div className="mt-12 rounded-3xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="mono-font text-xs uppercase text-accent">Recent activity</p><h2 className="display-font mt-2 text-3xl">The latest changes.</h2></div><Link href="/admin/audit" className="text-sm font-bold text-accent">View audit log <ArrowRight className="inline h-4 w-4" /></Link></div><ActivityList items={dashboard.data?.recentActivity ?? []} /></div></>}{guestsOnly && <GuestManager mode={location === "/admin/invitations" ? "invitations" : "guests"} />}{!guestsOnly && <p className="mt-4 text-xs text-muted-foreground">{health.data?.status === "ok" ? "Services are ready." : "Attendance updates are private to this workspace."}</p>}</div></AdminShell>;
}

function ActivityList({ items }: { items: AuditRecord[] }) {
  return <div className="mt-5 space-y-2">{items.length === 0 ? <p className="py-5 text-sm text-muted-foreground">No activity recorded yet.</p> : items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm"><span className="font-semibold">{item.action}</span><span className="text-xs text-muted-foreground">{item.target || "Workspace"} · {formatDate(item.createdAt, true)}</span></div>)}</div>;
}

function GuestManager({ mode }: { mode: "guests" | "invitations" }) {
  const guestsQuery = useListGuests(undefined, { query: { queryKey: getListGuestsQueryKey() } });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [rsvp, setRsvp] = useState("all");
  const [guestModal, setGuestModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [importResult, setImportResult] = useState<{ created: number; errors: number; duplicates: number } | null>(null);
  const createGuest = useCreateGuest();
  const updateGuest = useUpdateGuest();
  const deleteGuest = useDeleteGuest();
  const disable = useDisableInvitation();
  const enable = useEnableInvitation();
  const regenerate = useRegenerateInvitation();
  const importer = useImportGuests();
  const qc = useQueryClient();
  const editingGuestQuery = useGetGuest(editingId ?? 0, { query: { enabled: Boolean(editingId), queryKey: getGetGuestQueryKey(editingId ?? 0) } });
  const refresh = () => { qc.invalidateQueries({ queryKey: getListGuestsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() }); };
  const guests = (guestsQuery.data ?? []).filter(guest => {
    const matchesSearch = [guest.fullName, guest.invitationCode, guest.phone || "", guest.email || ""].some(value => value.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = status === "all" || guest.status === status;
    const matchesRsvp = rsvp === "all" || guest.rsvpStatus === rsvp;
    return matchesSearch && matchesStatus && matchesRsvp;
  });
  const submitGuest = (data: { fullName: string; phone: string; email: string; notes: string; admissionLimit: number }) => {
    if (editingId) updateGuest.mutate({ id: editingId, data }, { onSuccess: () => { setEditingId(null); refresh(); toast({ title: "Guest updated" }); } });
    else createGuest.mutate({ data }, { onSuccess: () => { setGuestModal(false); refresh(); toast({ title: "Guest created", description: "A unique invitation code and link are ready." }); } });
  };
  const importGuests = () => importer.mutate({ data: { csv } }, { onSuccess: result => { setImportResult({ created: result.created.length, errors: result.errors.length, duplicates: result.duplicates.length }); refresh(); toast({ title: "Guest list imported" }); }, onError: () => toast({ title: "Import failed", description: "Please review the pasted rows and try again." }) });
  return <section className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono-font text-xs uppercase text-accent">{mode === "invitations" ? "Invitation management" : "Guest management"}</p><h1 className="display-font mt-3 text-5xl tracking-[-.04em]">{mode === "invitations" ? "Every invitation in view." : "The people expected."}</h1><p className="mt-3 text-sm text-muted-foreground">Create, edit, share, and manage private admission passes.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setImportResult(null); setImportOpen(true); }}><Upload className="h-4 w-4" /> Paste guest list</Button><Button onClick={() => { setEditingId(null); setGuestModal(true); }}><Plus className="h-4 w-4" /> Add guest</Button></div></div><div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, code, phone, or email" className="focus-ring h-10 w-full rounded-full border border-input bg-card pl-9 pr-4 text-sm outline-none" /></div><select value={rsvp} onChange={e => setRsvp(e.target.value)} className="h-10 rounded-full border border-input bg-card px-4 text-sm"><option value="all">All RSVP</option><option value="pending">Pending</option><option value="yes">Attending</option><option value="no">Declined</option></select><select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-full border border-input bg-card px-4 text-sm"><option value="all">All passes</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="checked_in">Checked in</option><option value="disabled">Disabled</option></select></div><div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">{guestsQuery.isLoading ? <LoadingBlock label="Loading guests" /> : guestsQuery.isError ? <ErrorBlock onRetry={() => guestsQuery.refetch()} label="Access denied. Admin access is required." /> : guests.length === 0 ? <div className="p-12 text-center"><Users className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No guests match this view.</p></div> : <div className="divide-y divide-border">{guests.map(guest => <GuestRow key={guest.id} guest={guest} onEdit={() => setEditingId(guest.id)} onDelete={() => { if (window.confirm(`Remove ${guest.fullName}?`)) deleteGuest.mutate({ id: guest.id }, { onSuccess: () => { refresh(); toast({ title: "Guest deleted" }); } }); }} onToggle={() => (guest.status === "disabled" ? enable : disable).mutate({ id: guest.id }, { onSuccess: refresh })} onRegenerate={() => regenerate.mutate({ id: guest.id }, { onSuccess: () => { refresh(); toast({ title: "Invitation regenerated" }); } })} />)}</div>}</div>{(guestModal || editingId) && <GuestModal guest={editingId ? editingGuestQuery.data : undefined} loading={Boolean(editingId) && editingGuestQuery.isLoading} pending={createGuest.isPending || updateGuest.isPending} onClose={() => { setGuestModal(false); setEditingId(null); }} onSubmit={submitGuest} />}{importOpen && <ImportModal csv={csv} setCsv={setCsv} pending={importer.isPending} result={importResult} onClose={() => { setImportOpen(false); setImportResult(null); }} onSubmit={importGuests} />}</section>;
}

function GuestRow({ guest, onEdit, onDelete, onToggle, onRegenerate }: { guest: AdminGuest; onEdit: () => void; onDelete: () => void; onToggle: () => void; onRegenerate: () => void }) {
  const link = invitationUrl(guest.invitationToken);
  const isTest = guest.notes?.toLowerCase().includes("development test guest");
  return <article className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-guest-${guest.id}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{guest.fullName}</p>{isTest && <StatusPill>Development test</StatusPill>}</div><p className="mt-1 text-xs text-muted-foreground">{guest.email || guest.phone || "No contact details"}</p><div className="mt-3 flex flex-wrap items-center gap-2"><StatusPill tone={guest.rsvpStatus === "yes" ? "good" : guest.rsvpStatus === "no" ? "bad" : "warm"}>{guest.rsvpStatus}</StatusPill>{guest.checkedInAt ? <StatusPill tone="good">Checked in</StatusPill> : <StatusPill>Not checked in</StatusPill>}<span className="mono-font text-xs text-muted-foreground">{guest.invitationCode}</span><span className="text-xs text-muted-foreground">· {guest.admittedCount}/{guest.admissionLimit} admitted</span></div></div><div className="flex flex-wrap justify-start gap-1 sm:max-w-[420px] sm:justify-end"><a href={link} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-accent hover:bg-muted"><ExternalLink className="h-4 w-4" /> View</a><button className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-muted-foreground hover:bg-muted" onClick={() => copyText(link, "Invitation link")}><Copy className="h-4 w-4" /> Link</button><button className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-muted-foreground hover:bg-muted" onClick={() => copyText(guest.invitationCode, "Invitation code")}><Copy className="h-4 w-4" /> Code</button><a href={`https://wa.me/?text=${encodeURIComponent(`Pa Emmanuel memorial invitation for ${guest.fullName}: ${link}`)}`} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-muted-foreground hover:bg-muted"><Phone className="h-4 w-4" /> WhatsApp</a><a href={`https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-muted-foreground hover:bg-muted"><QrCode className="h-4 w-4" /> QR</a><button className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Edit guest" onClick={onEdit}><Pencil className="h-4 w-4" /></button><button className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Regenerate invitation" onClick={onRegenerate}><RefreshCw className="h-4 w-4" /></button><button className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-muted" title={guest.status === "disabled" ? "Enable invitation" : "Disable invitation"} onClick={onToggle}>{guest.status === "disabled" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</button><button className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-[#f4dfdc] hover:text-destructive" title="Delete guest" onClick={onDelete}><Trash2 className="h-4 w-4" /></button></div></article>;
}

function GuestModal({ guest, loading, pending, onClose, onSubmit }: { guest?: AdminGuest; loading?: boolean; pending: boolean; onClose: () => void; onSubmit: (data: { fullName: string; phone: string; email: string; notes: string; admissionLimit: number }) => void }) {
  const [form, setForm] = useState({ fullName: guest?.fullName || "", phone: guest?.phone || "", email: guest?.email || "", notes: guest?.notes || "", admissionLimit: guest?.admissionLimit || 1 });
  useEffect(() => { if (guest) setForm({ fullName: guest.fullName, phone: guest.phone || "", email: guest.email || "", notes: guest.notes || "", admissionLimit: guest.admissionLimit }); }, [guest]);
  return <Modal title={guest ? "Edit guest" : "Add a guest"} onClose={onClose}>{loading ? <LoadingBlock label="Opening guest details" /> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit(form); }}><Field label="Full name" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><Field label="Email (optional)" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div><Field label="Admission limit" type="number" min={1} value={form.admissionLimit} onChange={e => setForm({ ...form, admissionLimit: Math.max(1, Number(e.target.value)) })} /><TextField label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || !form.fullName.trim()}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{guest ? "Save changes" : "Create invitation"}</Button></div></form>}</Modal>;
}

function parsePastePreview(value: string) {
  const delimiter = value.includes("\t") ? "\t" : ",";
  return value.split(/\r?\n/).filter(line => line.trim()).slice(0, 8).map(line => line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, "")));
}

function ImportModal({ csv, setCsv, pending, result, onClose, onSubmit }: { csv: string; setCsv: (value: string) => void; pending: boolean; result: { created: number; errors: number; duplicates: number } | null; onClose: () => void; onSubmit: () => void }) {
  const preview = parsePastePreview(csv);
  return <Modal title="Paste guest list" onClose={onClose}><p className="text-sm leading-6 text-muted-foreground">Copy rows directly from Excel, Google Sheets, or LibreOffice. Use columns: full_name, email, phone, admission_limit. A preview appears before import.</p><TextField label="Guest list" value={csv} onChange={e => setCsv(e.target.value)} placeholder={"Full Name\tEmail\tPhone\tAdmission Limit"} />{preview.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-border"><p className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">{Math.max(0, preview.length - 1)} guest rows previewed</p><table className="w-full min-w-[520px] text-left text-xs"><tbody>{preview.map((row, index) => <tr key={index} className="border-b border-border last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className={`px-3 py-2 ${index === 0 ? "font-bold" : ""}`}>{cell || "—"}</td>)}</tr>)}</tbody></table></div>}{result && <div className="mt-4 rounded-xl bg-[#e1ecdf] p-4 text-sm text-[#355e3b]"><p className="font-bold">Successfully imported: {result.created}</p><p>Failed / invalid: {result.errors}</p><p>Duplicates: {result.duplicates}</p></div>}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Close</Button><Button disabled={pending || !csv.trim()} onClick={onSubmit}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Import guests</Button></div></Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#252a3a]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-card p-6 shadow-2xl sm:rounded-[2rem] sm:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="display-font text-3xl">{title}</h2><button onClick={onClose} className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}

function AccessCodeGate({ code: _code, title, description, storageKey, children }: { code: string; title: string; description: string; storageKey: string; children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === "unlocked");
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  if (unlocked) return <>{children}</>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(false);
    try {
      const response = await fetch(`${basePath}/api/staff/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: input.trim() }) });
      if (!response.ok) throw new Error("invalid");
      window.sessionStorage.setItem(storageKey, "unlocked");
      setUnlocked(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#e8dfd0] px-4 py-8"><form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-border bg-card p-7 text-center soft-shadow"><BrandMark /><p className="mono-font mt-8 text-xs uppercase text-accent">Private access</p><h1 className="display-font mt-3 text-4xl">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p><input autoFocus inputMode="numeric" type="password" value={input} onChange={event => { setInput(event.target.value); setError(false); }} placeholder="Enter access code" aria-label="Access code" className="focus-ring mt-7 h-12 w-full rounded-xl border border-input bg-background px-4 text-center font-mono tracking-[.4em] outline-none" />{error && <p className="mt-3 text-xs font-semibold text-destructive">That code is not correct.</p>}<Button type="submit" disabled={pending || !input.trim()} className="mt-5 w-full">{pending && <Loader2 className="h-4 w-4 animate-spin" />}Continue</Button><Link href="/" className="mt-5 inline-block text-sm font-bold text-accent">Return to memorial</Link></form></div>;
}

function FamilyDashboardGate({ children }: { children: ReactNode }) {
  return <AccessCodeGate code="2011" title="Family dashboard" description="Enter the family code to open the private dashboard." storageKey="family-dashboard-unlocked">{children}</AccessCodeGate>;
}

function CheckInPage() {
  return <AccessCodeGate code="30" title="Usher access" description="Enter the usher code to open the admission desk." storageKey="usher-access-unlocked"><CheckInWorkspace /></AccessCodeGate>;
}

function CheckInWorkspace() {
  const [code, setCode] = useState("");
  const lookup = useLookupInvitation();
  const admit = useAdmitInvitation();
  const checkIns = useListCheckIns(undefined, { query: { queryKey: getListCheckInsQueryKey() } });
  const [result, setResult] = useState<AdminGuest | null>(null);
  const [numberAdmitted, setNumberAdmitted] = useState(1);
  const [message, setMessage] = useState("");
  const find = () => { setMessage(""); setResult(null); lookup.mutate({ data: { code: code.trim() } }, { onSuccess: response => { if (response.invitation) { setResult(response.invitation); setNumberAdmitted(Math.min(1, response.invitation.admissionLimit - response.invitation.admittedCount)); } else setMessage(response.result === "invalid" ? "Invitation not found. Please check your invitation code." : response.result === "used" ? "Invitation already used." : "This invitation is disabled."); }, onError: () => setMessage("Invitation not found. Please check your invitation code.") }); };
  const admitGuest = () => { if (!result) return; admit.mutate({ id: result.invitationId, data: { numberAdmitted } }, { onSuccess: response => { if (response.invitation) { setResult(response.invitation); setMessage("Guest admitted successfully."); toast({ title: "Guest admitted" }); queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey() }); } else setMessage(response.result === "limit_exceeded" ? "That would exceed this invitation's admission limit." : response.result === "used" ? "Invitation already used." : "This invitation is unavailable."); }, onError: () => setMessage("Something went wrong. Please try again.") }); };
  const remaining = result ? Math.max(0, result.admissionLimit - result.admittedCount) : 0;
  return <main className="grain min-h-[100dvh] bg-[#252a3a] text-background"><div className="mx-auto max-w-2xl px-5 py-7 sm:py-10"><div className="flex items-center justify-between"><BrandMark dark /><Link href="/admin" className="focus-ring text-xs font-bold uppercase tracking-[.1em] text-background/60">Family dashboard</Link></div><div className="py-14 sm:py-20"><p className="mono-font text-xs uppercase text-[#e1b47d]">Arrival desk</p><h1 className="display-font mt-4 text-5xl leading-tight sm:text-7xl">Welcome them in.</h1><p className="mt-5 max-w-md leading-7 text-background/60">Enter the friendly invitation code, verify the guest's name, and admit the correct number of people.</p><div className="mt-10 rounded-[2rem] bg-background p-6 text-foreground sm:p-8"><label className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">Invitation code</label><div className="mt-3 flex gap-2"><input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && find()} placeholder="ABATAN-0000" className="focus-ring h-14 min-w-0 flex-1 rounded-2xl border border-input bg-card px-4 font-mono text-lg uppercase tracking-[.1em] outline-none" /><Button onClick={find} disabled={lookup.isPending || code.trim().length < 4} className="h-14 shrink-0 px-5">{lookup.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}<span className="hidden sm:inline">Look up invitation</span></Button></div>{message && <div className={`mt-5 rounded-xl p-4 text-sm font-semibold ${message.includes("successfully") ? "bg-[#e1ecdf] text-[#355e3b]" : "bg-[#f2d8d5] text-[#713e3b]"}`}>{message}</div>}{result && <div className="mt-6 rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.1em] text-muted-foreground">Invitation found</p><h2 className="display-font mt-2 text-3xl">{result.fullName}</h2><p className="mt-1 text-sm text-muted-foreground">{result.admittedCount} of {result.admissionLimit} admitted · {result.rsvpStatus === "yes" ? "RSVP confirmed" : "RSVP pending"}</p></div><StatusPill tone={remaining === 0 ? "good" : "warm"}>{remaining === 0 ? "used" : "available"}</StatusPill></div>{remaining > 0 ? <div className="mt-6 space-y-3"><Field label={`Number to admit (up to ${remaining})`} type="number" min={1} max={remaining} value={numberAdmitted} onChange={e => setNumberAdmitted(Math.max(1, Math.min(remaining, Number(e.target.value))))} /><Button className="w-full" onClick={admitGuest} disabled={admit.isPending}>{admit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Admit guest</Button></div> : <div className="mt-6 flex items-center gap-2 text-sm font-bold text-[#46704e]"><CheckCircle2 className="h-5 w-5" /> Invitation already used.</div>}</div>}</div><div className="mt-10 flex items-center justify-between"><div><p className="mono-font text-[10px] uppercase text-background/40">Today</p><p className="mt-1 text-sm text-background/70">{checkIns.data?.length ?? 0} admission records</p></div><Link href="/admin/check-ins" className="flex items-center gap-2 text-sm font-bold text-secondary">See history <ArrowRight className="h-4 w-4" /></Link></div></div></div></main>;
}

function CheckInsPage() {
  return <AccessCodeGate code="2011" title="Family overview" description="This private history is reserved for the family team." storageKey="family-history-unlocked"><CheckInsWorkspace /></AccessCodeGate>;
}

function CheckInsWorkspace() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "checked_in">("all");
  const query = useListCheckIns({ search: search || undefined, filter }, { query: { queryKey: getListCheckInsQueryKey({ search: search || undefined, filter }) } });
  return <AdminShell><div className="mx-auto max-w-7xl"><p className="mono-font text-xs uppercase text-accent">Check-in history</p><h1 className="display-font mt-3 text-5xl tracking-[-.04em]">Arrivals, recorded.</h1><p className="mt-3 text-sm text-muted-foreground">A private record of each admission, including who confirmed it and how many people entered.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest or invitation code" className="focus-ring h-10 w-full rounded-full border border-input bg-card pl-9 pr-4 text-sm outline-none" /></div><select value={filter} onChange={e => setFilter(e.target.value as "all" | "checked_in")} className="h-10 rounded-full border border-input bg-card px-4 text-sm"><option value="all">All admissions</option><option value="checked_in">Recorded admissions</option></select></div><div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">{query.isLoading ? <LoadingBlock label="Loading check-in history" /> : query.isError ? <ErrorBlock label="Access denied. Admin access is required." onRetry={() => query.refetch()} /> : (query.data ?? []).length === 0 ? <p className="p-12 text-center text-sm text-muted-foreground">No check-ins recorded yet.</p> : <div className="divide-y divide-border">{(query.data ?? []).map(record => <CheckInRow key={record.id} record={record} />)}</div>}</div></div></AdminShell>;
}

function CheckInRow({ record }: { record: CheckInRecord }) {
  const [pending, setPending] = useState(false);
  const undo = async () => {
    if (!window.confirm(`Undo check-in for ${record.guestName}?`)) return;
    setPending(true);
    try {
      const response = await fetch(`${basePath}/api/admin/check-ins/${record.id}/undo`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Undo failed");
      toast({ title: "Check-in undone" });
      window.location.reload();
    } catch {
      toast({ title: "Could not undo check-in", description: "Please try again." });
    } finally {
      setPending(false);
    }
  };
  return <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{record.guestName}</p><p className="mono-font mt-1 text-xs text-muted-foreground">{record.invitationCode}</p></div><div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span>{record.numberAdmitted} {record.numberAdmitted === 1 ? "person" : "people"} admitted</span><span>{formatDate(record.checkedInAt, true)}</span><span>By {record.checkedInBy}</span><button onClick={undo} disabled={pending} className="font-bold text-destructive hover:underline disabled:opacity-50">Undo</button></div></div>;
}

function AuditPage() {
  const query = useListAuditLog({ query: { queryKey: getListAuditLogQueryKey() } });
  return <AdminShell><div className="mx-auto max-w-7xl"><p className="mono-font text-xs uppercase text-accent">Audit log</p><h1 className="display-font mt-3 text-5xl tracking-[-.04em]">A clear record.</h1><p className="mt-3 text-sm text-muted-foreground">Important changes are recorded for the authorized family admin.</p><div className="mt-8 rounded-3xl border border-border bg-card p-2">{query.isLoading ? <LoadingBlock label="Loading audit log" /> : query.isError ? <ErrorBlock label="Access denied. Admin access is required." onRetry={() => query.refetch()} /> : <ActivityList items={query.data ?? []} />}</div></div></AdminShell>;
}

function SettingsPage() {
  const eventQuery = useGetEvent();
  const programmeQuery = useListProgramme({ query: { queryKey: getListProgrammeQueryKey() } });
  const eventUpdate = useUpdateEvent();
  const createProgramme = useCreateProgrammeItem();
  const updateProgramme = useUpdateProgrammeItem();
  const deleteProgramme = useDeleteProgrammeItem();
  const uploadUrl = useRequestUploadUrl();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<Event>>({});
  const [programmeModal, setProgrammeModal] = useState<ProgrammeItem | "new" | null>(null);
  useEffect(() => { if (eventQuery.data) setForm(eventQuery.data); }, [eventQuery.data]);
  const update = (key: keyof Event, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = () => {
    const data = {
      deceasedName: form.deceasedName?.trim() || "",
      eventTitle: form.eventTitle?.trim() || "",
      waykeepDate: form.waykeepDate?.slice(0, 10) || "",
      burialDate: form.burialDate?.slice(0, 10) || "",
      year: form.year ?? null,
      venue: form.venue?.trim() || "",
      waykeepVenue: form.waykeepVenue?.trim() || "",
      burialVenue: form.burialVenue?.trim() || "",
      dressCode: form.dressCode?.trim() || "",
      biography: form.biography?.trim() || null,
      tribute: form.tribute?.trim() || null,
      importantInformation: form.importantInformation?.trim() || null,
      directions: form.directions?.trim() || null,
      contactInformation: form.contactInformation?.trim() || null,
      mapUrl: form.mapUrl?.trim() || null,
      photoUrl: form.photoUrl || null,
      backgroundImageUrl: form.backgroundImageUrl || null,
      asoEbiInformation: form.asoEbiInformation?.trim() || null,
    };
    eventUpdate.mutate({ data }, { onSuccess: event => { setForm(event); setSaved(true); qc.invalidateQueries({ queryKey: getGetEventQueryKey() }); toast({ title: "Settings saved" }); window.setTimeout(() => setSaved(false), 2200); }, onError: error => toast({ title: "Settings could not be saved", description: error instanceof Error ? error.message : "Please sign in with an authorized family admin account and try again." }) });
  };
  const upload = (file: File) => uploadUrl.mutate({ data: { name: file.name, size: file.size, contentType: file.type } }, { onSuccess: response => update("photoUrl", `/api/storage${response.objectPath}`) });
  const programme = (programmeQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const moveProgramme = (item: ProgrammeItem, direction: -1 | 1) => { const target = programme.find(candidate => candidate.sortOrder === item.sortOrder + direction); if (!target) return; updateProgramme.mutate({ id: item.id, data: { sortOrder: target.sortOrder } }, { onSuccess: () => updateProgramme.mutate({ id: target.id, data: { sortOrder: item.sortOrder } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProgrammeQueryKey() }) }) }); };
  return <AdminShell><div className="mx-auto max-w-6xl"><div className="flex items-end justify-between gap-5"><div><p className="mono-font text-xs uppercase text-accent">Event settings</p><h1 className="display-font mt-3 text-5xl tracking-[-.04em]">Keep the details true.</h1><p className="mt-3 text-sm text-muted-foreground">Edit what invited guests see on the memorial page.</p></div><Button onClick={save} disabled={eventUpdate.isPending || eventQuery.isLoading}>{eventUpdate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}{saved ? "Saved" : "Save changes"}</Button></div>{eventQuery.isError ? <div className="mt-8"><ErrorBlock label="Access denied. Admin access is required." onRetry={() => eventQuery.refetch()} /></div> : <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_.75fr]"><section className="rounded-3xl border border-border bg-card p-6 sm:p-8"><h2 className="display-font text-3xl">Memorial details</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Deceased name" value={form.deceasedName || ""} onChange={e => update("deceasedName", e.target.value)} /><Field label="Event title" value={form.eventTitle || ""} onChange={e => update("eventTitle", e.target.value)} /><Field label="Waykeep date" type="date" value={form.waykeepDate?.slice(0, 10) || ""} onChange={e => update("waykeepDate", e.target.value)} /><Field label="Waykeep venue" value={form.waykeepVenue || ""} onChange={e => update("waykeepVenue", e.target.value)} /><Field label="Burial date" type="date" value={form.burialDate?.slice(0, 10) || ""} onChange={e => update("burialDate", e.target.value)} /><Field label="Burial venue" value={form.burialVenue || ""} onChange={e => update("burialVenue", e.target.value)} /><Field label="Dress code" value={form.dressCode || ""} onChange={e => update("dressCode", e.target.value)} /><Field label="Legacy venue" hint="Kept for older integrations; use the separate venues above." value={form.venue || ""} onChange={e => update("venue", e.target.value)} /></div><div className="mt-4 space-y-4"><TextField label="Memorial description" value={form.biography || ""} onChange={e => update("biography", e.target.value)} /><TextField label="Tribute" value={form.tribute || ""} onChange={e => update("tribute", e.target.value)} /><TextField label="Important information" value={form.importantInformation || ""} onChange={e => update("importantInformation", e.target.value)} /><TextField label="Aso-Ebi information" hint="Use one line per detail. The public page will preserve the line breaks." value={form.asoEbiInformation || ""} onChange={e => update("asoEbiInformation", e.target.value)} /><TextField label="Directions" value={form.directions || ""} onChange={e => update("directions", e.target.value)} /><Field label="Map URL" value={form.mapUrl || ""} onChange={e => update("mapUrl", e.target.value)} /><Field label="Contact information" value={form.contactInformation || ""} onChange={e => update("contactInformation", e.target.value)} /></div></section><section className="space-y-6"><div className="rounded-3xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><h2 className="display-font text-3xl">Portrait</h2><p className="mt-1 text-xs text-muted-foreground">Use Pa Emmanuel's supplied portrait.</p></div><ImagePlus className="h-5 w-5 text-accent" /></div><img src={form.photoUrl || standingPhoto} alt="Current memorial portrait" className="mt-5 h-64 w-full rounded-2xl object-cover object-top" /><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-bold transition hover:bg-muted"><Upload className="h-4 w-4" /> Replace portrait<input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} /></label></div><ProgrammeEditor programme={programme} loading={programmeQuery.isLoading} modal={programmeModal} setModal={setProgrammeModal} create={createProgramme} update={updateProgramme} remove={deleteProgramme} move={moveProgramme} qc={qc} /></section></div>}{programmeModal && <ProgrammeModal item={programmeModal === "new" ? undefined : programmeModal} pending={createProgramme.isPending || updateProgramme.isPending} onClose={() => setProgrammeModal(null)} onSubmit={data => { if (programmeModal === "new") createProgramme.mutate({ data }, { onSuccess: () => { setProgrammeModal(null); qc.invalidateQueries({ queryKey: getListProgrammeQueryKey() }); toast({ title: "Programme saved" }); } }); else updateProgramme.mutate({ id: programmeModal.id, data }, { onSuccess: () => { setProgrammeModal(null); qc.invalidateQueries({ queryKey: getListProgrammeQueryKey() }); toast({ title: "Programme saved" }); } }); }} />}</div></AdminShell>;
}

function ProgrammeEditor({ programme, loading, modal, setModal, create, update, remove, move, qc }: { programme: ProgrammeItem[]; loading: boolean; modal: ProgrammeItem | "new" | null; setModal: (value: ProgrammeItem | "new" | null) => void; create: ReturnType<typeof useCreateProgrammeItem>; update: ReturnType<typeof useUpdateProgrammeItem>; remove: ReturnType<typeof useDeleteProgrammeItem>; move: (item: ProgrammeItem, direction: -1 | 1) => void; qc: ReturnType<typeof useQueryClient> }) {
  return <div className="rounded-3xl border border-border bg-card p-6"><div className="flex items-start justify-between"><div><h2 className="display-font text-3xl">Programme</h2><p className="mt-1 text-xs text-muted-foreground">Add, edit, delete, and reorder items.</p></div><Button className="min-h-9 px-3 text-xs" onClick={() => setModal("new")}><Plus className="h-4 w-4" /> Add</Button></div><div className="mt-5 space-y-2">{loading ? <LoadingBlock /> : programme.map((item, index) => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-muted/50 p-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="text-xs text-muted-foreground">{formatDate(item.date)} · {formatTime(item.time)}</p></div><button disabled={index === 0 || update.isPending} className="rounded-lg p-2 text-muted-foreground hover:bg-card disabled:opacity-30" onClick={() => move(item, -1)} title="Move up"><ArrowUp className="h-4 w-4" /></button><button disabled={index === programme.length - 1 || update.isPending} className="rounded-lg p-2 text-muted-foreground hover:bg-card disabled:opacity-30" onClick={() => move(item, 1)} title="Move down"><ArrowDown className="h-4 w-4" /></button><button className="rounded-lg p-2 text-muted-foreground hover:bg-card" onClick={() => setModal(item)}><Pencil className="h-4 w-4" /></button><button className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-destructive" onClick={() => window.confirm("Delete this programme item?") && remove.mutate({ id: item.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListProgrammeQueryKey() }); toast({ title: "Programme item deleted" }); } })}><Trash2 className="h-4 w-4" /></button></div>)}{!loading && programme.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">No programme items yet.</p>}</div></div>;
}

function ProgrammeModal({ item, pending, onClose, onSubmit }: { item?: ProgrammeItem; pending: boolean; onClose: () => void; onSubmit: (data: { title: string; date: string; time: string; location: string; description: string; sortOrder: number }) => void }) {
  const [form, setForm] = useState({ title: item?.title || "", date: item?.date?.slice(0, 10) || "", time: item?.time || "", location: item?.location || "", description: item?.description || "", sortOrder: item?.sortOrder || 0 });
  return <Modal title={item ? "Edit programme item" : "Add programme item"} onClose={onClose}><form className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit(form); }}><Field label="Title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Date" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /><Field label="Time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div><Field label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /><TextField label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><Field label="Order" type="number" min={0} value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || !form.title || !form.date}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save item</Button></div></form></Modal>;
}

function AuthPage({ mode }: { mode: "in" | "up" }) {
  if (!clerkPubKey) return <AuthFrame><div className="text-center"><Info className="mx-auto h-8 w-8 text-accent" /><h1 className="display-font mt-5 text-4xl">Family access</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Authentication is being prepared for this memorial workspace. Guests do not need an account.</p><Link href="/" className="mt-6 inline-flex text-sm font-bold text-accent">Return to memorial <ArrowRight className="ml-2 h-4 w-4" /></Link></div></AuthFrame>;
  if (mode === "up") return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#e8dfd0] px-4 py-8"><div className="w-full max-w-[440px]"><div className="mb-7 flex justify-center"><BrandMark /></div><ErrorBlock label="Guest accounts are not used. Please use the invitation link or code shared with you." /><div className="mt-5 text-center"><Link href="/sign-in" className="text-sm font-bold text-accent">Family or usher sign in</Link></div></div></div>;
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#e8dfd0] px-4 py-8"><div className="w-full max-w-[440px]"><div className="mb-7 flex justify-center"><BrandMark /></div><SignIn routing="path" path={`${basePath}/sign-in`} /></div></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/invite/:token" component={InvitePage} /><Route path="/check-in" component={CheckInPage} /><Route path="/admin" component={() => <FamilyDashboardGate><AdminPage /></FamilyDashboardGate>} /><Route path="/admin/guests" component={() => <FamilyDashboardGate><AdminPage /></FamilyDashboardGate>} /><Route path="/admin/invitations" component={() => <FamilyDashboardGate><AdminPage /></FamilyDashboardGate>} /><Route path="/admin/settings" component={() => <FamilyDashboardGate><SettingsPage /></FamilyDashboardGate>} /><Route path="/admin/event" component={() => <FamilyDashboardGate><SettingsPage /></FamilyDashboardGate>} /><Route path="/admin/check-ins" component={() => <FamilyDashboardGate><CheckInsPage /></FamilyDashboardGate>} /><Route path="/admin/audit" component={() => <FamilyDashboardGate><AuditPage /></FamilyDashboardGate>} /><Route path="/sign-in/*?" component={() => <AuthPage mode="in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="up" />} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  const content = <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
  if (!clerkPubKey) return content;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={{ theme: shadcn, cssLayerName: "clerk", options: { logoPlacement: "inside", logoLinkUrl: basePath || "/", logoImageUrl: `${window.location.origin}${basePath}${standingPhoto}` }, variables: { colorPrimary: "#8d5e4d", colorForeground: "#252a3a", colorMutedForeground: "#6e6b68", colorBackground: "#f7f2e8", colorInput: "#f7f2e8", colorInputForeground: "#252a3a", colorDanger: "#a34f47", colorNeutral: "#d8cbbb", fontFamily: "DM Sans", borderRadius: "1rem" } }} signInUrl={`${basePath}/sign-in`} routerPush={to => window.history.pushState({}, "", to)} routerReplace={to => window.history.replaceState({}, "", to)}>{content}</ClerkProvider>;
}

export default App;
