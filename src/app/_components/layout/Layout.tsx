import { type PropsWithChildren } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { auth } from "~/server/auth";
import { ThemeWrapper } from "./ThemeWrapper";
import { type ValidDomain } from "~/config/themes";

export default async function Layout({ children, domain, showSidebar = true }: PropsWithChildren<{ domain: ValidDomain, showSidebar?: boolean }>) {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background-primary text-text-primary">
        <Header />
        <main className="pt-16">
          {children}
        </main>
      </div>
    );
  }

  return (
    <ThemeWrapper>
      {showSidebar && <Sidebar session={session} domain={domain} />}
      <main className="flex-1 p-4 lg:p-8 w-full transition-all duration-200">
        {children}
      </main>
    </ThemeWrapper>
  );
} 