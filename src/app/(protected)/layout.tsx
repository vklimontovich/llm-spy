import Header from "@/components/Header";
import AuthGuard from "@/components/AuthGuard";

export default function ProtectedAuthLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
            <AuthGuard>
                <div className="min-h-screen">
                    <Header/>
                    <div className="pt-16">
                        {children}
                    </div>
                </div>
            </AuthGuard>
    );
}
