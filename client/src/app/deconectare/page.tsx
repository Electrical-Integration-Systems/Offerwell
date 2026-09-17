"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button, Spinner } from "@heroui/react";
import { Layers3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function SignOut() {
    const { signOut } = useAuthActions();
    const started = useRef(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        void signOut()
            .then(() => window.location.replace("/auth"))
            .catch(() => setError("Deconectarea a esuat. Incearca din nou."));
    }, [signOut]);

    return (
        <main className="flex flex-col items-center justify-around my-auto mx-auto w-full max-w-sm px-4 py-10 sm:px-8 sm:py-14">
            <div className="flex flex-col gap-2 text-xl font-semibold text-foreground no-underline items-center mb-5">
                <Layers3 className="size-7 text-accent" aria-hidden="true" />
                Offerwell
            </div>
            {error ? (
                <div className="flex flex-col items-center gap-4">
                    <p role="alert" className="text-sm text-danger">{error}</p>
                    <Button onPress={() => window.location.reload()}>Reincearca</Button>
                </div>
            ) : (
                <Spinner aria-label="Se deconecteaza..." />
            )}
        </main>
    );
}
