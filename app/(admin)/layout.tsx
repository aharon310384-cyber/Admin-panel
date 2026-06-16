import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TopNav from "@/components/layout/topnav";

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
      <TopNav
        userName={session.user.name ?? "Пользователь"}
        userRole={session.user.role}
      />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>

      <style>{`
        .admin-layout {
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
        }

        .admin-main {
          flex: 1;
          min-width: 0;
          overflow-x: hidden;
        }

        .admin-content {
          padding: 28px 32px;
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
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
