import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/components/layout/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="admin-layout">
      <Sidebar
        userName={session.user.name ?? "Пользователь"}
        userRole={session.user.role}
      />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>

      <style>{`
        .admin-layout {
          display: flex;
          min-height: 100dvh;
        }

        .admin-main {
          flex: 1;
          min-width: 0;
          overflow-x: hidden;
        }

        .admin-content {
          padding: 28px 32px;
          max-width: 1400px;
        }

        @media (max-width: 768px) {
          .admin-content {
            padding: 20px 16px;
          }
        }
      `}</style>
    </div>
  );
}
