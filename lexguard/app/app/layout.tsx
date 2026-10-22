import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="flex-1 bg-white pb-24">{children}</main>
    </>
  );
}
