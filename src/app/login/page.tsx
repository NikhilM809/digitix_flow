import { ClipboardList, FolderKanban, Timer } from "lucide-react";
import { BrandLogo } from "@/components/logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { LoginForm } from "./login-form";

const highlights = [
  {
    icon: FolderKanban,
    title: "Run the project",
    text: "Create work, assign the team, and move from bid to close.",
  },
  {
    icon: ClipboardList,
    title: "See today's work",
    text: "Managers and employees get a clear view of what needs doing now.",
  },
  {
    icon: Timer,
    title: "Track the hours",
    text: "Log time by work type. Admins handle project value and billing.",
  },
];

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <div className="pointer-events-none absolute -left-24 top-[-8rem] h-80 w-80 rounded-full bg-teal/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] right-[-4rem] h-72 w-72 rounded-full bg-gold/15 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="flex items-center gap-4">
            <BrandLogo className="h-14 w-14" />
            <div>
              <p className="font-display text-4xl leading-tight text-ink">{APP_NAME}</p>
              <p className="mt-1 text-lg text-muted">{APP_TAGLINE}</p>
            </div>
          </div>
          <ul className="mt-10 grid gap-4">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.title}
                  className="flex gap-4 rounded-2xl border border-line bg-paper-card/80 p-4 shadow-[0_1px_0_rgba(27,36,48,0.04)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="font-medium text-ink">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-line bg-paper-card p-8 shadow-[0_24px_60px_-28px_rgba(21,32,46,0.35)]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandLogo className="h-10 w-10" />
              <div>
                <p className="font-display text-2xl text-ink">{APP_NAME}</p>
                <p className="text-sm text-muted">{APP_TAGLINE}</p>
              </div>
            </div>
            <p className="font-display text-3xl text-ink">Welcome back</p>
            <p className="mt-2 text-sm text-muted">Use your work email to continue.</p>
            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted">© 2026 Digitix Labs. All rights reserved.</p>
        </section>
      </div>
    </div>
  );
}
