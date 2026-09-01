import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Copy,
  ExternalLink, Home as HomeIcon, ImagePlus, Info, Leaf, Link2, Loader2,
  LogIn, MapPin, Menu, Pencil, Phone, Plus, QrCode, RefreshCw, Search,
  Settings, ShieldCheck, Sparkles, Trash2, Upload, Users, X, XCircle
} from 'lucide-react';
import {
  getGetAdminDashboardQueryKey, getGetEventQueryKey, getGetGuestQueryKey,
  getGetPublicInvitationQueryKey, getListCheckInsQueryKey,
  getListGuestsQueryKey, getListProgrammeQueryKey, useAdmitInvitation,
  useCreateGuest, useCreateProgrammeItem, useDeleteGuest, useDeleteProgrammeItem,
  useDisableInvitation, useEnableInvitation, useGetAdminDashboard, useGetEvent,
  useGetGuest, useGetPublicInvitation, useHealthCheck, useImportGuests,
  useListCheckIns, useListGuests, useListProgramme,
  useLookupInvitation, useRegenerateInvitation, useRequestUploadUrl, useSubmitRsvp,
  useUpdateEvent, useUpdateGuest, useUpdateProgrammeItem,
  type AdminGuest, type Event, type ProgrammeItem
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient();
const standingPhoto = '/assets/pa-emmanuel-standing.jpg';
const seatedPhoto = '/assets/pa-emmanuel-seated.jpg';
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function formatDate(value?: string | null, long = false) {
  if (!value) return 'Date to be announced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return 'Time to be announced';
  return value;
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-lg',
    quiet: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-border bg-card/50 hover:bg-secondary',
    danger: 'bg-destructive text-destructive-foreground hover:opacity-90'
  };
  return <button className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="block space-y-2 text-sm font-semibold text-foreground">
    <span>{label}</span>
    <input className="focus-ring h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm font-normal outline-none transition focus:border-accent" {...props} />
    {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
  </label>;
}

function TextField({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="block space-y-2 text-sm font-semibold text-foreground">
    <span>{label}</span>
    <textarea className="focus-ring min-h-28 w-full resize-y rounded-xl border border-input bg-background/60 px-3 py-3 text-sm font-normal outline-none transition focus:border-accent" {...props} />
  </label>;
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warm' | 'bad' }) {
  const tones = { neutral: 'bg-muted text-muted-foreground', good: 'bg-[#dfeadf] text-[#355e3b]', warm: 'bg-[#f0dfc5] text-[#805d2e]', bad: 'bg-[#f2d8d5] text-[#87423d]' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${tones[tone]}`}>{children}</span>;
}

function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center rounded-3xl border border-border bg-card/60" data-testid="status-loading"><div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {label}</div></div>;
}

function ErrorBlock({ onRetry, label = 'We could not load this just now.' }: { onRetry?: () => void; label?: string }) {
  return <div className="rounded-3xl border border-[#dfb6b1] bg-[#f8e9e5] p-6 text-center" data-testid="status-error"><XCircle className="mx-auto mb-3 h-6 w-6 text-accent" /><p className="text-sm text-[#713e3b]">{label}</p>{onRetry && <Button variant="outline" className="mt-4 border-[#d7aaa5]" onClick={onRetry} data-testid="button-retry">Try again</Button>}</div>;
}

function BrandMark({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className="focus-ring inline-flex items-center gap-3" data-testid="link-brand">
    <img src="/logo.svg" alt="" className="h-9 w-9" />
    <span className={`display-font text-lg ${dark ? 'text-background' : 'text-foreground'}`}>Remembering Emmanuel</span>
  </Link>;
}

function PublicNav() {
  return <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10">
    <BrandMark dark />
    <nav className="hidden items-center gap-8 text-sm font-semibold text-background/75 md:flex">
      <a href="#details" className="transition hover:text-background" data-testid="link-event-details">The gathering</a>
      <a href="#programme" className="transition hover:text-background" data-testid="link-programme">Programme</a>
      <Link href="/check-in" className="focus-ring inline-flex items-center gap-2 rounded-full border border-background/25 px-4 py-2 text-background transition hover:bg-background/10" data-testid="link-usher-checkin"><ShieldCheck className="h-4 w-4" /> Usher access</Link>
    </nav>
    <Link href="/sign-in" className="focus-ring rounded-full border border-background/30 px-4 py-2 text-xs font-bold uppercase tracking-[.12em] text-background md:hidden" data-testid="link-mobile-signin">Family sign in</Link>
  </header>;
}

function Home() {
  const eventQuery = useGetEvent();
  const programmeQuery = useListProgramme({ query: { queryKey: getListProgrammeQueryKey() } });
  const event = eventQuery.data;
  const programme = (programmeQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const loading = eventQuery.isLoading || programmeQuery.isLoading;
  return <main className="grain min-h-[100dvh] bg-background">
    <section className="relative isolate min-h-[720px] overflow-hidden bg-[#252a3a] text-background">
      <img src={event?.backgroundImageUrl || standingPhoto} alt="Pa Emmanuel Ayodele Abatan" className="absolute inset-0 -z-20 h-full w-full object-cover object-top opacity-35" data-testid="img-hero-portrait" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#252a3a_10%,rgba(37,42,58,.83)_42%,rgba(37,42,58,.38)_100%)]" />
      <PublicNav />
      <div className="mx-auto flex min-h-[720px] max-w-7xl items-end px-5 pb-16 pt-32 lg:items-center lg:px-10 lg:pb-4">
        <div className="max-w-2xl">
          <p className="mono-font memorial-rise mb-7 text-xs uppercase text-[#e1b47d]">A life held in memory · {event?.year || ''}</p>
          <h1 className="display-font memorial-rise max-w-xl text-5xl leading-[1.03] tracking-[-.04em] sm:text-7xl lg:text-[88px]" data-testid="text-deceased-name">{event?.deceasedName || 'Pa Emmanuel Ayodele Abatan'}</h1>
          <p className="memorial-rise-delay mt-6 max-w-lg text-lg leading-8 text-background/72">{event?.eventTitle || 'In loving memory'}</p>
          <div className="memorial-rise-delay-2 mt-9 flex flex-wrap gap-3">
            <a href="#details" className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full bg-secondary px-6 text-sm font-bold text-secondary-foreground transition hover:-translate-y-0.5" data-testid="link-remember-details">Remember with us <ArrowRight className="h-4 w-4" /></a>
            <Link href="/sign-in" className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full border border-background/30 px-6 text-sm font-semibold text-background transition hover:bg-background/10" data-testid="link-family-signin"><LogIn className="h-4 w-4" /> Family access</Link>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-5 hidden max-w-xs pb-16 text-right text-xs text-background/55 lg:block lg:right-10"><span className="mono-font text-[#e1b47d]">01</span><br />A quiet place to gather<br />and give thanks.</div>
    </section>

    <section id="details" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:py-28">
      <div className="memorial-rise">
        <p className="mono-font text-xs uppercase text-accent">The gathering</p>
        <h2 className="display-font mt-5 max-w-xl text-4xl leading-tight tracking-[-.03em] sm:text-6xl">A time to be close, to reflect, and to say thank you.</h2>
        <p className="mt-7 max-w-xl text-base leading-8 text-muted-foreground">{event?.biography || 'The family welcomes invited guests to gather in remembrance.'}</p>
        {event?.tribute && <blockquote className="mt-8 border-l-2 border-secondary pl-5 font-serif text-xl italic leading-8 text-foreground/80">{event.tribute}</blockquote>}
      </div>
      <div className="rounded-[2rem] bg-[#e7dcc8] p-7 sm:p-9" data-testid="card-event-details">
        {loading ? <div className="space-y-6"><div className="h-5 w-32 animate-pulse rounded bg-foreground/10" /><div className="h-20 animate-pulse rounded bg-foreground/10" /><div className="h-20 animate-pulse rounded bg-foreground/10" /></div> :
          <div className="space-y-7">
            <div><p className="mono-font text-[10px] uppercase text-accent">Waykeep</p><p className="display-font mt-2 text-3xl">{formatDate(event?.waykeepDate, true)}</p></div>
            <div className="h-px bg-foreground/10" />
            <div><p className="mono-font text-[10px] uppercase text-accent">Burial service</p><p className="display-font mt-2 text-3xl">{formatDate(event?.burialDate, true)}</p></div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>{event?.venue || 'Venue details to be announced'}</span></div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span>{event?.dressCode || 'Dress code details to be announced'}</span></div>
            {event?.mapUrl && <a href={event.mapUrl} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-accent" data-testid="link-map">Open directions <ExternalLink className="h-4 w-4" /></a>}
          </div>}
      </div>
    </section>

    <section id="programme" className="border-y border-border bg-[#ebe4d8]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.7fr_1.3fr] lg:px-10 lg:py-24">
        <div><p className="mono-font text-xs uppercase text-accent">02 · Programme</p><h2 className="display-font mt-5 text-4xl leading-tight sm:text-5xl">The shape of the days.</h2><p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">Please keep this page close. Programme details are shared here as the family confirms them.</p></div>
        <div className="space-y-3" data-testid="list-programme">
          {programmeQuery.isLoading && <LoadingBlock label="Preparing the programme" />}
          {programmeQuery.isError && <ErrorBlock onRetry={() => programmeQuery.refetch()} />}
          {!programmeQuery.isLoading && !programmeQuery.isError && programme.length === 0 && <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground" data-testid="empty-programme">Programme details will appear here.</div>}
          {programme.map((item, index) => <div key={item.id} className="group flex gap-4 rounded-2xl bg-card/70 p-5 transition hover:bg-card" data-testid={`card-programme-${item.id}`}><div className="mono-font pt-1 text-xs text-accent">0{index + 1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="display-font text-2xl">{item.title}</h3><span className="text-xs font-bold text-muted-foreground">{formatDate(item.date)}{item.time ? ` · ${formatTime(item.time)}` : ''}</span></div>{item.location && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><MapPin className="h-3 w-3" /> {item.location}</p>}{item.description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>}</div><ChevronRight className="mt-1 h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" /></div>)}
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:grid-cols-[.8fr_1.2fr] sm:items-center lg:px-10 lg:py-28">
      <img src={seatedPhoto} alt="Pa Emmanuel Ayodele Abatan seated for a portrait" className="mx-auto max-h-[600px] w-full max-w-sm rounded-[2rem] object-cover object-top soft-shadow" data-testid="img-seated-portrait" />
      <div><p className="mono-font text-xs uppercase text-accent">03 · In his own place</p><h2 className="display-font mt-5 max-w-xl text-4xl leading-tight sm:text-6xl">A gentle invitation for those who knew him.</h2><p className="mt-6 max-w-lg leading-8 text-muted-foreground">{event?.importantInformation || 'Please bring your invitation with you. The family looks forward to welcoming you.'}</p>{event?.contactInformation && <p className="mt-6 flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-accent" /> {event.contactInformation}</p>}</div>
    </section>
    <footer className="bg-[#252a3a] px-5 py-10 text-background lg:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-center"><BrandMark dark /><p className="text-xs text-background/55">Made with care for the Abatan family.</p></div></footer>
  </main>;
}

function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const invitationQuery = useGetPublicInvitation(token, { query: { queryKey: getGetPublicInvitationQueryKey(token), enabled: Boolean(token) } });
  const rsvp = useSubmitRsvp();
  const invitation = invitationQuery.data;
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const copy = async () => { await navigator.clipboard?.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const submit = (response: 'yes' | 'no') => rsvp.mutate({ token, data: { response } }, { onSuccess: () => setSubmitted(true) });
  if (invitationQuery.isLoading) return <AuthFrame><LoadingBlock label="Opening your invitation" /></AuthFrame>;
  if (invitationQuery.isError || !invitation) return <AuthFrame><ErrorBlock label="This invitation link could not be found. Please check the link shared with you." onRetry={() => invitationQuery.refetch()} /></AuthFrame>;
  const event = invitation.event;
  return <main className="grain min-h-[100dvh] bg-[#e8dfd0] px-4 py-6 sm:py-10"><div className="mx-auto max-w-4xl"><div className="mb-8 flex items-center justify-between"><BrandMark /><Link href="/" className="focus-ring text-xs font-bold uppercase tracking-[.12em] text-muted-foreground" data-testid="link-invite-home">Memorial home</Link></div><div className="overflow-hidden rounded-[2rem] bg-card soft-shadow"><div className="grid md:grid-cols-[.9fr_1.1fr]"><div className="relative min-h-[460px] bg-[#252a3a]"><img src={event.photoUrl || standingPhoto} alt="Pa Emmanuel Ayodele Abatan" className="absolute inset-0 h-full w-full object-cover object-top opacity-80" data-testid="img-invitation-portrait" /><div className="absolute inset-0 bg-gradient-to-t from-[#252a3a] via-transparent to-transparent" /><div className="absolute bottom-7 left-7 text-background"><p className="mono-font text-[10px] uppercase text-[#e1b47d]">Personal invitation</p><p className="display-font mt-2 text-3xl">{invitation.guestName}</p><p className="mt-1 text-sm text-background/65">You are warmly invited to gather in his memory.</p></div></div><div className="p-7 sm:p-10"><p className="mono-font text-xs uppercase text-accent">For {invitation.guestName}</p><h1 className="display-font mt-4 text-4xl leading-tight">A place has been kept for you.</h1><p className="mt-5 leading-7 text-muted-foreground">Please confirm whether you will join the family. Your invitation admits <strong className="text-foreground">{invitation.admissionLimit} {invitation.admissionLimit === 1 ? 'person' : 'people'}</strong>.</p><div className="my-8 space-y-4 border-y border-border py-6"><div className="flex gap-4"><CalendarDays className="mt-1 h-5 w-5 text-accent" /><div><p className="font-bold">Waykeep · {formatDate(event.waykeepDate, true)}</p><p className="mt-1 text-sm text-muted-foreground">{event.venue}</p></div></div><div className="flex gap-4"><Leaf className="mt-1 h-5 w-5 text-accent" /><div><p className="font-bold">Burial service · {formatDate(event.burialDate, true)}</p><p className="mt-1 text-sm text-muted-foreground">{event.dressCode}</p></div></div></div>{submitted || invitation.rsvpStatus !== 'pending' ? <div className="rounded-2xl bg-[#e1ecdf] p-5" data-testid="status-rsvp-success"><CheckCircle2 className="h-6 w-6 text-[#355e3b]" /><p className="mt-3 font-bold text-[#355e3b]">{invitation.rsvpStatus === 'no' ? 'Your response has been noted.' : 'Thank you for letting the family know.'}</p><p className="mt-1 text-sm text-[#4e6d51]">Your invitation code remains your admission pass.</p></div> : <div><p className="text-sm font-bold">Will you be joining us?</p><div className="mt-3 grid grid-cols-2 gap-3"><Button onClick={() => submit('yes')} disabled={rsvp.isPending} data-testid="button-rsvp-yes"><Check className="h-4 w-4" /> Yes, I will</Button><Button variant="outline" onClick={() => submit('no')} disabled={rsvp.isPending} data-testid="button-rsvp-no">Unable to attend</Button></div></div>}<div className="mt-6 flex flex-wrap gap-2"><Button variant="quiet" className="min-h-10 px-4 text-xs" onClick={copy} data-testid="button-copy-invitation"><Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy invitation'}</Button>{navigator.share && <Button variant="quiet" className="min-h-10 px-4 text-xs" onClick={() => navigator.share({ title: `Invitation for ${invitation.guestName}`, url: window.location.href })} data-testid="button-share-invitation"><Link2 className="h-4 w-4" /> Share</Button>}</div><p className="mono-font mt-8 text-[10px] uppercase text-muted-foreground">Code · {invitation.invitationCode}</p></div></div></div></div></main>;
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="grain flex min-h-[100dvh] items-center justify-center bg-[#e8dfd0] px-4 py-8"><div className="w-full max-w-xl"><div className="mb-8 flex justify-center"><BrandMark /></div><div className="rounded-[2rem] bg-card p-6 soft-shadow sm:p-10">{children}</div></div></main>;
}

function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const nav = [{ href: '/admin', label: 'Overview', icon: HomeIcon }, { href: '/admin#guests', label: 'Guests', icon: Users }, { href: '/admin/settings', label: 'Event settings', icon: Settings }];
  return <div className="grain min-h-[100dvh] bg-background md:flex"><aside className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-sidebar p-7 text-sidebar-foreground transition-transform duration-300 md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex items-center justify-between"><BrandMark dark /><button onClick={() => setOpen(false)} className="text-background/60 md:hidden" data-testid="button-close-menu"><X /></button></div><p className="mono-font mt-12 text-[10px] uppercase text-background/40">Family workspace</p><nav className="mt-4 space-y-2">{nav.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-background/70 transition hover:bg-sidebar-accent hover:text-background" data-testid={`link-admin-${item.label.toLowerCase().replaceAll(' ', '-')}`}><item.icon className="h-4 w-4" />{item.label}</Link>)}</nav><div className="absolute inset-x-7 bottom-8 rounded-2xl border border-background/10 bg-background/5 p-4"><p className="text-xs leading-5 text-background/60">A private space for keeping the welcome thoughtful and the details in order.</p><Link href="/check-in" className="mt-3 flex items-center gap-2 text-xs font-bold text-secondary" data-testid="link-sidebar-checkin"><QrCode className="h-4 w-4" /> Open usher check-in</Link></div></aside><div className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b border-border px-5 lg:px-10"><button className="rounded-full p-2 md:hidden" onClick={() => setOpen(true)} data-testid="button-open-menu"><Menu /></button><div className="hidden text-sm font-semibold text-muted-foreground md:block">Pa Emmanuel Ayodele Abatan</div><div className="flex items-center gap-4"><span className="hidden text-xs text-muted-foreground sm:block">Private family access</span><Link href="/" className="focus-ring text-xs font-bold text-accent" data-testid="link-admin-public">View memorial</Link></div></header><div className="px-5 py-8 lg:px-10 lg:py-12">{children}</div></div></div>;
}

function StatCard({ label, value, detail, icon: Icon, tone = 'default' }: { label: string; value?: number; detail: string; icon: typeof Users; tone?: 'default' | 'warm' | 'green' }) {
  return <div className={`rounded-2xl border border-border p-5 ${tone === 'warm' ? 'bg-[#f0dfc5]' : tone === 'green' ? 'bg-[#e1ecdf]' : 'bg-card'}`}><div className="flex items-start justify-between"><p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-accent" /></div><p className="display-font mt-5 text-4xl" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value ?? '—'}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function AdminPage() {
  const dashboard = useGetAdminDashboard();
  const guestsQuery = useListGuests(undefined, { query: { queryKey: getListGuestsQueryKey() } });
  const health = useHealthCheck();
  const [search, setSearch] = useState('');
  const [guestModal, setGuestModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const createGuest = useCreateGuest();
  const updateGuest = useUpdateGuest();
  const deleteGuest = useDeleteGuest();
  const disable = useDisableInvitation();
  const enable = useEnableInvitation();
  const regenerate = useRegenerateInvitation();
  const importer = useImportGuests();
  const qc = useQueryClient();
  const guests = (guestsQuery.data ?? []).filter(g => g.fullName.toLowerCase().includes(search.toLowerCase()) || g.invitationCode.toLowerCase().includes(search.toLowerCase()));
  const editingGuestQuery = useGetGuest(editingId ?? 0, { query: { enabled: Boolean(editingId), queryKey: getGetGuestQueryKey(editingId ?? 0) } });
  const refreshGuests = () => { qc.invalidateQueries({ queryKey: getListGuestsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() }); };
  const submitGuest = (data: { fullName: string; phone: string; email: string; notes: string; admissionLimit: number }) => {
    if (editingId) updateGuest.mutate({ id: editingId, data }, { onSuccess: () => { setEditingId(null); refreshGuests(); } });
    else createGuest.mutate({ data }, { onSuccess: () => { setGuestModal(false); refreshGuests(); } });
  };
  return <AdminShell><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono-font text-xs uppercase text-accent">Overview</p><h1 className="display-font mt-3 text-5xl tracking-[-.04em]">A considered welcome.</h1><p className="mt-3 text-sm text-muted-foreground">Keep a clear view of who is coming, and make arrival feel easy.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-guests"><Upload className="h-4 w-4" /> Import list</Button><Button onClick={() => { setEditingId(null); setGuestModal(true); }} data-testid="button-add-guest"><Plus className="h-4 w-4" /> Add guest</Button></div></div>{dashboard.isError ? <div className="mt-8"><ErrorBlock label="Family dashboard access is required to see attendance metrics." onRetry={() => dashboard.refetch()} /></div> : dashboard.isLoading ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div> : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Invited" value={dashboard.data?.totalInvited} detail={`${dashboard.data?.pending ?? 0} awaiting response`} icon={Users} /><StatCard label="Confirmed" value={dashboard.data?.confirmed} detail={`${dashboard.data?.rsvpYes ?? 0} said yes`} icon={CheckCircle2} tone="green" /><StatCard label="Checked in" value={dashboard.data?.checkedIn} detail={`${dashboard.data?.notCheckedIn ?? 0} yet to arrive`} icon={ShieldCheck} tone="warm" /><StatCard label="Not attending" value={dashboard.data?.rsvpNo} detail={`${dashboard.data?.disabled ?? 0} disabled passes`} icon={XCircle} /></div>}<div id="guests" className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mono-font text-xs uppercase text-accent">Guest list</p><h2 className="display-font mt-2 text-3xl">The people expected.</h2></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or code" className="focus-ring h-10 w-full rounded-full border border-input bg-card pl-9 pr-4 text-sm outline-none" data-testid="input-search-guests" /></div></div><div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">{guestsQuery.isLoading ? <LoadingBlock label="Loading guests" /> : guestsQuery.isError ? <ErrorBlock onRetry={() => guestsQuery.refetch()} /> : guests.length === 0 ? <div className="p-12 text-center" data-testid="empty-guests"><Users className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No guests match this view.</p><p className="mt-1 text-xs text-muted-foreground">Add a guest or try a different search.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-[.08em] text-muted-foreground"><tr><th className="px-5 py-4">Guest</th><th className="px-5 py-4">Pass</th><th className="px-5 py-4">Response</th><th className="px-5 py-4">Arrival</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody>{guests.map(guest => <GuestRow key={guest.id} guest={guest} onEdit={() => setEditingId(guest.id)} onDelete={() => { if (window.confirm(`Remove ${guest.fullName}?`)) deleteGuest.mutate({ id: guest.id }, { onSuccess: refreshGuests }); }} onToggle={() => (guest.status === 'disabled' ? enable : disable).mutate({ id: guest.id }, { onSuccess: refreshGuests })} onRegenerate={() => regenerate.mutate({ id: guest.id }, { onSuccess: refreshGuests })} />)}</tbody></table></div>}</div><p className="mt-4 text-xs text-muted-foreground"><span className="inline-block h-2 w-2 rounded-full bg-[#719d79]" /> {health.data?.status === 'ok' ? ' Services are ready' : ' Attendance updates are private to this workspace'}</p></div>{(guestModal || editingId) && <GuestModal guest={editingId ? editingGuestQuery.data : undefined} loading={Boolean(editingId) && editingGuestQuery.isLoading} pending={createGuest.isPending || updateGuest.isPending} onClose={() => { setGuestModal(false); setEditingId(null); }} onSubmit={submitGuest} />}{importOpen && <ImportModal csv={csv} setCsv={setCsv} pending={importer.isPending} onClose={() => setImportOpen(false)} onSubmit={() => importer.mutate({ data: { csv } }, { onSuccess: () => { setImportOpen(false); setCsv(''); refreshGuests(); } })} />}</AdminShell>;
}

function GuestRow({ guest, onEdit, onDelete, onToggle, onRegenerate }: { guest: AdminGuest; onEdit: () => void; onDelete: () => void; onToggle: () => void; onRegenerate: () => void }) {
  const isDevelopmentTestGuest = guest.notes?.toLowerCase().includes('development test guest');
  return <tr className="border-b border-border last:border-0" data-testid={`row-guest-${guest.id}`}><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{guest.fullName}</p>{isDevelopmentTestGuest && <StatusPill tone="neutral">Development test</StatusPill>}</div><p className="mt-1 text-xs text-muted-foreground">{guest.email || guest.phone || 'No contact details'}</p></td><td className="px-5 py-4"><p className="mono-font text-xs">{guest.invitationCode}</p><p className="mt-1 text-xs text-muted-foreground">up to {guest.admissionLimit}</p></td><td className="px-5 py-4"><StatusPill tone={guest.rsvpStatus === 'yes' ? 'good' : guest.rsvpStatus === 'no' ? 'bad' : 'warm'}>{guest.rsvpStatus}</StatusPill></td><td className="px-5 py-4">{guest.checkedInAt ? <span className="flex items-center gap-1.5 text-xs font-semibold text-[#46704e]"><CheckCircle2 className="h-4 w-4" /> {formatDate(guest.checkedInAt)}</span> : <span className="text-xs text-muted-foreground">Not yet</span>}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button className="focus-ring rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" title="Edit guest" onClick={onEdit} data-testid={`button-edit-guest-${guest.id}`}><Pencil className="h-4 w-4" /></button><button className="focus-ring rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" title="Regenerate invitation" onClick={onRegenerate} data-testid={`button-regenerate-guest-${guest.id}`}><RefreshCw className="h-4 w-4" /></button><button className="focus-ring rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" title={guest.status === 'disabled' ? 'Enable invitation' : 'Disable invitation'} onClick={onToggle} data-testid={`button-toggle-guest-${guest.id}`}>{guest.status === 'disabled' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</button><button className="focus-ring rounded-lg p-2 text-muted-foreground transition hover:bg-[#f4dfdc] hover:text-destructive" title="Delete guest" onClick={onDelete} data-testid={`button-delete-guest-${guest.id}`}><Trash2 className="h-4 w-4" /></button></div></td></tr>;
}

function GuestModal({ guest, loading, pending, onClose, onSubmit }: { guest?: AdminGuest; loading?: boolean; pending: boolean; onClose: () => void; onSubmit: (data: { fullName: string; phone: string; email: string; notes: string; admissionLimit: number }) => void }) {
  const [form, setForm] = useState({ fullName: guest?.fullName || '', phone: guest?.phone || '', email: guest?.email || '', notes: guest?.notes || '', admissionLimit: guest?.admissionLimit || 1 });
  useEffect(() => { if (guest) setForm({ fullName: guest.fullName, phone: guest.phone || '', email: guest.email || '', notes: guest.notes || '', admissionLimit: guest.admissionLimit }); }, [guest]);
  return <Modal title={guest ? 'Edit guest' : 'Add a guest'} onClose={onClose}>{loading ? <LoadingBlock label="Opening guest details" /> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit(form); }}><Field label="Full name" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} data-testid="input-guest-name" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-guest-phone" /><Field label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-guest-email" /></div><Field label="Admission limit" type="number" min={1} value={form.admissionLimit} onChange={e => setForm({ ...form, admissionLimit: Number(e.target.value) })} data-testid="input-admission-limit" /><TextField label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-guest-notes" /><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-guest">Cancel</Button><Button type="submit" disabled={pending || !form.fullName.trim()} data-testid="button-save-guest">{pending && <Loader2 className="h-4 w-4 animate-spin" />} {guest ? 'Save changes' : 'Create invitation'}</Button></div></form>}</Modal>;
}

function ImportModal({ csv, setCsv, pending, onClose, onSubmit }: { csv: string; setCsv: (value: string) => void; pending: boolean; onClose: () => void; onSubmit: () => void }) {
  return <Modal title="Import a guest list" onClose={onClose}><p className="text-sm leading-6 text-muted-foreground">Paste CSV with columns for full name, phone, email, notes and admission limit.</p><TextField label="CSV data" value={csv} onChange={e => setCsv(e.target.value)} placeholder="Full name, phone, email, notes, admission limit" data-testid="input-guest-csv" /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-import">Cancel</Button><Button disabled={pending || !csv.trim()} onClick={onSubmit} data-testid="button-submit-import">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Import guests</Button></div></Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#252a3a]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true"><div className="w-full max-w-xl rounded-t-[2rem] bg-card p-6 shadow-2xl sm:rounded-[2rem] sm:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="display-font text-3xl">{title}</h2><button onClick={onClose} className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted" data-testid="button-close-modal"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}

function CheckInPage() {
  const [code, setCode] = useState('');
  const lookup = useLookupInvitation();
  const admit = useAdmitInvitation();
  const checkIns = useListCheckIns(undefined, { query: { queryKey: getListCheckInsQueryKey() } });
  const [result, setResult] = useState<AdminGuest | null>(null);
  const [message, setMessage] = useState('');
  const find = () => { setMessage(''); setResult(null); lookup.mutate({ data: { code: code.trim() } }, { onSuccess: response => { if (response.invitation) setResult(response.invitation); else setMessage(`This pass is ${response.result.replace('_', ' ')}.`); } }); };
  const admitGuest = () => { if (!result) return; admit.mutate({ id: result.invitationId }, { onSuccess: response => { if (response.invitation) { setResult(response.invitation); setMessage('Guest admitted.'); } else { setResult(current => current ? { ...current, status: response.result === 'used' ? 'checked_in' : 'disabled' } : current); setMessage(`This pass is ${response.result.replace('_', ' ')}.`); } } }); };
  return <main className="grain min-h-[100dvh] bg-[#252a3a] text-background"><div className="mx-auto max-w-2xl px-5 py-7 sm:py-10"><div className="flex items-center justify-between"><BrandMark dark /><Link href="/admin" className="focus-ring text-xs font-bold uppercase tracking-[.1em] text-background/60" data-testid="link-checkin-admin">Family dashboard</Link></div><div className="py-14 sm:py-20"><p className="mono-font text-xs uppercase text-[#e1b47d]">Arrival desk</p><h1 className="display-font mt-4 text-5xl leading-tight sm:text-7xl">Welcome them in.</h1><p className="mt-5 max-w-md leading-7 text-background/60">Search a guest's invitation code to confirm their place. This flow is designed for one hand, outdoors, and in a hurry.</p><div className="mt-10 rounded-[2rem] bg-background p-6 text-foreground sm:p-8"><label className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">Invitation code</label><div className="mt-3 flex gap-2"><input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && find()} placeholder="ABATAN-0000" className="focus-ring h-14 min-w-0 flex-1 rounded-2xl border border-input bg-card px-4 font-mono text-lg uppercase tracking-[.1em] outline-none" data-testid="input-checkin-code" /><Button onClick={find} disabled={lookup.isPending || code.trim().length < 4} className="h-14 shrink-0 px-5" data-testid="button-lookup-invitation">{lookup.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}<span className="hidden sm:inline">Find guest</span></Button></div>{message && <div className="mt-5 rounded-xl bg-[#f2d8d5] p-4 text-sm font-semibold text-[#713e3b]" data-testid="status-checkin-message">{message}</div>}{result && <div className="mt-6 rounded-2xl border border-border bg-card p-5" data-testid="card-checkin-result"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.1em] text-muted-foreground">Invitation found</p><h2 className="display-font mt-2 text-3xl">{result.fullName}</h2><p className="mt-1 text-sm text-muted-foreground">{result.admissionLimit} admitted · {result.rsvpStatus === 'yes' ? 'RSVP confirmed' : 'RSVP pending'}</p></div><StatusPill tone={result.status === 'checked_in' ? 'good' : 'warm'}>{result.status.replace('_', ' ')}</StatusPill></div>{result.status !== 'checked_in' && result.status !== 'disabled' ? <Button className="mt-6 w-full" onClick={admitGuest} disabled={admit.isPending} data-testid="button-admit-guest">{admit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Admit {result.fullName}</Button> : <div className="mt-6 flex items-center gap-2 text-sm font-bold text-[#46704e]"><CheckCircle2 className="h-5 w-5" /> {result.status === 'disabled' ? 'This invitation is disabled.' : 'Already checked in.'}</div>}</div>}</div><div className="mt-10 flex items-center justify-between"><div><p className="mono-font text-[10px] uppercase text-background/40">Today</p><p className="mt-1 text-sm text-background/70">{checkIns.data?.length ?? 0} arrivals recorded</p></div><Link href="/admin" className="flex items-center gap-2 text-sm font-bold text-secondary" data-testid="link-checkin-see-all">See full list <ArrowRight className="h-4 w-4" /></Link></div></div></div></main>;
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
  const [programmeModal, setProgrammeModal] = useState<ProgrammeItem | 'new' | null>(null);
  useEffect(() => { if (eventQuery.data) setForm(eventQuery.data); }, [eventQuery.data]);
  const update = (key: keyof Event, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = () => eventUpdate.mutate({ data: form }, { onSuccess: event => { setForm(event); setSaved(true); qc.invalidateQueries({ queryKey: getGetEventQueryKey() }); window.setTimeout(() => setSaved(false), 2200); } });
  const upload = (file: File) => uploadUrl.mutate({ data: { name: file.name, size: file.size, contentType: file.type } }, { onSuccess: response => update('photoUrl', `/api/storage${response.objectPath}`) });
  return <AdminShell><div className="mx-auto max-w-6xl"><div className="flex items-end justify-between gap-5"><div><p className="mono-font text-xs uppercase text-accent">Event settings</p><h1 className="display-font mt-3 text-5xl tracking-[-.04em]">Keep the details true.</h1><p className="mt-3 text-sm text-muted-foreground">Edit what invited guests see on the memorial page.</p></div><Button onClick={save} disabled={eventUpdate.isPending || eventQuery.isLoading} data-testid="button-save-event">{eventUpdate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}{saved ? 'Saved' : 'Save changes'}</Button></div>{eventQuery.isError ? <div className="mt-8"><ErrorBlock onRetry={() => eventQuery.refetch()} /></div> : <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_.75fr]"><section className="rounded-3xl border border-border bg-card p-6 sm:p-8"><h2 className="display-font text-3xl">Memorial details</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Deceased name" value={form.deceasedName || ''} onChange={e => update('deceasedName', e.target.value)} data-testid="input-event-name" /><Field label="Event title" value={form.eventTitle || ''} onChange={e => update('eventTitle', e.target.value)} data-testid="input-event-title" /><Field label="Waykeep date" type="date" value={form.waykeepDate?.slice(0, 10) || ''} onChange={e => update('waykeepDate', e.target.value)} data-testid="input-waykeep-date" /><Field label="Burial date" type="date" value={form.burialDate?.slice(0, 10) || ''} onChange={e => update('burialDate', e.target.value)} data-testid="input-burial-date" /><Field label="Venue" value={form.venue || ''} onChange={e => update('venue', e.target.value)} data-testid="input-event-venue" /><Field label="Dress code" value={form.dressCode || ''} onChange={e => update('dressCode', e.target.value)} data-testid="input-dress-code" /></div><div className="mt-4 space-y-4"><TextField label="Biography" value={form.biography || ''} onChange={e => update('biography', e.target.value)} data-testid="input-event-biography" /><TextField label="Tribute" value={form.tribute || ''} onChange={e => update('tribute', e.target.value)} data-testid="input-event-tribute" /><TextField label="Important information" value={form.importantInformation || ''} onChange={e => update('importantInformation', e.target.value)} data-testid="input-event-information" /><TextField label="Directions" value={form.directions || ''} onChange={e => update('directions', e.target.value)} data-testid="input-event-directions" /><Field label="Map URL" value={form.mapUrl || ''} onChange={e => update('mapUrl', e.target.value)} data-testid="input-map-url" /><Field label="Contact information" value={form.contactInformation || ''} onChange={e => update('contactInformation', e.target.value)} data-testid="input-contact-information" /></div></section><section className="space-y-6"><div className="rounded-3xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><h2 className="display-font text-3xl">Photos</h2><p className="mt-1 text-xs text-muted-foreground">Use Pa Emmanuel's supplied portraits only.</p></div><ImagePlus className="h-5 w-5 text-accent" /></div><img src={form.photoUrl || standingPhoto} alt="Current memorial portrait" className="mt-5 h-64 w-full rounded-2xl object-cover object-top" data-testid="img-settings-photo" /><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-bold transition hover:bg-muted"><Upload className="h-4 w-4" /> Replace portrait<input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} data-testid="input-upload-photo" /></label></div><div className="rounded-3xl border border-border bg-card p-6"><div className="flex items-start justify-between"><div><h2 className="display-font text-3xl">Programme</h2><p className="mt-1 text-xs text-muted-foreground">Order shown on the public page.</p></div><Button className="min-h-9 px-3 text-xs" onClick={() => setProgrammeModal('new')} data-testid="button-add-programme"><Plus className="h-4 w-4" /> Add</Button></div><div className="mt-5 space-y-2">{programmeQuery.isLoading ? <LoadingBlock /> : (programmeQuery.data ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3" data-testid={`row-programme-${item.id}`}><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="text-xs text-muted-foreground">{formatDate(item.date)} · {formatTime(item.time)}</p></div><button className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-card" onClick={() => setProgrammeModal(item)} data-testid={`button-edit-programme-${item.id}`}><Pencil className="h-4 w-4" /></button><button className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-destructive" onClick={() => window.confirm('Delete this programme item?') && deleteProgramme.mutate({ id: item.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProgrammeQueryKey() }) })} data-testid={`button-delete-programme-${item.id}`}><Trash2 className="h-4 w-4" /></button></div>)}{!programmeQuery.isLoading && (programmeQuery.data ?? []).length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">No programme items yet.</p>}</div></div></section></div>}{programmeModal && <ProgrammeModal item={programmeModal === 'new' ? undefined : programmeModal} pending={createProgramme.isPending || updateProgramme.isPending} onClose={() => setProgrammeModal(null)} onSubmit={data => { if (programmeModal === 'new') createProgramme.mutate({ data }, { onSuccess: () => { setProgrammeModal(null); qc.invalidateQueries({ queryKey: getListProgrammeQueryKey() }); } }); else updateProgramme.mutate({ id: programmeModal.id, data }, { onSuccess: () => { setProgrammeModal(null); qc.invalidateQueries({ queryKey: getListProgrammeQueryKey() }); } }); }} />}</div></AdminShell>;
}

function Protected({ children }: { children: ReactNode }) {
  if (!clerkPubKey) return <>{children}</>;
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthFrame><LoadingBlock label="Checking family access" /></AuthFrame>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function ProgrammeModal({ item, pending, onClose, onSubmit }: { item?: ProgrammeItem; pending: boolean; onClose: () => void; onSubmit: (data: { title: string; date: string; time: string; location: string; description: string; sortOrder: number }) => void }) {
  const [form, setForm] = useState({ title: item?.title || '', date: item?.date?.slice(0, 10) || '', time: item?.time || '', location: item?.location || '', description: item?.description || '', sortOrder: item?.sortOrder || 0 });
  return <Modal title={item ? 'Edit programme item' : 'Add programme item'} onClose={onClose}><form className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit(form); }}><Field label="Title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-programme-title" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Date" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} data-testid="input-programme-date" /><Field label="Time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} data-testid="input-programme-time" /></div><Field label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} data-testid="input-programme-location" /><TextField label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="input-programme-description" /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-programme">Cancel</Button><Button type="submit" disabled={pending || !form.title || !form.date} data-testid="button-save-programme">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save item</Button></div></form></Modal>;
}

function AuthPage({ mode }: { mode: 'in' | 'up' }) {
  if (!clerkPubKey) return <AuthFrame><div className="text-center"><Info className="mx-auto h-8 w-8 text-accent" /><h1 className="display-font mt-5 text-4xl">Family access</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Authentication is being prepared for this memorial workspace. Please return to the public memorial.</p><Link href="/" className="mt-6 inline-flex text-sm font-bold text-accent" data-testid="link-auth-back">Return to memorial <ArrowRight className="ml-2 h-4 w-4" /></Link></div></AuthFrame>;
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#e8dfd0] px-4 py-8"><div className="w-full max-w-[440px]"><div className="mb-7 flex justify-center"><BrandMark /></div>{mode === 'in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}</div></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/invite/:token" component={InvitePage} /><Route path="/check-in" component={() => <Protected><CheckInPage /></Protected>} /><Route path="/admin" component={() => <Protected><AdminPage /></Protected>} /><Route path="/admin/settings" component={() => <Protected><SettingsPage /></Protected>} /><Route path="/admin/event" component={() => <Protected><SettingsPage /></Protected>} /><Route path="/sign-in/*?" component={() => <AuthPage mode="in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="up" />} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  const content = <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
  if (!clerkPubKey) return content;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={{ theme: shadcn, cssLayerName: 'clerk', options: { logoPlacement: 'inside', logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` }, variables: { colorPrimary: '#8d5e4d', colorForeground: '#252a3a', colorMutedForeground: '#6e6b68', colorBackground: '#f7f2e8', colorInput: '#f7f2e8', colorInputForeground: '#252a3a', colorDanger: '#a34f47', colorNeutral: '#d8cbbb', fontFamily: 'DM Sans', borderRadius: '1rem' } }} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={to => window.history.pushState({}, '', stripBase(to))} routerReplace={to => window.history.replaceState({}, '', stripBase(to))}>{content}</ClerkProvider>;
}

export default App;