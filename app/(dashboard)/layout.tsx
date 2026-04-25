import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[#F7F9F7]"
        style={{
          backgroundImage: "url(/platform-background.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
        aria-hidden
      />
      <Sidebar />
      <main className="relative z-10 ml-72 min-h-screen bg-transparent text-[#111827]">{children}</main>
    </div>
  );
}
